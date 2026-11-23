package com.rentora;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface BookingRepository extends JpaRepository<Booking, Long> {
    @EntityGraph(attributePaths = {"user", "equipment"})
    List<Booking> findAllByOrderByCreatedAtDesc();
    @EntityGraph(attributePaths = {"user", "equipment"})
    List<Booking> findByUserIdOrderByCreatedAtDesc(Long userId);
    @Query("select count(b) from Booking b where b.equipment.id = :equipmentId and b.status in :statuses and b.startDate <= :end and b.endDate >= :start")
    long countOverlaps(@Param("equipmentId") Long equipmentId, @Param("start") LocalDate start,
                       @Param("end") LocalDate end, @Param("statuses") Collection<Booking.Status> statuses);
    boolean existsByEquipmentIdAndStatusInAndEndDateGreaterThanEqual(Long equipmentId, Collection<Booking.Status> statuses, LocalDate date);
}
