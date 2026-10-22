package com.example.demo.repository;

import com.example.demo.model.AppUser;
import com.example.demo.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findAllByUser_IdAndTeamIsNullOrderByIdDesc(Long userId);
    Optional<Task> findByIdAndUser_IdAndTeamIsNull(Long id, Long userId);
    List<Task> findAllByTeam_IdOrderByCreatedAtDesc(Long teamId);
    List<Task> findAllByTeam_IdAndProject_IdOrderByCreatedAtDesc(Long teamId, Long projectId);
    Optional<Task> findByIdAndTeam_Id(Long id, Long teamId);
    long countByProject_Id(Long projectId);
    @Modifying
    @Query("update Task task set task.user = :user where task.user is null")
    int assignUnownedTasksToUser(@Param("user") AppUser user);
}
