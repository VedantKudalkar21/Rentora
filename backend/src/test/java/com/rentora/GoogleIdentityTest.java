package com.rentora;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;
import java.security.interfaces.RSAPrivateKey;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.*;
import org.springframework.context.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:rentora-google;MODE=MySQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc @ActiveProfiles("test") @Import(GoogleIdentityTest.TestGoogleKeys.class)
class GoogleIdentityTest {
    static final String CLIENT="test-google-client";
    static final String NONCE="12345678901234567890123456789012";
    static final RSAKey KEY=key();
    static RSAKey key() {
        try { var generator=KeyPairGenerator.getInstance("RSA");generator.initialize(2048);var pair=generator.generateKeyPair();
            return new RSAKey.Builder((RSAPublicKey)pair.getPublic()).privateKey((RSAPrivateKey)pair.getPrivate()).keyID("test").build();
        } catch(Exception ex) { throw new IllegalStateException(ex); }
    }
    @TestConfiguration static class TestGoogleKeys {
        @Bean @Primary GoogleIdentityVerifier testGoogleVerifier() throws Exception {
            return new GoogleIdentityVerifier(CLIENT,NimbusJwtDecoder.withPublicKey(KEY.toRSAPublicKey()).build());
        }
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    String credential(String subject,String email,String audience,String nonce,boolean verified) {
        Instant now=Instant.now();
        var claims=JwtClaimsSet.builder().issuer("https://accounts.google.com").subject(subject).audience(List.of(audience))
            .issuedAt(now).expiresAt(now.plusSeconds(600)).claim("email",email).claim("email_verified",verified)
            .claim("name","Google Tester").claim("nonce",nonce).build();
        var encoder=new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(KEY)));
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).keyId("test").build(),claims)).getTokenValue();
    }
    MockHttpServletRequestBuilder google(String subject,String email) throws Exception {
        return post("/api/auth/google").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(new Dto.GoogleRequest(credential(subject,email,CLIENT,NONCE,true),NONCE)));
    }
    @Test void googleSignupAlwaysCustomerAndReturningSubjectReusesAccount() throws Exception {
        String subject=UUID.randomUUID().toString(),email="google-"+subject+"@example.com";
        MvcResult first=mvc.perform(google(subject,email)).andExpect(status().isOk()).andExpect(jsonPath("$.user.role").value("CUSTOMER")).andReturn();
        String id=json.readTree(first.getResponse().getContentAsString()).get("user").get("id").asText();
        mvc.perform(google(subject,email)).andExpect(status().isOk()).andExpect(jsonPath("$.user.id").value(Long.parseLong(id)));
        UserAccount user=users.findByGoogleSubject(subject).orElseThrow();assertFalse(user.passwordLoginEnabled);
    }
    @Test void invalidAudienceNonceSignatureAndUnverifiedEmailAreRejected() throws Exception {
        for(Dto.GoogleRequest body:List.of(
            new Dto.GoogleRequest(credential("bad-aud","person@example.com","attacker",NONCE,true),NONCE),
            new Dto.GoogleRequest(credential("bad-nonce","person@example.com",CLIENT,"different",true),NONCE),
            new Dto.GoogleRequest(credential("unverified","person@example.com",CLIENT,NONCE,false),NONCE),
            new Dto.GoogleRequest("not.a.valid.signature",NONCE))) {
            mvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
        }
    }
    @Test void existingEmailRequiresExplicitAuthenticatedLinking() throws Exception {
        String email="link-"+UUID.randomUUID()+"@example.com",subject=UUID.randomUUID().toString();
        MvcResult registration=mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(new Dto.RegisterRequest("Link User",email,"Password@123"))))
            .andExpect(status().isCreated()).andReturn();
        String token=json.readTree(registration.getResponse().getContentAsString()).get("accessToken").asText();
        mvc.perform(google(subject,email)).andExpect(status().isConflict());
        mvc.perform(post("/api/profile/google").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(new Dto.GoogleRequest(credential(subject,email,CLIENT,NONCE,true),NONCE))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.googleLinked").value(true));
        mvc.perform(google(subject,email)).andExpect(status().isOk());
    }
}
