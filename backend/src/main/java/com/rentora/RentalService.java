package com.rentora;

import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RentalService {
    private static final List<Booking.Status> RESERVED = List.of(Booking.Status.PENDING, Booking.Status.APPROVED);
    private final EquipmentRepository equipment;
    private final BookingRepository bookings;
    private final Clock clock;
    private final EquipmentListingService listings;
    RentalService(EquipmentRepository equipment, BookingRepository bookings, Clock clock, EquipmentListingService listings) {
        this.equipment = equipment; this.bookings = bookings; this.clock = clock; this.listings = listings;
    }
    @Transactional(readOnly = true)
    public List<Dto.EquipmentView> catalogue() { return equipment.findByApprovalStatusOrderByIdDesc(Equipment.ApprovalStatus.APPROVED).stream().map(listings::view).toList(); }
    @Transactional(readOnly = true)
    public Map<String,Object> availability(Long id, LocalDate start, LocalDate end) {
        validateDates(start,end);
        Equipment e = equipment.findById(id).orElseThrow(() -> error(404,"Equipment not found."));
        if(e.approvalStatus!=Equipment.ApprovalStatus.APPROVED) throw error(404,"Equipment not found.");
        boolean available = e.active && bookings.countOverlaps(id,start,end,RESERVED) == 0;
        return Map.of("available",available,"days",days(start,end),"total",e.dailyRate.multiply(BigDecimal.valueOf(days(start,end))));
    }
    @Transactional
    public Dto.BookingView book(UserAccount user, Dto.BookRequest req) {
        if (user.role != UserAccount.Role.CUSTOMER) throw error(403,"Use a customer account to rent equipment.");
        validateDates(req.startDate(),req.endDate());
        // Lock the physical item before checking dates; concurrent requests must wait.
        Equipment e = locked(req.equipmentId());
        if(e.approvalStatus!=Equipment.ApprovalStatus.APPROVED) throw error(404,"Equipment not found.");
        if(e.owner!=null && e.owner.id.equals(user.id)) throw error(409,"You cannot rent your own equipment.");
        if (!e.active) throw error(409,"This item is currently under maintenance.");
        if (bookings.countOverlaps(e.id,req.startDate(),req.endDate(),RESERVED) > 0)
            throw error(409,"This item is already reserved for those dates. Choose different dates.");
        Booking b = new Booking();
        b.user=user; b.equipment=e; b.startDate=req.startDate(); b.endDate=req.endDate();
        b.dailyRate=e.dailyRate; b.rentalAmount=e.dailyRate.multiply(BigDecimal.valueOf(days(b.startDate,b.endDate)));
        return view(bookings.save(b));
    }
    @Transactional(readOnly = true)
    public List<Dto.BookingView> mine(UserAccount user) { return bookings.findByUserIdOrderByCreatedAtDesc(user.id).stream().map(this::view).toList(); }
    @Transactional(readOnly = true)
    public List<Dto.BookingView> all() { return bookings.findAllByOrderByCreatedAtDesc().stream().map(this::view).toList(); }
    @Transactional
    public Dto.BookingView cancel(Long id, UserAccount user) {
        Booking b = lockedBooking(id);
        if (!b.user.id.equals(user.id)) throw error(403,"You can only cancel your own bookings.");
        if (b.status != Booking.Status.PENDING && b.status != Booking.Status.APPROVED) throw error(409,"This booking cannot be cancelled.");
        if (b.startDate.isBefore(today())) throw error(409,"A rental that has already started cannot be cancelled.");
        b.status=Booking.Status.CANCELLED;
        return view(b);
    }
    @Transactional
    public Dto.BookingView decide(Long id, boolean approve) {
        Booking b = lockedBooking(id);
        if (b.status != Booking.Status.PENDING) throw error(409,"Only pending bookings can be approved or rejected.");
        if (approve && b.startDate.isBefore(today())) throw error(409,"This request has expired. Reject it and ask the customer to book new dates.");
        if (approve && !b.equipment.active) throw error(409,"This item is under maintenance.");
        b.status = approve ? Booking.Status.APPROVED : Booking.Status.REJECTED;
        return view(b);
    }
    @Transactional
    public Dto.BookingView recordReturn(Long id, LocalDate returnedDate) {
        Booking b = lockedBooking(id);
        if (b.status != Booking.Status.APPROVED) throw error(409,"Only approved rentals can be returned.");
        if (returnedDate == null || returnedDate.isBefore(b.startDate) || returnedDate.isAfter(today()))
            throw error(400,"Return date must be between the rental start date and today.");
        b.returnedDate=returnedDate;
        long overdueDays=Math.max(0,ChronoUnit.DAYS.between(b.endDate,returnedDate));
        b.lateFee=b.dailyRate.multiply(BigDecimal.valueOf(overdueDays));
        b.status=Booking.Status.RETURNED;
        return view(b);
    }
    @Transactional
    public Dto.EquipmentView saveEquipment(Long id, Dto.EquipmentRequest req) {
        Equipment e = id == null ? new Equipment() : locked(id);
        e.name=req.name().strip(); e.category=req.category(); e.description=req.description().strip(); e.dailyRate=req.dailyRate();
        return listings.view(equipment.save(e));
    }
    @Transactional
    public Dto.EquipmentView setActive(Long id, boolean active) {
        Equipment e = locked(id);
        if (!active && bookings.existsByEquipmentIdAndStatusInAndEndDateGreaterThanEqual(id,RESERVED,today()))
            throw error(409,"Cancel or reject upcoming reservations before marking this item under maintenance.");
        if (!active && bookings.findAllByOrderByCreatedAtDesc().stream().anyMatch(b -> b.equipment.id.equals(id) && b.status==Booking.Status.APPROVED))
            throw error(409,"Record outstanding returns before marking this item under maintenance.");
        if(active && e.approvalStatus!=Equipment.ApprovalStatus.APPROVED) throw error(409,"Approve the customer listing before making it available.");
        e.active=active;
        return listings.view(e);
    }
    // Read only the item's ID first. After acquiring its lock, load fresh booking state.
    // All mutations lock equipment first, ensuring consistent lock order and avoiding stale updates.
    private Booking lockedBooking(Long id) {
        Booking initial = bookings.findById(id).orElseThrow(() -> error(404,"Booking not found."));
        Long equipmentId=initial.equipment.id;
        locked(equipmentId);
        // Refresh is needed if another transaction changed this booking while we waited.
        entityManager.refresh(initial);
        return initial;
    }
    @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager entityManager;
    private Equipment locked(Long id) { return equipment.lockById(id).orElseThrow(() -> error(404,"Equipment not found.")); }
    private LocalDate today() { return LocalDate.now(clock); }
    private void validateDates(LocalDate start, LocalDate end) {
        if (start == null || end == null || start.isBefore(today()) || end.isBefore(start))
            throw error(400,"Choose a start date from today onward and an end date on or after it.");
        if (days(start,end)>90) throw error(400,"A rental can be booked for up to 90 days.");
        if (start.isAfter(today().plusYears(1))) throw error(400,"Book no more than one year in advance.");
    }
    private long days(LocalDate start, LocalDate end) { return ChronoUnit.DAYS.between(start,end)+1; }
    private Dto.BookingView view(Booking b) {
        BigDecimal fee=b.lateFee;
        if (b.status==Booking.Status.APPROVED && today().isAfter(b.endDate))
            fee=b.dailyRate.multiply(BigDecimal.valueOf(ChronoUnit.DAYS.between(b.endDate,today())));
        return new Dto.BookingView(b.id,b.equipment.id,b.equipment.name,b.equipment.category,b.user.name,b.user.email,
            b.startDate,b.endDate,days(b.startDate,b.endDate),b.dailyRate,b.rentalAmount,fee,b.rentalAmount.add(fee),b.status,b.returnedDate,b.createdAt);
    }
    private ResponseStatusException error(int status,String message) { return new ResponseStatusException(HttpStatus.valueOf(status),message); }
}
