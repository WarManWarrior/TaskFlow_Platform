package com.example.demo.controller;

import com.example.demo.model.AppUser;
import com.example.demo.repository.AppUserRepository;
import com.example.demo.repository.TaskRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^ @]+@[^ @]+[.][^ @]+$");
    private final AppUserRepository users;
    private final TaskRepository tasks;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;
    private final CookieCsrfTokenRepository csrfTokenRepository;

    public AuthController(AppUserRepository users, TaskRepository tasks, PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager, SecurityContextRepository securityContextRepository,
            CookieCsrfTokenRepository csrfTokenRepository) {
        this.users = users; this.tasks = tasks; this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager; this.securityContextRepository = securityContextRepository;
        this.csrfTokenRepository = csrfTokenRepository;
    }

    @GetMapping("/csrf")
    public Map<String, String> csrf(CsrfToken token) { return Map.of("token", token.getToken()); }

    @PostMapping("/register")
    @Transactional
    public Map<String, Object> register(@RequestBody Map<String, String> body, HttpServletRequest request, HttpServletResponse response) {
        String name = trim(body.get("name"));
        String email = normalizeEmail(body.get("email"));
        String password = body.get("password");
        if (name.isBlank() || name.length() > 80) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name must be between 1 and 80 characters.");
        if (email.length() > 254 || !EMAIL_PATTERN.matcher(email).matches()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
        if (password == null || password.length() < 8 || password.length() > 72) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be between 8 and 72 characters.");
        if (users.existsByEmailIgnoreCase(email)) throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with that email already exists. Sign in instead.");

        boolean firstAccount = users.count() == 0;
        AppUser user = users.save(new AppUser(name, email, passwordEncoder.encode(password)));
        if (firstAccount) tasks.assignUnownedTasksToUser(user);
        Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(user.getEmail(), null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        establishSession(authentication, request, response);
        return authResponse(user);
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body, HttpServletRequest request, HttpServletResponse response) {
        String email = normalizeEmail(body.get("email"));
        String password = body.get("password");
        if (email.isBlank() || password == null || password.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter your email and password.");
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(email, password));
        } catch (BadCredentialsException | DisabledException | AuthenticationServiceException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect.");
        } catch (AuthenticationException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect.");
        }
        establishSession(authentication, request, response);
        AppUser user = users.findByEmailIgnoreCase(authentication.getName()).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account not found."));
        return authResponse(user);
    }

    @GetMapping("/me")
    public Map<String, Object> me(Authentication authentication) { return authResponse(currentUser(authentication)); }

    @PatchMapping("/profile")
    @Transactional
    public Map<String, Object> updateProfile(@RequestBody Map<String, String> body, Authentication authentication) {
        AppUser user = currentUser(authentication);
        String name = trim(body.get("name"));
        if (name.isBlank() || name.length() > 80) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name must be between 1 and 80 characters.");
        user.setName(name);
        return authResponse(users.save(user));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        new SecurityContextLogoutHandler().logout(request, response, authentication);
        csrfTokenRepository.saveToken(null, request, response);
        return ResponseEntity.noContent().build();
    }

    private void establishSession(Authentication authentication, HttpServletRequest request, HttpServletResponse response) {
        request.getSession(true);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }

    private AppUser currentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in again.");
        return users.findByEmailIgnoreCase(authentication.getName()).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account not found."));
    }

    private Map<String, Object> authResponse(AppUser user) {
        return Map.of("user", Map.of("id", user.getId(), "name", user.getName(), "email", user.getEmail(),
                "createdAt", user.getCreatedAt() == null ? "" : user.getCreatedAt().toString()));
    }
    private String normalizeEmail(String value) { return trim(value).toLowerCase(Locale.ROOT); }
    private String trim(String value) { return value == null ? "" : value.trim(); }
}
