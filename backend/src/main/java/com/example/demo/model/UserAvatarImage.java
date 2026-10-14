package com.example.demo.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "user_avatar_images", uniqueConstraints = @UniqueConstraint(name = "uk_user_avatar_images_user", columnNames = "user_id"))
public class UserAvatarImage {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    @JsonIgnore private AppUser user;

    @Column(name = "image_data", nullable = false, columnDefinition = "TEXT")
    @JsonIgnore private String imageData;

    public UserAvatarImage() {}
    public UserAvatarImage(AppUser user, String imageData) { this.user = user; this.imageData = imageData; }
    public Long getId() { return id; }
    public AppUser getUser() { return user; }
    public String getImageData() { return imageData; }
    public void setImageData(String imageData) { this.imageData = imageData; }
}
