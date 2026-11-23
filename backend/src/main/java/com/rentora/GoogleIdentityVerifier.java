package com.rentora;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
@Service
public class GoogleIdentityVerifier {
    private final String clientId;
    private final JwtDecoder decoder;
    @Autowired public GoogleIdentityVerifier(@Value("${app.google.client-id:}") String clientId) {
        this(clientId,NimbusJwtDecoder.withJwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
            .jwsAlgorithm(SignatureAlgorithm.RS256).build());
    }
    GoogleIdentityVerifier(String clientId,JwtDecoder decoder) { this.clientId=clientId;this.decoder=decoder; }
    String clientId() { return clientId; }
    Identity verify(Dto.GoogleRequest request) {
        if(clientId.isBlank()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Google sign-in is not configured. Use email/password or configure GOOGLE_CLIENT_ID.");
        try {
            Jwt token=decoder.decode(request.credential());
            String issuer=token.getClaimAsString("iss"),subject=token.getSubject(),email=token.getClaimAsString("email");
            String nonce=token.getClaimAsString("nonce"),authorizedParty=token.getClaimAsString("azp");
            if(!List.of("accounts.google.com","https://accounts.google.com").contains(issuer)
                || !token.getAudience().contains(clientId) || (authorizedParty!=null && !authorizedParty.equals(clientId))
                || token.getExpiresAt()==null || !token.getExpiresAt().isAfter(Instant.now())
                || !Boolean.TRUE.equals(token.getClaimAsBoolean("email_verified"))
                || subject==null || subject.isBlank() || subject.length()>255
                || email==null || email.length()>120 || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")
                || nonce==null || !MessageDigest.isEqual(nonce.getBytes(StandardCharsets.UTF_8),request.nonce().getBytes(StandardCharsets.UTF_8)))
                throw new IllegalArgumentException("Invalid Google claims");
            String name=token.getClaimAsString("name");
            if(name==null || name.isBlank()) name="Google Customer";
            return new Identity(subject,email.strip().toLowerCase(java.util.Locale.ROOT),name.substring(0,Math.min(name.length(),80)));
        } catch(RuntimeException ex) { throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Google sign-in could not be verified. Please try again."); }
    }
    record Identity(String subject,String email,String name) {}
}
