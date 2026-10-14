package com.example.demo.controller;

import com.example.demo.model.AppUser;
import com.example.demo.model.Task;
import com.example.demo.repository.AppUserRepository;
import com.example.demo.repository.TaskRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    private static final Set<String> ALLOWED_STATUSES = Set.of("TODO", "IN_PROGRESS", "DONE");
    private final TaskRepository tasks;
    private final AppUserRepository users;

    public TaskController(TaskRepository tasks, AppUserRepository users) { this.tasks = tasks; this.users = users; }

    @GetMapping
    public List<Task> getAllTasks(Authentication authentication) {
        return tasks.findAllByUser_IdOrderByIdDesc(currentUser(authentication).getId());
    }

    @PostMapping
    public Task createTask(@RequestBody Task task, Authentication authentication) {
        String title = task.getTitle() == null ? "" : task.getTitle().trim();
        if (title.isBlank() || title.length() > 120) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Task title must be between 1 and 120 characters.");
        task.setTitle(title);
        if (task.getDescription() != null) {
            task.setDescription(task.getDescription().trim());
            if (task.getDescription().length() > 1000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Description must be 1000 characters or fewer.");
        }
        if (task.getStatus() == null || task.getStatus().isBlank()) task.setStatus("TODO");
        else if (!ALLOWED_STATUSES.contains(task.getStatus())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be TODO, IN_PROGRESS, or DONE.");
        task.setUser(currentUser(authentication));
        return tasks.save(task);
    }

    @PatchMapping("/{id}")
    public Task updateTaskStatus(@PathVariable Long id, @RequestBody Map<String, String> updates, Authentication authentication) {
        String status = updates.get("status");
        if (status == null || !ALLOWED_STATUSES.contains(status)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be TODO, IN_PROGRESS, or DONE.");
        AppUser owner = currentUser(authentication);
        Task task = tasks.findByIdAndUser_Id(id, owner.getId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found."));
        task.setStatus(status);
        return tasks.save(task);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long id, Authentication authentication) {
        AppUser owner = currentUser(authentication);
        Task task = tasks.findByIdAndUser_Id(id, owner.getId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found."));
        tasks.delete(task);
        return ResponseEntity.noContent().build();
    }

    private AppUser currentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in again.");
        return users.findByEmailIgnoreCase(authentication.getName()).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account not found."));
    }
}
