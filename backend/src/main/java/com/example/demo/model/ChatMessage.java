package com.example.demo.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "team_chat_messages")
public class ChatMessage {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    @JsonIgnore private Team team;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    @JsonIgnore private AppUser sender;

    @Column(length = 2000)
    private String message;

    @Column(name = "image_data", columnDefinition = "TEXT")
    @JsonIgnore private String imageData;

    @Column(name = "image_name", length = 160)
    private String imageName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public ChatMessage() {}
    public ChatMessage(Team team, AppUser sender, String message, String imageData, String imageName) {
        this.team = team; this.sender = sender; this.message = message; this.imageData = imageData; this.imageName = imageName;
    }

    @PrePersist protected void onCreate() { if (createdAt == null) createdAt = LocalDateTime.now(); }
    public Long getId() { return id; }
    public Team getTeam() { return team; }
    public AppUser getSender() { return sender; }
    public String getMessage() { return message; }
    public String getImageData() { return imageData; }
    public String getImageName() { return imageName; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
