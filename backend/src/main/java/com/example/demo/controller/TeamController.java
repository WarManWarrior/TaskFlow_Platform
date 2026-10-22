package com.example.demo.controller;

import com.example.demo.model.*;
import com.example.demo.dto.ChatMessageSummary;
import org.springframework.data.domain.PageRequest;
import com.example.demo.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.Base64;

@RestController
@RequestMapping("/api/teams")
public class TeamController {
    private static final Set<String> STATUSES = Set.of("TODO", "IN_PROGRESS", "DONE");
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final String[] COLORS = {"#9B8AFB","#F59E0B","#34D399","#60A5FA","#F472B6","#FB7185","#22D3EE","#A3E635","#C084FC","#F97316"};
    private static final long MAX_TASK_ATTACHMENT_BYTES = 1024L * 1024L;
    private static final Set<String> ALLOWED_TASK_FILE_TYPES = Set.of(
        "application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain",
        "application/msword", "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    private static final String[] ANIMAL_AVATARS = {"/avatars/doodle-fox.svg","/avatars/doodle-cat.svg","/avatars/doodle-dog.svg","/avatars/doodle-rabbit.svg","/avatars/doodle-panda.svg","/avatars/doodle-penguin.svg","/avatars/doodle-frog.svg","/avatars/doodle-raccoon.svg"};
    private static final Pattern IMAGE_DATA_URL = Pattern.compile("^data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$");
    private static final SecureRandom RANDOM = new SecureRandom();
    private final AppUserRepository users;
    private final TeamRepository teams;
    private final TeamMemberRepository members;
    private final TaskRepository tasks;
    private final TaskCommentRepository comments;
    private final TaskActivityRepository activities;
    private final ChatMessageRepository chatMessages;
    private final ProjectRepository projects;
    private final TaskAttachmentRepository attachments;

    public TeamController(AppUserRepository users, TeamRepository teams, TeamMemberRepository members, TaskRepository tasks, TaskCommentRepository comments, TaskActivityRepository activities, ChatMessageRepository chatMessages, ProjectRepository projects, TaskAttachmentRepository attachments) {
        this.users=users; this.teams=teams; this.members=members; this.tasks=tasks; this.comments=comments; this.activities=activities; this.chatMessages=chatMessages; this.projects=projects; this.attachments=attachments;
    }

    @GetMapping @Transactional(readOnly=true)
    public List<Map<String,Object>> listTeams(Authentication auth) {
        AppUser user=currentUser(auth);
        return members.findAllByUser_IdOrderByJoinedAtDesc(user.getId()).stream().map(m -> teamMap(m,members.countByTeam_Id(m.getTeam().getId()))).toList();
    }
    @PostMapping @Transactional
    public Map<String,Object> createTeam(@RequestBody Map<String,String> body, Authentication auth) {
        AppUser user=currentUser(auth); String name=trim(body.get("name"));
        if(name.isBlank()||name.length()>100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Team name must be between 1 and 100 characters.");
        Team team=teams.save(new Team(name,generateCode(),user)); TeamMember owner=members.save(new TeamMember(team,user,"OWNER"));
        return teamMap(owner,1);
    }
    @PostMapping("/join") @Transactional
    public Map<String,Object> joinTeam(@RequestBody Map<String,String> body, Authentication auth) {
        AppUser user=currentUser(auth); String raw=trim(body.get("code")).toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]","");
        if(raw.length()!=8) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter the 8-character team code.");
        String code=raw.substring(0,4)+"-"+raw.substring(4);
        Team team=teams.findByTeamCodeIgnoreCase(code).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"No team found with that code."));
        if(!members.existsByTeam_IdAndUser_Id(team.getId(),user.getId())) members.save(new TeamMember(team,user,"MEMBER"));
        TeamMember membership=members.findByTeam_IdAndUser_Id(team.getId(),user.getId()).orElseThrow();
        return teamMap(membership,members.countByTeam_Id(team.getId()));
    }
    @GetMapping("/{teamId}/members") @Transactional(readOnly=true)
    public List<Map<String,Object>> listMembers(@PathVariable Long teamId, Authentication auth) {
        requireMembership(teamId,currentUser(auth));
        return members.findAllByTeam_IdOrderByJoinedAtAsc(teamId).stream().map(m -> {
            Map<String,Object> item=new LinkedHashMap<>();
            item.put("user",userMap(m.getUser())); item.put("role",m.getRole()); item.put("joinedAt",time(m.getJoinedAt())); return item;
        }).toList();
    }
    @GetMapping("/{teamId}/tasks") @Transactional(readOnly=true)
    public List<Map<String,Object>> listTeamTasks(@PathVariable Long teamId, @RequestParam(required=false) Long projectId, Authentication auth) {
        requireMembership(teamId,currentUser(auth));
        List<Task> result;
        if (projectId == null) {
            result = tasks.findAllByTeam_IdOrderByCreatedAtDesc(teamId);
        } else {
            if (projects.findByIdAndTeam_Id(projectId, teamId).isEmpty()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found for this team.");
            }
            result = tasks.findAllByTeam_IdAndProject_IdOrderByCreatedAtDesc(teamId, projectId);
        }
        return result.stream().map(this::taskMap).toList();
    }
    @GetMapping("/{teamId}/attachments") @Transactional(readOnly=true)
    public List<Map<String,Object>> listTeamAttachments(@PathVariable Long teamId, Authentication auth) {
        requireMembership(teamId, currentUser(auth));
        return attachments.findSummariesByTeamId(teamId).stream().map(item -> {
            Map<String,Object> result = new LinkedHashMap<>();
            result.put("id", item.getId());
            result.put("taskId", item.getTaskId());
            result.put("fileName", item.getFileName());
            result.put("contentType", item.getContentType());
            result.put("fileSize", item.getFileSize());
            result.put("createdAt", time(item.getCreatedAt()));
            result.put("uploadedByName", item.getUploadedByName());
            result.put("url", "/api/teams/" + teamId + "/tasks/" + item.getTaskId() + "/attachments/" + item.getId() + "/file");
            return result;
        }).toList();
    }

    @PostMapping("/{teamId}/tasks") @Transactional
    public Map<String,Object> createTeamTask(@PathVariable Long teamId,@RequestBody Map<String,String> body,Authentication auth) {
        AppUser actor=currentUser(auth); Team team=requireMembership(teamId,actor);
        String title=trim(body.get("title")), description=trim(body.get("description"));
        if(title.isBlank()||title.length()>120) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Task title must be between 1 and 120 characters.");
        if(description.length()>1000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Description must be 1000 characters or fewer.");
        Task task=new Task(title,description,"TODO"); task.setTeam(team); task.setUser(actor); task.setUpdatedBy(actor);
        task.setProject(resolveProject(teamId, body.get("projectId")));
        task.setStartDate(parseDate(body.get("startDate"), "startDate"));
        task.setDueDate(parseDate(body.get("dueDate"), "dueDate"));
        validateTaskDates(task.getStartDate(), task.getDueDate());
        task.setAssignee(resolveAssignee(teamId, body.get("assigneeId")));
        task=tasks.save(task);
        String detail = task.getProject() == null ? "created this shared task" : "created a task in project " + task.getProject().getName();
        activities.save(new TaskActivity(task,actor,"TASK_CREATED",detail)); return taskMap(task);
    }
    @PostMapping("/{teamId}/tasks/{taskId}/attachments") @Transactional
    public Map<String,Object> uploadTaskAttachment(@PathVariable Long teamId, @PathVariable Long taskId,
            @RequestBody Map<String,String> body, Authentication auth) {
        AppUser actor = currentUser(auth);
        requireMembership(teamId, actor);
        Task task = requireTeamTask(teamId, taskId);
        String fileName = safeAttachmentName(body.get("fileName"));
        String contentType = body.get("contentType") == null ? "" : body.get("contentType").trim().toLowerCase(Locale.ROOT);
        String encoded = body.get("data");
        if (!ALLOWED_TASK_FILE_TYPES.contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a PDF, image, text, Word, Excel, or PowerPoint file.");
        }
        if (encoded == null || encoded.isBlank() || encoded.length() > (MAX_TASK_ATTACHMENT_BYTES * 4 / 3) + 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Files must be 1 MB or smaller.");
        }
        byte[] data;
        try { data = Base64.getDecoder().decode(encoded); }
        catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That file could not be read.");
        }
        if (data.length == 0 || data.length > MAX_TASK_ATTACHMENT_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Files must be between 1 byte and 1 MB.");
        }
        String lowerName = fileName.toLowerCase(Locale.ROOT);
        boolean validExtension = Set.of(".pdf", ".png", ".jpg", ".jpeg", ".webp", ".txt", ".doc", ".docx", ".xls", ".xlsx", ".pptx")
            .stream().anyMatch(lowerName::endsWith);
        if (!validExtension) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a supported document or image file.");
        TaskAttachment saved = attachments.save(new TaskAttachment(task, actor, fileName, contentType, data));
        activities.save(new TaskActivity(task, actor, "FILE_ATTACHED", "attached source file " + fileName));
        return attachmentMap(saved, teamId);
    }

    @GetMapping("/{teamId}/tasks/{taskId}/attachments/{attachmentId}/file")
    @Transactional(readOnly=true)
    public ResponseEntity<byte[]> downloadTaskAttachment(@PathVariable Long teamId, @PathVariable Long taskId,
            @PathVariable Long attachmentId, Authentication auth) {
        requireMembership(teamId, currentUser(auth));
        TaskAttachment file = attachments.findByIdAndTask_IdAndTask_Team_Id(attachmentId, taskId, teamId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Source file not found."));
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.getFileName() + "\"")
            .header(HttpHeaders.CACHE_CONTROL, "private, max-age=300")
            .header("X-Content-Type-Options", "nosniff")
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .body(file.getFileData());
    }

    @DeleteMapping("/{teamId}/tasks/{taskId}/attachments/{attachmentId}")
    @Transactional
    public ResponseEntity<Void> deleteTaskAttachment(@PathVariable Long teamId, @PathVariable Long taskId,
            @PathVariable Long attachmentId, Authentication auth) {
        AppUser actor = currentUser(auth);
        requireMembership(teamId, actor);
        Task task = requireTeamTask(teamId, taskId);
        TaskAttachment file = attachments.findByIdAndTask_IdAndTask_Team_Id(attachmentId, taskId, teamId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Source file not found."));
        attachments.delete(file);
        activities.save(new TaskActivity(task, actor, "FILE_REMOVED", "removed source file " + file.getFileName()));
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{teamId}/tasks/{taskId}") @Transactional
    public Map<String,Object> updateTeamTask(@PathVariable Long teamId,@PathVariable Long taskId,@RequestBody Map<String,String> body,Authentication auth) {
        AppUser actor=currentUser(auth); requireMembership(teamId,actor);
        Task task=tasks.findByIdAndTeam_Id(taskId,teamId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Team task not found."));
        boolean statusProvided=body.containsKey("status");
        boolean projectProvided=body.containsKey("projectId");
        boolean startDateProvided=body.containsKey("startDate");
        boolean dueDateProvided=body.containsKey("dueDate");
        boolean assigneeProvided=body.containsKey("assigneeId");
        boolean progressProvided=body.containsKey("progress");
        if(!statusProvided && !projectProvided && !startDateProvided && !dueDateProvided && !assigneeProvided && !progressProvided)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Provide a task field to update.");
        String oldStatus=task.getStatus();
        Long oldProjectId=task.getProject()==null?null:task.getProject().getId();
        if(statusProvided) {
            String next=body.get("status");
            if(next==null||!STATUSES.contains(next)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a valid task status.");
            task.setStatus(next);
        }
        if(projectProvided) task.setProject(resolveProject(teamId,body.get("projectId")));
        if(startDateProvided) task.setStartDate(parseDate(body.get("startDate"), "startDate"));
        if(dueDateProvided) task.setDueDate(parseDate(body.get("dueDate"), "dueDate"));
        validateTaskDates(task.getStartDate(), task.getDueDate());
        if(assigneeProvided) task.setAssignee(resolveAssignee(teamId, body.get("assigneeId")));
        if (progressProvided) {
            int nextProgress;
            try { nextProgress = Integer.parseInt(body.get("progress")); }
            catch (RuntimeException ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Progress must be a whole number from 0 to 100."); }
            if (nextProgress < 0 || nextProgress > 100)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Progress must be between 0 and 100.");
            task.setProgress(nextProgress);
            if (!statusProvided) {
                task.setStatus(nextProgress == 100 ? "DONE" : nextProgress == 0 ? "TODO" : "IN_PROGRESS");
            }
        } else if (statusProvided) {
            if ("DONE".equals(task.getStatus())) task.setProgress(100);
            else if ("TODO".equals(task.getStatus())) task.setProgress(0);
            else if (task.getProgress() == null || task.getProgress() == 0) task.setProgress(50);
        }
        task.setUpdatedBy(actor); task=tasks.save(task);
        if(statusProvided && !Objects.equals(oldStatus,task.getStatus())) {
            activities.save(new TaskActivity(task,actor,"STATUS_CHANGED","moved this task from "+statusLabel(oldStatus)+" to "+statusLabel(task.getStatus())));
        }
        Long newProjectId=task.getProject()==null?null:task.getProject().getId();
        if(projectProvided && !Objects.equals(oldProjectId,newProjectId)) {
            String projectName=task.getProject()==null?"the unassigned task list": "project "+task.getProject().getName();
            activities.save(new TaskActivity(task,actor,"PROJECT_CHANGED","moved this task to "+projectName));
        }
        return taskMap(task);
    }
    @GetMapping("/{teamId}/tasks/{taskId}/comments") @Transactional(readOnly=true)
    public List<Map<String,Object>> listComments(@PathVariable Long teamId,@PathVariable Long taskId,Authentication auth) {
        requireMembership(teamId,currentUser(auth)); requireTeamTask(teamId,taskId);
        return comments.findAllByTask_IdOrderByCreatedAtAsc(taskId).stream().map(c -> {
            Map<String,Object> item=new LinkedHashMap<>();
            item.put("id",c.getId()); item.put("body",c.getBody()); item.put("createdAt",time(c.getCreatedAt())); item.put("author",userMap(c.getAuthor())); return item;
        }).toList();
    }
    @PostMapping("/{teamId}/tasks/{taskId}/comments") @Transactional
    public Map<String,Object> addComment(@PathVariable Long teamId,@PathVariable Long taskId,@RequestBody Map<String,String> body,Authentication auth) {
        AppUser actor=currentUser(auth); requireMembership(teamId,actor); Task task=requireTeamTask(teamId,taskId);
        String text=trim(body.get("body"));
        if(text.isBlank()||text.length()>1000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Comment must be between 1 and 1000 characters.");
        TaskComment comment=comments.save(new TaskComment(task,actor,text));
        activities.save(new TaskActivity(task,actor,"COMMENT_ADDED","commented: "+truncate(text,380)));
        Map<String,Object> item=new LinkedHashMap<>();
        item.put("id",comment.getId()); item.put("body",comment.getBody()); item.put("createdAt",time(comment.getCreatedAt())); item.put("author",userMap(actor)); return item;
    }
    @GetMapping("/{teamId}/activity") @Transactional(readOnly=true)
    public List<Map<String,Object>> getActivity(@PathVariable Long teamId,Authentication auth) {
        requireMembership(teamId,currentUser(auth));
        return activities.findTop50ByTask_Team_IdOrderByCreatedAtDesc(teamId).stream().map(a -> {
            Map<String,Object> item=new LinkedHashMap<>();
            item.put("id",a.getId()); item.put("activityType",a.getActivityType()); item.put("detail",a.getDetail());
            item.put("createdAt",time(a.getCreatedAt())); item.put("actor",userMap(a.getActor()));
            item.put("taskId",a.getTask().getId()); item.put("taskTitle",a.getTask().getTitle()); return item;
        }).toList();
    }


    @GetMapping("/{teamId}/messages")
    @Transactional(readOnly = true)
    public List<Map<String,Object>> getChatMessages(@PathVariable Long teamId, Authentication auth) {
        requireMembership(teamId, currentUser(auth));
        return chatMessages.findRecentSummariesByTeam(teamId, PageRequest.of(0, 100)).stream()
            .sorted(Comparator.comparing(ChatMessageSummary::createdAt))
            .map(this::chatMessageSummaryMap).toList();
    }

    @PostMapping("/{teamId}/messages")
    @Transactional
    public Map<String,Object> sendChatMessage(@PathVariable Long teamId, @RequestBody Map<String,String> body, Authentication auth) {
        AppUser sender = currentUser(auth);
        Team team = requireMembership(teamId, sender);
        String text = trim(body.get("message"));
        String imageData = body.get("imageData");
        if (text.length() > 2000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chat messages must be 2,000 characters or fewer.");
        if (imageData != null && !imageData.isBlank()) {
            if (imageData.length() > 2_800_000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Images must be 2 MB or smaller after compression.");
            Matcher matcher = IMAGE_DATA_URL.matcher(imageData);
            if (!matcher.matches()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Upload a PNG, JPG, or WebP image.");
            try {
                byte[] data = Base64.getDecoder().decode(matcher.group(2));
                if (data.length > 2 * 1024 * 1024) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Images must be 2 MB or smaller after compression.");
            } catch (IllegalArgumentException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That image could not be read.");
            }
        } else {
            imageData = null;
        }
        if (text.isBlank() && imageData == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Write a message or attach an image.");
        String imageName = imageData == null ? null : safeImageName(body.get("imageName"));
        ChatMessage message = chatMessages.save(new ChatMessage(team, sender, text, imageData, imageName));
        return chatMessageMap(teamId, message);
    }

    @GetMapping("/{teamId}/messages/{messageId}/image")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> getChatImage(@PathVariable Long teamId, @PathVariable Long messageId, Authentication auth) {
        requireMembership(teamId, currentUser(auth));
        ChatMessage message = chatMessages.findByIdAndTeam_Id(messageId, teamId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat image not found."));
        String imageData = message.getImageData();
        Matcher matcher = imageData == null ? IMAGE_DATA_URL.matcher("") : IMAGE_DATA_URL.matcher(imageData);
        if (imageData == null || !matcher.matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat image not found.");
        byte[] bytes;
        try { bytes = Base64.getDecoder().decode(matcher.group(2)); }
        catch (IllegalArgumentException ex) { throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat image is invalid."); }
        return ResponseEntity.ok()
            .header(HttpHeaders.CACHE_CONTROL, "private, max-age=300")
            .contentType(MediaType.parseMediaType(matcher.group(1)))
            .body(bytes);
    }

    private Map<String,Object> chatMessageMap(Long teamId, ChatMessage message) {
        return messageMap(teamId, message.getId(), message.getMessage(), message.getImageData() == null ? null : message.getImageName(),
            message.getCreatedAt(), message.getSender().getId(), message.getSender().getName(), message.getSender().getEmail(), message.getSender().getAvatarUrl());
    }

    private Map<String,Object> chatMessageSummaryMap(ChatMessageSummary message) {
        return messageMap(message.teamId(), message.id(), message.message(), message.imageName(), message.createdAt(),
            message.senderId(), message.senderName(), message.senderEmail(), message.senderAvatarUrl());
    }

    private Map<String,Object> messageMap(Long teamId, Long id, String text, String imageName, java.time.LocalDateTime createdAt,
            Long senderId, String senderName, String senderEmail, String senderAvatarUrl) {
        Map<String,Object> item = new LinkedHashMap<>();
        item.put("id", id);
        item.put("message", text);
        item.put("imageName", imageName == null ? "" : imageName);
        item.put("imageUrl", imageName == null ? "" : "/api/teams/" + teamId + "/messages/" + id + "/image");
        item.put("createdAt", time(createdAt));
        int index = Math.floorMod(senderId == null ? 0 : senderId.intValue(), COLORS.length);
        Map<String,Object> sender = new LinkedHashMap<>();
        sender.put("id", senderId); sender.put("name", senderName); sender.put("email", senderEmail);
        sender.put("avatarUrl", effectiveAvatarUrl(senderId, senderAvatarUrl)); sender.put("avatarColor", COLORS[index]);
        item.put("sender", sender);
        return item;
    }

    private String safeImageName(String supplied) {
        if (supplied == null || supplied.isBlank()) return "shared-image";
        String name = supplied.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[^A-Za-z0-9._ -]", "_").trim();
        if (name.isBlank()) return "shared-image";
        return name.substring(0, Math.min(name.length(), 160));
    }

    private Team requireMembership(Long id,AppUser user) {
        Team team=teams.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Team not found."));
        if(!members.existsByTeam_IdAndUser_Id(id,user.getId())) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Join this team to access it.");
        return team;
    }
    private Task requireTeamTask(Long teamId,Long taskId) {
        return tasks.findByIdAndTeam_Id(taskId,teamId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Team task not found."));
    }
    private Map<String,Object> attachmentMap(TaskAttachment file, Long teamId) {
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("id", file.getId());
        result.put("taskId", file.getTask().getId());
        result.put("fileName", file.getFileName());
        result.put("contentType", file.getContentType());
        result.put("fileSize", file.getFileSize());
        result.put("createdAt", time(file.getCreatedAt()));
        result.put("uploadedByName", file.getUploadedBy().getName());
        result.put("url", "/api/teams/" + teamId + "/tasks/" + file.getTask().getId() + "/attachments/" + file.getId() + "/file");
        return result;
    }
    private String safeAttachmentName(String raw) {
        if (raw == null || raw.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a file.");
        String name = raw.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[^A-Za-z0-9._ -]", "_").trim();
        if (name.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid file name.");
        return name.substring(0, Math.min(name.length(), 160));
    }
    private Project resolveProject(Long teamId,String rawProjectId) {
        if(rawProjectId==null || rawProjectId.isBlank()) return null;
        try {
            Long projectId=Long.valueOf(rawProjectId.trim());
            return projects.findByIdAndTeam_Id(projectId,teamId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Project not found for this team."));
        } catch(NumberFormatException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a valid project.");
        }
    }
    private AppUser resolveAssignee(Long teamId, String rawAssigneeId) {
        if (rawAssigneeId == null || rawAssigneeId.isBlank()) return null;
        try {
            Long userId = Long.valueOf(rawAssigneeId.trim());
            return members.findByTeam_IdAndUser_Id(teamId, userId).map(TeamMember::getUser)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Choose a member of this team as the assignee."));
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid assignee.");
        }
    }
    private LocalDate parseDate(String raw, String field) {
        if (raw == null || raw.isBlank()) return null;
        try { return LocalDate.parse(raw.trim()); }
        catch (DateTimeParseException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must be a valid date.");
        }
    }
    private void validateTaskDates(LocalDate start, LocalDate due) {
        if (start != null && due != null && start.isAfter(due))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Task start date must be on or before its due date.");
    }
    private AppUser currentUser(Authentication auth) {
        if(auth==null||auth.getName()==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Please sign in.");
        return users.findByEmailIgnoreCase(auth.getName()).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Account not found."));
    }
    private Map<String,Object> teamMap(TeamMember member,long count) {
        Team t=member.getTeam(); Map<String,Object> m=new LinkedHashMap<>();
        m.put("id",t.getId()); m.put("name",t.getName()); m.put("teamCode",t.getTeamCode()); m.put("role",member.getRole());
        m.put("memberCount",count); m.put("createdAt",time(t.getCreatedAt())); m.put("createdBy",userMap(t.getCreatedBy())); return m;
    }
    private Map<String,Object> taskMap(Task t) {
        Map<String,Object> m=new LinkedHashMap<>();
        m.put("id",t.getId()); m.put("title",t.getTitle()); m.put("description",t.getDescription()); m.put("status",t.getStatus());
        m.put("createdAt",time(t.getCreatedAt())); m.put("updatedAt",time(t.getUpdatedAt()));
        m.put("createdBy",userMap(t.getUser())); m.put("updatedBy",userMap(t.getUpdatedBy())); m.put("teamId",t.getTeam()==null?null:t.getTeam().getId());
        m.put("projectId",t.getProject()==null?null:t.getProject().getId());
        m.put("projectName",t.getProject()==null?null:t.getProject().getName());
        m.put("startDate", t.getStartDate() == null ? null : t.getStartDate().toString());
        m.put("dueDate", t.getDueDate() == null ? null : t.getDueDate().toString());
        Integer progress = t.getProgress();
        if (progress == null) progress = "DONE".equals(t.getStatus()) ? 100 : "IN_PROGRESS".equals(t.getStatus()) ? 50 : 0;
        m.put("progress", progress);
        m.put("assignee", userMap(t.getAssignee()));
        return m;
    }
    private Map<String,Object> userMap(AppUser u) {
        if(u==null)return null; int index=Math.floorMod(u.getId()==null?0:u.getId().intValue(),COLORS.length);
        Map<String,Object> m=new LinkedHashMap<>(); m.put("id",u.getId()); m.put("name",u.getName()); m.put("email",u.getEmail());
        m.put("avatarUrl",effectiveAvatarUrl(u)); m.put("avatarColor",COLORS[index]); return m;
    }
    private String effectiveAvatarUrl(AppUser user) {
        return effectiveAvatarUrl(user.getId(), user.getAvatarUrl());
    }
    private String effectiveAvatarUrl(Long userId, String saved) {
        if (saved != null && !saved.isBlank()) return saved;
        return ANIMAL_AVATARS[Math.floorMod(userId == null ? 0 : userId.intValue(), ANIMAL_AVATARS.length)];
    }
    private String generateCode() {
        for(int n=0;n<20;n++) {
            StringBuilder b=new StringBuilder(8); for(int i=0;i<8;i++)b.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
            String raw=b.toString(),code=raw.substring(0,4)+"-"+raw.substring(4);
            if(teams.findByTeamCodeIgnoreCase(code).isEmpty())return code;
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,"Could not generate a unique code. Try again.");
    }
    private String statusLabel(String s){return switch(s){case "TODO"->"To do";case "IN_PROGRESS"->"In progress";case "DONE"->"Done";default->"unknown";};}
    private String time(java.time.LocalDateTime t){return t==null?"":t.toString();}
    private String trim(String s){return s==null?"":s.trim();}
    private String truncate(String s,int max){return s.length()<=max?s:s.substring(0,max-1)+"…";}
}
