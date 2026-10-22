package com.example.demo.controller;

import com.example.demo.model.AppUser;
import com.example.demo.model.Project;
import com.example.demo.model.Team;
import com.example.demo.repository.AppUserRepository;
import com.example.demo.repository.ProjectRepository;
import com.example.demo.repository.TeamMemberRepository;
import com.example.demo.repository.TeamRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/teams/{teamId}/projects")
public class ProjectController {
    private static final Set<String> ALLOWED_STATUSES =
        Set.of("PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED");

    private final AppUserRepository users;
    private final TeamRepository teams;
    private final TeamMemberRepository members;
    private final ProjectRepository projects;

    public ProjectController(AppUserRepository users, TeamRepository teams,
            TeamMemberRepository members, ProjectRepository projects) {
        this.users = users;
        this.teams = teams;
        this.members = members;
        this.projects = projects;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> listProjects(@PathVariable Long teamId, Authentication auth) {
        AppUser actor = currentUser(auth);
        requireMembership(teamId, actor);
        return projects.findAllByTeam_IdOrderByCreatedAtDesc(teamId)
            .stream().map(this::projectMap).toList();
    }

    @GetMapping("/{projectId}")
    @Transactional(readOnly = true)
    public Map<String, Object> getProject(@PathVariable Long teamId, @PathVariable Long projectId,
            Authentication auth) {
        Project project = requireProject(teamId, projectId, currentUser(auth));
        return projectMap(project);
    }

    @PostMapping
    @Transactional
    public Map<String, Object> createProject(@PathVariable Long teamId,
            @RequestBody Map<String, String> body, Authentication auth) {
        AppUser actor = currentUser(auth);
        Team team = requireMembership(teamId, actor);

        String name = trim(body.get("name"));
        if (name.isBlank() || name.length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Project name must be between 1 and 120 characters.");
        }

        String description = trim(body.get("description"));
        if (description.length() > 2000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Project description must be 2000 characters or fewer.");
        }

        String status = normalizeStatus(body.get("status"), "PLANNED");
        LocalDate startDate = parseDate(body.get("startDate"), "startDate");
        LocalDate targetDate = parseDate(body.get("targetDate"), "targetDate");
        validateDates(startDate, targetDate);

        Project project = new Project(name, description, status, startDate, targetDate, team, actor);
        return projectMap(projects.save(project));
    }

    @PatchMapping("/{projectId}")
    @Transactional
    public Map<String, Object> updateProject(@PathVariable Long teamId, @PathVariable Long projectId,
            @RequestBody Map<String, String> body, Authentication auth) {
        Project project = requireProject(teamId, projectId, currentUser(auth));

        if (body.containsKey("name")) {
            String name = trim(body.get("name"));
            if (name.isBlank() || name.length() > 120) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Project name must be between 1 and 120 characters.");
            }
            project.setName(name);
        }

        if (body.containsKey("description")) {
            String description = trim(body.get("description"));
            if (description.length() > 2000) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Project description must be 2000 characters or fewer.");
            }
            project.setDescription(description);
        }

        if (body.containsKey("status")) {
            project.setStatus(normalizeStatus(body.get("status"), null));
        }

        if (body.containsKey("startDate")) {
            project.setStartDate(parseDate(body.get("startDate"), "startDate"));
        }

        if (body.containsKey("targetDate")) {
            project.setTargetDate(parseDate(body.get("targetDate"), "targetDate"));
        }

        validateDates(project.getStartDate(), project.getTargetDate());
        return projectMap(projects.save(project));
    }

    @DeleteMapping("/{projectId}")
    @Transactional
    public ResponseEntity<Void> deleteProject(@PathVariable Long teamId, @PathVariable Long projectId,
            Authentication auth) {
        Project project = requireProject(teamId, projectId, currentUser(auth));
        projects.delete(project);
        return ResponseEntity.noContent().build();
    }

    private Project requireProject(Long teamId, Long projectId, AppUser actor) {
        requireMembership(teamId, actor);
        return projects.findByIdAndTeam_Id(projectId, teamId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found."));
    }

    private Team requireMembership(Long teamId, AppUser actor) {
        Team team = teams.findById(teamId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Team not found."));
        if (!members.existsByTeam_IdAndUser_Id(teamId, actor.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Join this team to access its projects.");
        }
        return team;
    }

    private AppUser currentUser(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in.");
        }
        return users.findByEmailIgnoreCase(auth.getName())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account not found."));
    }

    private String normalizeStatus(String supplied, String defaultValue) {
        String status = supplied == null ? "" : supplied.trim().toUpperCase(Locale.ROOT);
        if (status.isBlank() && defaultValue != null) return defaultValue;
        if (!ALLOWED_STATUSES.contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Status must be PLANNED, ACTIVE, ON_HOLD, or COMPLETED.");
        }
        return status;
    }

    private LocalDate parseDate(String supplied, String fieldName) {
        if (supplied == null || supplied.isBlank()) return null;
        try {
            return LocalDate.parse(supplied.trim());
        } catch (DateTimeParseException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                fieldName + " must use ISO date format YYYY-MM-DD.");
        }
    }

    private void validateDates(LocalDate startDate, LocalDate targetDate) {
        if (startDate != null && targetDate != null && startDate.isAfter(targetDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Project startDate cannot be after targetDate.");
        }
    }

    private Map<String, Object> projectMap(Project project) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", project.getId());
        result.put("name", project.getName());
        result.put("description", project.getDescription());
        result.put("status", project.getStatus());
        result.put("startDate", project.getStartDate() == null ? null : project.getStartDate().toString());
        result.put("targetDate", project.getTargetDate() == null ? null : project.getTargetDate().toString());
        result.put("teamId", project.getTeam().getId());
        result.put("createdAt", formatTime(project.getCreatedAt()));
        result.put("updatedAt", formatTime(project.getUpdatedAt()));
        Map<String, Object> creator = new LinkedHashMap<>();
        creator.put("id", project.getCreatedBy().getId());
        creator.put("name", project.getCreatedBy().getName());
        result.put("createdBy", creator);
        return result;
    }

    private String formatTime(LocalDateTime value) {
        return value == null ? "" : value.toString();
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
