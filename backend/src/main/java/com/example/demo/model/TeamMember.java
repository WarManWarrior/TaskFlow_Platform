package com.example.demo.model;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
@Entity
@Table(name="team_members",uniqueConstraints=@UniqueConstraint(name="uk_team_members_team_user",columnNames={"team_id","user_id"}))
public class TeamMember {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="team_id",nullable=false) @JsonIgnore private Team team;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="user_id",nullable=false) @JsonIgnore private AppUser user;
 @Column(nullable=false,length=20) private String role="MEMBER";
 @Column(name="joined_at",updatable=false) private LocalDateTime joinedAt;
 public TeamMember(){}
 public TeamMember(Team team,AppUser user,String role){this.team=team;this.user=user;this.role=role;}
 @PrePersist protected void onCreate(){if(joinedAt==null)joinedAt=LocalDateTime.now();}
 public Long getId(){return id;} public Team getTeam(){return team;} public AppUser getUser(){return user;}
 public String getRole(){return role;} public LocalDateTime getJoinedAt(){return joinedAt;}
}
