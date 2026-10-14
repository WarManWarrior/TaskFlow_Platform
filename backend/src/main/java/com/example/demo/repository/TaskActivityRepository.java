package com.example.demo.repository;
import com.example.demo.model.TaskActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface TaskActivityRepository extends JpaRepository<TaskActivity,Long>{ List<TaskActivity> findTop50ByTask_Team_IdOrderByCreatedAtDesc(Long teamId); }
