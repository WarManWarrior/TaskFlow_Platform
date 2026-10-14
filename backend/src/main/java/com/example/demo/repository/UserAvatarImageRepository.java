package com.example.demo.repository;

import com.example.demo.model.UserAvatarImage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserAvatarImageRepository extends JpaRepository<UserAvatarImage, Long> {
    Optional<UserAvatarImage> findByUser_Id(Long userId);
    void deleteByUser_Id(Long userId);
}
