package com.example.demo.repository;

import com.example.demo.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    List<Project> findAllByTeam_IdOrderByCreatedAtDesc(Long teamId);
    Optional<Project> findByIdAndTeam_Id(Long id, Long teamId);
}
