package com.rentora;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    private final GoogleIdentityVerifier google;
    AuthController(AuthService auth,GoogleIdentityVerifier google) { this.auth=auth;this.google=google; }
    @GetMapping("/config") Map<String,Object> config() { return Map.of("googleEnabled",!google.clientId().isBlank(),"googleClientId",google.clientId()); }
    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    Dto.AuthResponse register(@Valid @RequestBody Dto.RegisterRequest body) { return auth.register(body); }
    @PostMapping("/login") Dto.AuthResponse login(@Valid @RequestBody Dto.LoginRequest body) { return auth.login(body); }
    @PostMapping("/google") Dto.AuthResponse google(@Valid @RequestBody Dto.GoogleRequest body) { return auth.googleLogin(body); }
    @GetMapping("/me") Dto.UserView me(Principal principal) { return Dto.UserView.from(auth.current(principal)); }
    @PostMapping("/logout") Map<String,String> logout(@AuthenticationPrincipal Jwt jwt) { auth.logout(jwt);return Map.of("message","Logged out. Token revoked."); }
}
