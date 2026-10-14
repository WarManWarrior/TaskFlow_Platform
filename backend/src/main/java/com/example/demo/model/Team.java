package com.example.demo.model;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
@Entity
@Table(name="teams", uniqueConstraints=@UniqueConstraint(name="uk_teams_team_code", columnNames="team_code"))
public class Team {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(nullable=false,length=100) private String name;
 @Column(name="team_code",nullable=false,unique=true,length=16) private String teamCode;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="created_by_id",nullable=false) @JsonIgnore private AppUser createdBy;
 @Column(name="created_at",updatable=false) private LocalDateTime createdAt;
 public Team() {}
 public Team(String name,String code,AppUser owner){this.name=name;this.teamCode=code;this.createdBy=owner;}
 @PrePersist protected void onCreate(){if(createdAt==null)createdAt=LocalDateTime.now();}
 public Long getId(){return id;} public String getName(){return name;} public void setName(String v){name=v;}
 public String getTeamCode(){return teamCode;} public void setTeamCode(String v){teamCode=v;}
 public AppUser getCreatedBy(){return createdBy;} public void setCreatedBy(AppUser v){createdBy=v;}
 public LocalDateTime getCreatedAt(){return createdAt;}
}
