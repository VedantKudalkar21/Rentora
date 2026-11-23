package com.rentora;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class ProfileSecurityTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired JwtEncoder encoder;
    String register() throws Exception {
        MvcResult result=mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Profile User\",\"email\":\"profile-"+UUID.randomUUID()+"@example.com\",\"password\":\"Password@123\"}"))
            .andExpect(status().isCreated()).andReturn();
        assertNull(result.getRequest().getSession(false));
        return json.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
    }
    @Test void profilePersistsAndCannotPromoteRoleOrChangeEmail() throws Exception {
        String token=register();
        mvc.perform(put("/api/profile").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Updated Name\",\"phone\":\"+91 9876543210\",\"city\":\"Mumbai\",\"bio\":\"IT student\",\"role\":\"ADMIN\",\"email\":\"admin@rentora.local\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("CUSTOMER")).andExpect(jsonPath("$.city").value("Mumbai"));
        mvc.perform(get("/api/profile").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Updated Name"))
            .andExpect(jsonPath("$.email").value(org.hamcrest.Matchers.not("admin@rentora.local")));
        mvc.perform(get("/api/admin/bookings").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
    }
    @Test void passwordChangeRequiresCurrentPasswordAndRevokesOldToken() throws Exception {
        String token=register();
        mvc.perform(put("/api/profile/password").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"currentPassword\":\"incorrect\",\"newPassword\":\"NewPassword@123\"}")).andExpect(status().isBadRequest());
        MvcResult updated=mvc.perform(put("/api/profile/password").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"currentPassword\":\"Password@123\",\"newPassword\":\"NewPassword@123\"}"))
            .andExpect(status().isOk()).andReturn();
        var response=json.readTree(updated.getResponse().getContentAsString());
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+response.get("accessToken").asText())).andExpect(status().isOk());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(new Dto.LoginRequest(response.get("user").get("email").asText(),"NewPassword@123"))))
            .andExpect(status().isOk());
    }
    @Test void expiredWrongIssuerAndWrongAudienceTokensFail() throws Exception {
        UserAccount user=users.findByEmail("user@rentora.local").orElseThrow();
        for(int variation=0;variation<3;variation++) {
            Instant now=Instant.now();
            JwtClaimsSet claims=JwtClaimsSet.builder().issuer(variation==1 ? "attacker" : "rentora").subject(user.id.toString())
                .audience(List.of(variation==2 ? "wrong-app" : "rentora-web")).issuedAt(now.minusSeconds(600))
                .expiresAt(variation==0 ? now.minusSeconds(300) : now.plusSeconds(600)).id(UUID.randomUUID().toString())
                .claim("role",user.role.name()).claim("version",user.authVersion).build();
            String token=encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(),claims)).getTokenValue();
            mvc.perform(get("/api/profile").header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized());
        }
    }
    @Test void profileValidationAndAuthConfiguration() throws Exception {
        String token=register();
        mvc.perform(put("/api/profile").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Valid Name\",\"phone\":\"badphone<script>\"}")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/profile")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/config")).andExpect(status().isOk()).andExpect(jsonPath("$.googleEnabled").value(false));
        mvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON)
            .content("{\"credential\":\"invalid\",\"nonce\":\"12345678901234567890123456789012\"}")).andExpect(status().isServiceUnavailable());
    }
}
