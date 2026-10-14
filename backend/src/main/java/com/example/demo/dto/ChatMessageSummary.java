package com.example.demo.dto;

import java.time.LocalDateTime;

public record ChatMessageSummary(
    Long id,
    Long teamId,
    String message,
    String imageName,
    LocalDateTime createdAt,
    Long senderId,
    String senderName,
    String senderEmail,
    String senderAvatarUrl
) {}
