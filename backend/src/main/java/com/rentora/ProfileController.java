package com.rentora;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/profile")
public class ProfileController {
    private final AuthService auth;
    ProfileController(AuthService auth) { this.auth=auth; }
    @GetMapping Dto.ProfileView profile(Principal principal) { return auth.profile(principal); }
    @PutMapping Dto.ProfileView update(Principal principal,@Valid @RequestBody Dto.ProfileRequest body) { return auth.updateProfile(principal,body); }
    @PutMapping("/password") Dto.AuthResponse password(Principal principal,@Valid @RequestBody Dto.PasswordRequest body) { return auth.changePassword(principal,body); }
    @PostMapping("/google") Dto.ProfileView google(Principal principal,@Valid @RequestBody Dto.GoogleRequest body) { return auth.linkGoogle(principal,body); }
}
