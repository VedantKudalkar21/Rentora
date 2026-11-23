package com.rentora;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import jakarta.servlet.http.HttpServletResponse;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.*;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
    @Bean SecretKey jwtKey(@Value("${app.jwt.secret:}") String configured) {
        byte[] key;
        if (configured.isBlank()) { key=new byte[32];new SecureRandom().nextBytes(key); }
        else {
            try { key=Base64.getDecoder().decode(configured); }
            catch(IllegalArgumentException ex) { throw new IllegalStateException("JWT_SECRET must be Base64 encoded.",ex); }
            if(key.length<32) throw new IllegalStateException("JWT_SECRET must contain at least 32 random bytes, Base64 encoded.");
        }
        return new SecretKeySpec(key,"HmacSHA256");
    }
    @Bean JwtEncoder jwtEncoder(SecretKey key) { return new NimbusJwtEncoder(new ImmutableSecret<>(key)); }
    @Bean JwtDecoder jwtDecoder(SecretKey key,UserRepository users,RevokedTokenRepository revoked,Clock clock) {
        NimbusJwtDecoder decoder=NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        OAuth2TokenValidator<Jwt> accounts=token -> {
            try {
                Number version=token.getClaim("version");
                var user=users.findById(Long.parseLong(token.getSubject()));
                if(token.getId()!=null && token.getExpiresAt()!=null && token.getExpiresAt().isAfter(clock.instant())
                    && token.getAudience().contains("rentora-web") && version!=null && user.isPresent()
                    && user.get().authVersion==version.longValue() && user.get().role.name().equals(token.getClaimAsString("role"))
                    && !revoked.existsById(token.getId())) return OAuth2TokenValidatorResult.success();
            } catch(RuntimeException ignored) { }
            return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token","Token expired, revoked, or invalid.",null));
        };
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer("rentora"),accounts));
        return decoder;
    }
    @Bean SecurityFilterChain security(HttpSecurity http) throws Exception {
        JwtAuthenticationConverter converter=new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> List.of(new SimpleGrantedAuthority("ROLE_"+jwt.getClaimAsString("role"))));
        http.csrf(csrf -> csrf.disable()) // Explicit Bearer headers only; no authentication cookies.
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/config","/api/auth/login","/api/auth/register","/api/auth/google","/error").permitAll()
                .requestMatchers(HttpMethod.GET,"/api/equipment","/api/equipment/*/availability","/api/equipment/photos/*").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN").anyRequest().authenticated())
            .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.jwtAuthenticationConverter(converter))
                .authenticationEntryPoint((req,res,ex) -> json(res,401,"Please sign in again. Your token is missing, invalid, or expired.")))
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((req,res,ex) -> json(res,401,"Please sign in to continue."))
                .accessDeniedHandler((req,res,ex) -> json(res,403,"Your account does not have permission for this action.")))
            .formLogin(form -> form.disable()).httpBasic(basic -> basic.disable()).logout(logout -> logout.disable());
        return http.build();
    }
    private static void json(HttpServletResponse res,int status,String message) throws java.io.IOException {
        res.setStatus(status);res.setContentType("application/json");res.getWriter().write("{\"message\":\""+message+"\"}");
    }
}
