package com.rentora;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.time.Clock;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
@Service
public class AuthService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JwtService tokens;
    private final RevokedTokenRepository revoked;
    private final GoogleIdentityVerifier google;
    private final Clock clock;
    AuthService(UserRepository users,PasswordEncoder passwords,JwtService tokens,RevokedTokenRepository revoked,GoogleIdentityVerifier google,Clock clock) {
        this.users=users;this.passwords=passwords;this.tokens=tokens;this.revoked=revoked;this.google=google;this.clock=clock;
    }
    @Transactional public Dto.AuthResponse register(Dto.RegisterRequest body) {
        String email=body.email().strip().toLowerCase(Locale.ROOT);
        if(users.existsByEmail(email)) throw error(409,"This email is already registered.");
        String name=validName(body.name());checkPassword(body.password());
        return tokens.issue(users.save(new UserAccount(name,email,passwords.encode(body.password()),UserAccount.Role.CUSTOMER)));
    }
    @Transactional(readOnly=true) public Dto.AuthResponse login(Dto.LoginRequest body) {
        checkPassword(body.password());
        UserAccount user=users.findByEmail(body.email().strip().toLowerCase(Locale.ROOT))
            .filter(u -> u.passwordLoginEnabled && passwords.matches(body.password(),u.passwordHash))
            .orElseThrow(() -> error(401,"Incorrect email or password. Google-only accounts must sign in with Google."));
        return tokens.issue(user);
    }
    @Transactional public Dto.AuthResponse googleLogin(Dto.GoogleRequest body) {
        var identity=google.verify(body);
        UserAccount user=users.findByGoogleSubject(identity.subject()).orElse(null);
        if(user==null) {
            if(users.existsByEmail(identity.email())) throw error(409,"An account already uses this email. Sign in with its password, then link Google from My profile.");
            user=new UserAccount(identity.name(),identity.email(),passwords.encode(UUID.randomUUID().toString()),UserAccount.Role.CUSTOMER);
            user.googleSubject=identity.subject();user.passwordLoginEnabled=false;users.save(user);
        }
        return tokens.issue(user);
    }
    @Transactional public Dto.ProfileView linkGoogle(Principal principal,Dto.GoogleRequest body) {
        UserAccount user=current(principal);var identity=google.verify(body);
        if(!user.email.equalsIgnoreCase(identity.email())) throw error(400,"Choose the Google account with the same email address as your Rentora account.");
        if(user.googleSubject!=null && !user.googleSubject.equals(identity.subject())) throw error(409,"A different Google account is already linked.");
        if(users.findByGoogleSubject(identity.subject()).filter(other -> !other.id.equals(user.id)).isPresent()) throw error(409,"This Google account is already linked to another user.");
        user.googleSubject=identity.subject();return Dto.ProfileView.from(user);
    }
    @Transactional(readOnly=true) public UserAccount current(Principal principal) {
        if(principal==null) throw error(401,"Please sign in.");
        try { return users.findById(Long.parseLong(principal.getName())).orElseThrow(() -> error(401,"Please sign in again.")); }
        catch(NumberFormatException ex) { throw error(401,"Invalid account token."); }
    }
    @Transactional(readOnly=true) public Dto.ProfileView profile(Principal principal) { return Dto.ProfileView.from(current(principal)); }
    @Transactional public Dto.ProfileView updateProfile(Principal principal,Dto.ProfileRequest body) {
        UserAccount user=current(principal);user.name=validName(body.name());user.phone=clean(body.phone());user.city=clean(body.city());user.bio=clean(body.bio());
        return Dto.ProfileView.from(user);
    }
    @Transactional public Dto.AuthResponse changePassword(Principal principal,Dto.PasswordRequest body) {
        UserAccount user=current(principal);
        if(user.passwordLoginEnabled && (body.currentPassword()==null || body.currentPassword().getBytes(StandardCharsets.UTF_8).length>72
            || !passwords.matches(body.currentPassword(),user.passwordHash))) throw error(400,"Your current password is incorrect.");
        checkPassword(body.newPassword());user.passwordHash=passwords.encode(body.newPassword());user.passwordLoginEnabled=true;user.authVersion++;
        return tokens.issue(user);
    }
    @Transactional public void logout(Jwt token) {
        revoked.deleteByExpiresAtBefore(clock.instant());revoked.save(new RevokedToken(token.getId(),token.getExpiresAt()));
    }
    private String validName(String name) { String clean=name.strip();if(clean.length()<2) throw error(400,"Enter a name with at least two characters.");return clean; }
    private String clean(String value) { return value==null ? "" : value.strip(); }
    private void checkPassword(String value) {
        if(value==null || value.length()<8 || value.getBytes(StandardCharsets.UTF_8).length>72)
            throw error(400,"Password must have at least 8 characters and at most 72 UTF-8 bytes.");
    }
    private ResponseStatusException error(int status,String message) { return new ResponseStatusException(HttpStatus.valueOf(status),message); }
}
