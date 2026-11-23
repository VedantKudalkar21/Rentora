package com.rentora;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "equipment")
public class Equipment {
    public enum ApprovalStatus { PENDING, APPROVED, REJECTED }
    public enum ItemCondition { LIKE_NEW, GOOD, FAIR }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Column(nullable = false, length = 100) String name;
    @Column(nullable = false, length = 40) String category;
    @Column(nullable = false, length = 1500) String description;
    @Column(nullable = false, precision = 12, scale = 2) BigDecimal dailyRate;
    @Column(nullable = false) boolean active = true;
    @ManyToOne(fetch = FetchType.EAGER) @JoinColumn(name = "owner_id") UserAccount owner;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(20) default 'APPROVED'")
    ApprovalStatus approvalStatus = ApprovalStatus.APPROVED;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(20) default 'GOOD'")
    ItemCondition itemCondition = ItemCondition.GOOD;
    @Column(length = 1000) String conditionNotes;
    @Column(length = 500) String reviewNote;
    Instant submittedAt;
    protected Equipment() {}
    Equipment(String name, String category, String description, BigDecimal dailyRate) {
        this.name = name; this.category = category; this.description = description; this.dailyRate = dailyRate;
    }
}
