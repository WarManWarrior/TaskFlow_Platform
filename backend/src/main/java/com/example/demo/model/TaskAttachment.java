package com.example.demo.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "task_attachments")
public class TaskAttachment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    @JsonIgnore
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by_id", nullable = false)
    @JsonIgnore
    private AppUser uploadedBy;

    @Column(name = "file_name", nullable = false, length = 160)
    private String fileName;

    @Column(name = "content_type", nullable = false, length = 120)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Column(name = "file_data", nullable = false, columnDefinition = "bytea")
    private byte[] fileData;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public TaskAttachment() {}

    public TaskAttachment(Task task, AppUser uploadedBy, String fileName, String contentType, byte[] fileData) {
        this.task = task;
        this.uploadedBy = uploadedBy;
        this.fileName = fileName;
        this.contentType = contentType;
        this.fileData = fileData;
        this.fileSize = fileData == null ? 0 : fileData.length;
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Task getTask() { return task; }
    public AppUser getUploadedBy() { return uploadedBy; }
    public String getFileName() { return fileName; }
    public String getContentType() { return contentType; }
    public long getFileSize() { return fileSize; }
    public byte[] getFileData() { return fileData; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
