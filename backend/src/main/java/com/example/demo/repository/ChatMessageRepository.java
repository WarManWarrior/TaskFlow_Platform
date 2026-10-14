package com.example.demo.repository;

import com.example.demo.model.ChatMessage;
import com.example.demo.dto.ChatMessageSummary;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    @Query("select new com.example.demo.dto.ChatMessageSummary(m.id, m.team.id, m.message, m.imageName, m.createdAt, m.sender.id, m.sender.name, m.sender.email, m.sender.avatarUrl) from ChatMessage m where m.team.id = :teamId order by m.createdAt desc")
    List<ChatMessageSummary> findRecentSummariesByTeam(@Param("teamId") Long teamId, Pageable pageable);
    Optional<ChatMessage> findByIdAndTeam_Id(Long id, Long teamId);
}
