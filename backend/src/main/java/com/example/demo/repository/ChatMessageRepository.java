package com.example.demo.repository;

import com.example.demo.model.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findTop100ByTeam_IdOrderByCreatedAtDesc(Long teamId);
    Optional<ChatMessage> findByIdAndTeam_Id(Long id, Long teamId);
}
