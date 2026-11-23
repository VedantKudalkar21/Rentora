package com.rentora;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
@Service
public class JwtService {
    private final JwtEncoder encoder;
    private final Clock clock;
    private final long ttl;
    JwtService(JwtEncoder encoder,Clock clock,@Value("${app.jwt.ttl-seconds:7200}") long ttl) {
        if(ttl<60 || ttl>86400) throw new IllegalStateException("JWT TTL must be between 60 and 86400 seconds.");
        this.encoder=encoder;this.clock=clock;this.ttl=ttl;
    }
    Dto.AuthResponse issue(UserAccount user) {
        Instant now=clock.instant(),expires=now.plusSeconds(ttl);
        JwtClaimsSet claims=JwtClaimsSet.builder().issuer("rentora").subject(user.id.toString())
            .audience(List.of("rentora-web")).issuedAt(now).expiresAt(expires).id(UUID.randomUUID().toString())
            .claim("role",user.role.name()).claim("version",user.authVersion).build();
        String token=encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(),claims)).getTokenValue();
        return new Dto.AuthResponse(token,"Bearer",expires,Dto.UserView.from(user));
    }
}
