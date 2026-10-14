package com.example.demo.controller;

import com.example.demo.model.AppUser;
import com.example.demo.model.UserAvatarImage;
import com.example.demo.repository.AppUserRepository;
import com.example.demo.repository.UserAvatarImageRepository;
import com.example.demo.repository.TaskRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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
import java.util.Base64;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^ @]+@[^ @]+[.][^ @]+$");
    private static final Pattern IMAGE_DATA_URL = Pattern.compile("^data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$");
    private static final Set<String> DEFAULT_AVATARS = Set.of(
        "/avatars/doodle-fox.svg", "/avatars/doodle-cat.svg", "/avatars/doodle-dog.svg",
        "/avatars/doodle-rabbit.svg", "/avatars/doodle-panda.svg", "/avatars/doodle-penguin.svg",
        "/avatars/doodle-frog.svg", "/avatars/doodle-raccoon.svg"
    );
    private final AppUserRepository users;
    private final TaskRepository tasks;
    private final UserAvatarImageRepository avatarImages;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;
    private final CookieCsrfTokenRepository csrfTokenRepository;

    public AuthController(AppUserRepository users, TaskRepository tasks, UserAvatarImageRepository avatarImages, PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager, SecurityContextRepository securityContextRepository,
            CookieCsrfTokenRepository csrfTokenRepository) {
        this.users = users; this.tasks = tasks; this.avatarImages = avatarImages; this.passwordEncoder = passwordEncoder;
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
        AppUser newUser = new AppUser(name, email, passwordEncoder.encode(password));
        AppUser user = users.save(newUser);
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

    @GetMapping("/avatar/{userId}")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> getAvatar(@PathVariable Long userId, Authentication authentication) {
        currentUser(authentication);
        AppUser target = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Profile image not found."));
        if (!("/api/auth/avatar/" + userId).equals(target.getAvatarUrl())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Uploaded profile image not found.");
        }
        UserAvatarImage stored = avatarImages.findByUser_Id(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Uploaded profile image not found."));
        Matcher matcher = IMAGE_DATA_URL.matcher(stored.getImageData());
        if (!matcher.matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Uploaded profile image is invalid.");
        byte[] bytes;
        try { bytes = Base64.getDecoder().decode(matcher.group(2)); }
        catch (IllegalArgumentException ex) { throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Uploaded profile image is invalid."); }
        return ResponseEntity.ok()
            .header(HttpHeaders.CACHE_CONTROL, "private, max-age=300")
            .contentType(MediaType.parseMediaType(matcher.group(1)))
            .body(bytes);
    }

    @PatchMapping("/profile")
    @Transactional
    public Map<String, Object> updateProfile(@RequestBody Map<String, String> body, Authentication authentication) {
        AppUser user = currentUser(authentication);
        String name = trim(body.get("name"));
        if (name.isBlank() || name.length() > 80) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name must be between 1 and 80 characters.");
        user.setName(name);
        String avatarUrl = trim(body.get("avatarUrl"));
        if (avatarUrl.equals("/api/auth/avatar/" + user.getId())) {
            // Keep the current uploaded image when only other profile fields change.
        } else if (avatarUrl.isBlank()) {
            avatarImages.deleteByUser_Id(user.getId());
            user.setAvatarUrl(defaultAvatar(user.getId()));
        } else if (DEFAULT_AVATARS.contains(avatarUrl)) {
            avatarImages.deleteByUser_Id(user.getId());
            user.setAvatarUrl(avatarUrl);
        } else if (avatarUrl.startsWith("https://") || avatarUrl.startsWith("http://")) {
            if (avatarUrl.length() > 500) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Profile image URL must be 500 characters or fewer.");
            avatarImages.deleteByUser_Id(user.getId());
            user.setAvatarUrl(avatarUrl);
        } else if (avatarUrl.length() <= 700_000 && IMAGE_DATA_URL.matcher(avatarUrl).matches()) {
            Matcher matcher = IMAGE_DATA_URL.matcher(avatarUrl);
            matcher.matches();
            try {
                byte[] data = Base64.getDecoder().decode(matcher.group(2));
                if (data.length > 512 * 1024) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Profile images must be 512 KB or smaller after compression.");
            } catch (IllegalArgumentException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That profile image isn't a valid image.");
            }
            UserAvatarImage stored = avatarImages.findByUser_Id(user.getId())
                .orElseGet(() -> new UserAvatarImage(user, avatarUrl));
            stored.setImageData(avatarUrl);
            avatarImages.save(stored);
            user.setAvatarUrl("/api/auth/avatar/" + user.getId());
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a doodle, upload a JPG/PNG/WebP image, or use an HTTP(S) image URL.");
        }
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
        request.changeSessionId();
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
        return Map.of("user", Map.of("id", user.getId(), "name", user.getName(), "email", user.getEmail(), "avatarUrl", effectiveAvatarUrl(user),
                "createdAt", user.getCreatedAt() == null ? "" : user.getCreatedAt().toString()));
    }
    private String effectiveAvatarUrl(AppUser user) {
        String saved = user.getAvatarUrl();
        if (saved != null && saved.startsWith("data:image/")) return "/api/auth/avatar/" + user.getId();
        if (saved != null && !saved.isBlank()) return saved;
        return defaultAvatar(user.getId());
    }
    private String defaultAvatar(Long id) {
        String[] choices = {"/avatars/doodle-fox.svg", "/avatars/doodle-cat.svg", "/avatars/doodle-dog.svg",
            "/avatars/doodle-rabbit.svg", "/avatars/doodle-panda.svg", "/avatars/doodle-penguin.svg",
            "/avatars/doodle-frog.svg", "/avatars/doodle-raccoon.svg"};
        int index = Math.floorMod(id == null ? 0 : id.intValue(), choices.length);
        return choices[index];
    }
    private String normalizeEmail(String value) { return trim(value).toLowerCase(Locale.ROOT); }
    private String trim(String value) { return value == null ? "" : value.trim(); }
}
