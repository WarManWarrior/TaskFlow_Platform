package com.example.demo.repository;
import com.example.demo.model.TeamMember;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
public interface TeamMemberRepository extends JpaRepository<TeamMember,Long>{
 List<TeamMember> findAllByUser_IdOrderByJoinedAtDesc(Long userId);
 List<TeamMember> findAllByTeam_IdOrderByJoinedAtAsc(Long teamId);
 Optional<TeamMember> findByTeam_IdAndUser_Id(Long teamId,Long userId);
 boolean existsByTeam_IdAndUser_Id(Long teamId,Long userId);
 long countByTeam_Id(Long teamId);
}
