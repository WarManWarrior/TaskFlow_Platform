package com.example.demo.model;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
@Entity @Table(name="task_activities")
public class TaskActivity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="task_id",nullable=false) @JsonIgnore private Task task;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="actor_id",nullable=false) @JsonIgnore private AppUser actor;
 @Column(name="activity_type",nullable=false,length=30) private String activityType;
 @Column(nullable=false,length=500) private String detail;
 @Column(name="created_at") private LocalDateTime createdAt;
 public TaskActivity(){}
 public TaskActivity(Task task,AppUser actor,String type,String detail){this.task=task;this.actor=actor;this.activityType=type;this.detail=detail;}
 @PrePersist protected void onCreate(){if(createdAt==null)createdAt=LocalDateTime.now();}
 public Long getId(){return id;} public Task getTask(){return task;} public AppUser getActor(){return actor;}
 public String getActivityType(){return activityType;} public String getDetail(){return detail;} public LocalDateTime getCreatedAt(){return createdAt;}
}
