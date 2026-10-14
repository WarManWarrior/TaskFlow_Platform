package com.example.demo.model;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
@Entity @Table(name="task_comments")
public class TaskComment {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="task_id",nullable=false) @JsonIgnore private Task task;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="author_id",nullable=false) @JsonIgnore private AppUser author;
 @Column(nullable=false,length=1000) private String body;
 @Column(name="created_at") private LocalDateTime createdAt;
 public TaskComment(){}
 public TaskComment(Task task,AppUser author,String body){this.task=task;this.author=author;this.body=body;}
 @PrePersist protected void onCreate(){if(createdAt==null)createdAt=LocalDateTime.now();}
 public Long getId(){return id;} public Task getTask(){return task;} public AppUser getAuthor(){return author;}
 public String getBody(){return body;} public LocalDateTime getCreatedAt(){return createdAt;}
}
