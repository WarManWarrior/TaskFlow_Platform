package com.example.demo.repository; // CHANGE THIS TO MATCH YOUR ACTUAL PACKAGE

import com.example.demo.model.Task; // CHANGE THIS TO MATCH YOUR ACTUAL PACKAGE
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
}