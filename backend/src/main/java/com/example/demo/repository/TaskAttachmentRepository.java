package com.example.demo.repository;

import com.example.demo.model.TaskAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface TaskAttachmentRepository extends JpaRepository<TaskAttachment, Long> {
    Optional<TaskAttachment> findByIdAndTask_IdAndTask_Team_Id(Long id, Long taskId, Long teamId);

    @Query("select a.id as id, a.fileName as fileName, a.contentType as contentType, " +
        "a.fileSize as fileSize, a.createdAt as createdAt, t.id as taskId, u.name as uploadedByName " +
        "from TaskAttachment a join a.task t join a.uploadedBy u where t.team.id = :teamId " +
        "order by a.createdAt desc")
    List<AttachmentSummary> findSummariesByTeamId(@Param("teamId") Long teamId);

    interface AttachmentSummary {
        Long getId();
        String getFileName();
        String getContentType();
        Long getFileSize();
        LocalDateTime getCreatedAt();
        Long getTaskId();
        String getUploadedByName();
    }
}
