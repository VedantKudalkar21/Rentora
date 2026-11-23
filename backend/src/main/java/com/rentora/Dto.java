package com.rentora;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class Dto {
    private Dto() {}
    public record RegisterRequest(@NotBlank @Size(min=2, max=80) String name,
            @NotBlank @Email @Size(max=120) String email, @NotBlank @Size(min=8,max=72) String password) {}
    public record LoginRequest(@NotBlank @Email @Size(max=120) String email, @NotBlank @Size(max=72) String password) {}
    public record GoogleRequest(@NotBlank @Size(max=10000) String credential,
            @NotBlank @Size(min=32,max=128) String nonce) {}
    public record AuthResponse(String accessToken, String tokenType, Instant expiresAt, UserView user) {}
    public record ProfileRequest(@NotBlank @Size(min=2,max=80) String name,
            @Size(max=20) @Pattern(regexp="[+0-9 ()-]*") String phone,
            @Size(max=80) String city, @Size(max=500) String bio) {}
    public record PasswordRequest(@Size(max=72) String currentPassword,
            @NotBlank @Size(min=8,max=72) String newPassword) {}
    public record ProfileView(Long id, String name, String email, UserAccount.Role role,
            String phone, String city, String bio, boolean googleLinked, boolean passwordLoginEnabled) {
        static ProfileView from(UserAccount u) {
            return new ProfileView(u.id,u.name,u.email,u.role,u.phone,u.city,u.bio,u.googleSubject!=null,u.passwordLoginEnabled);
        }
    }
    public record UserView(Long id, String name, String email, UserAccount.Role role) {
        static UserView from(UserAccount u) { return new UserView(u.id, u.name, u.email, u.role); }
    }
    public record EquipmentRequest(@NotBlank @Size(min=2,max=100) String name,
            @NotBlank @Pattern(regexp="Cameras|Tools|Outdoor|Electronics|Events") String category,
            @NotBlank @Size(max=1500) String description,
            @NotNull @DecimalMin("1.00") @DecimalMax("1000000.00") @Digits(integer=7,fraction=2) BigDecimal dailyRate) {}
    public record PhotoView(Long id, String url) {}
    public record EquipmentView(Long id, String name, String category, String description, BigDecimal dailyRate,
            boolean active, Equipment.ItemCondition itemCondition, String conditionNotes,
            List<PhotoView> photos, Long ownerId, String ownerName) {
        static EquipmentView from(Equipment e, List<PhotoView> photos) {
            return new EquipmentView(e.id,e.name,e.category,e.description,e.dailyRate,e.active,
                e.itemCondition,e.conditionNotes,photos,e.owner==null ? null : e.owner.id,
                e.owner==null ? "Rentora" : e.owner.name);
        }
    }
    public record ListingRequest(@NotBlank @Size(min=2,max=100) String name,
            @NotBlank @Pattern(regexp="Cameras|Tools|Outdoor|Electronics|Events") String category,
            @NotBlank @Size(max=1500) String description,
            @NotNull @DecimalMin("1.00") @DecimalMax("1000000.00") @Digits(integer=7,fraction=2) BigDecimal dailyRate,
            @NotNull Equipment.ItemCondition itemCondition,
            @NotBlank @Size(min=10,max=1000) String conditionNotes) {}
    public record ListingView(EquipmentView equipment, Equipment.ApprovalStatus status,
            String reviewNote, Instant submittedAt, String ownerEmail) {}
    public record RejectionRequest(@NotBlank @Size(min=5,max=500) String reason) {}
    public record ConditionRequest(@NotNull Equipment.ItemCondition itemCondition,
            @NotBlank @Size(min=10,max=1000) String conditionNotes) {}
    public record BookRequest(@NotNull @Positive Long equipmentId, @NotNull LocalDate startDate, @NotNull LocalDate endDate) {}
    public record ReturnRequest(@NotNull LocalDate returnedDate) {}
    public record ActiveRequest(boolean active) {}
    public record BookingView(Long id, Long equipmentId, String equipmentName, String category,
            String customerName, String customerEmail, LocalDate startDate, LocalDate endDate, long days,
            BigDecimal dailyRate, BigDecimal rentalAmount, BigDecimal lateFee, BigDecimal total,
            Booking.Status status, LocalDate returnedDate, Instant createdAt) {}
}
