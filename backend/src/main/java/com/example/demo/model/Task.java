package com.example.demo.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "tasks")
public class Task {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String title;
    @Column(length = 1000) private String description;
    private String status = "TODO";
    // Nullable to preserve legacy records; the first registered account adopts them.
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id") @JsonIgnore
    private AppUser user;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "team_id") @JsonIgnore
    private Team team;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "project_id") @JsonIgnore
    private Project project;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "updated_by_id") @JsonIgnore
    private AppUser updatedBy;
    @Column(name = "created_at") private LocalDateTime createdAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;
    @Column(name = "start_date") private LocalDate startDate;
    @Column(name = "due_date") private LocalDate dueDate;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "assignee_id") @JsonIgnore
    private AppUser assignee;
    @PrePersist protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }
    @PreUpdate protected void onUpdate() { updatedAt = LocalDateTime.now(); }

    public Task() {}
    public Task(String title, String description, String status) { this.title = title; this.description = description; this.status = status; }
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Team getTeam() { return team; }
    public void setTeam(Team team) { this.team = team; }
    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }
    public AppUser getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(AppUser updatedBy) { this.updatedBy = updatedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public AppUser getAssignee() { return assignee; }
    public void setAssignee(AppUser assignee) { this.assignee = assignee; }
    public AppUser getUser() { return user; }
    public void setUser(AppUser user) { this.user = user; }
}
