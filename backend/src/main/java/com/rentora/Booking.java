package com.rentora;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "bookings", indexes = @Index(name = "idx_booking_equipment_dates", columnList = "equipment_id,startDate,endDate"))
public class Booking {
    public enum Status { PENDING, APPROVED, REJECTED, CANCELLED, RETURNED }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @ManyToOne(fetch = FetchType.EAGER, optional = false) @JoinColumn(name = "user_id") UserAccount user;
    @ManyToOne(fetch = FetchType.EAGER, optional = false) @JoinColumn(name = "equipment_id") Equipment equipment;
    @Column(nullable = false) LocalDate startDate;
    @Column(nullable = false) LocalDate endDate;
    @Enumerated(EnumType.STRING) @Column(nullable = false) Status status = Status.PENDING;
    @Column(nullable = false, precision = 12, scale = 2) BigDecimal dailyRate;
    @Column(nullable = false, precision = 14, scale = 2) BigDecimal rentalAmount;
    @Column(nullable = false, precision = 14, scale = 2) BigDecimal lateFee = BigDecimal.ZERO;
    LocalDate returnedDate;
    @Column(nullable = false) Instant createdAt = Instant.now();
    protected Booking() {}
}
