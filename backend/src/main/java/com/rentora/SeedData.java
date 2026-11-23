package com.rentora;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class SeedData implements CommandLineRunner {
    private final UserRepository users;
    private final EquipmentRepository equipment;
    private final BookingRepository bookings;
    private final PasswordEncoder passwords;
    private final Clock clock;
    @Value("${app.seed-demo}") boolean demo;
    @Value("${app.admin.email}") String adminEmail;
    @Value("${app.admin.password}") String adminPassword;
    SeedData(UserRepository users, EquipmentRepository equipment, BookingRepository bookings, PasswordEncoder passwords, Clock clock) {
        this.users=users; this.equipment=equipment; this.bookings=bookings; this.passwords=passwords; this.clock=clock;
    }
    @Override @Transactional
    public void run(String... args) {
        String email=adminEmail.strip().toLowerCase(java.util.Locale.ROOT);
        if (!users.existsByEmail(email)) {
            if(adminPassword.getBytes(java.nio.charset.StandardCharsets.UTF_8).length < 8 || adminPassword.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
                throw new IllegalStateException("ADMIN_PASSWORD must contain 8 to 72 UTF-8 bytes.");
            users.save(new UserAccount("Rentora Admin",email,passwords.encode(adminPassword),UserAccount.Role.ADMIN));
        }
        if (!demo) return;
        UserAccount customer=users.findByEmail("user@rentora.local").orElseGet(() -> users.save(
            new UserAccount("Demo Customer","user@rentora.local",passwords.encode("User@1234"),UserAccount.Role.CUSTOMER)));
        if (equipment.count() != 0) return;
        List<Equipment> items=equipment.saveAll(List.of(
            new Equipment("Sony Alpha Camera", "Cameras", "A mirrorless camera kit for portraits, college events, and weekend stories. Includes a lens, battery, and carrying case.",new BigDecimal("1200")),
            new Equipment("Cordless Drill Kit", "Tools", "A versatile drill with a bit set and charger. Perfect for furniture assembly and home improvement.",new BigDecimal("350")),
            new Equipment("Weekend Camping Tent", "Outdoor", "A weather-resistant four-person tent with poles and a ground sheet. Pack light, explore more.",new BigDecimal("650")),
            new Equipment("Epson Projector", "Electronics", "A full-HD projector for presentations and movie nights. Includes power cable and HDMI cable.",new BigDecimal("900")),
            new Equipment("Portable PA Speaker", "Events", "A rechargeable speaker with microphone for college activities, small gatherings, and performances.",new BigDecimal("750")),
            new Equipment("GoPro Adventure Kit", "Cameras", "A compact action camera with mounting accessories and a protective case for your next adventure.",new BigDecimal("800"))
        ));
        // A clearly documented historical demo rental makes overdue fees easy to present.
        LocalDate today=LocalDate.now(clock);
        Booking overdue=new Booking(); overdue.user=customer; overdue.equipment=items.get(4);
        overdue.startDate=today.minusDays(4); overdue.endDate=today.minusDays(2); overdue.status=Booking.Status.APPROVED;
        overdue.dailyRate=items.get(4).dailyRate; overdue.rentalAmount=overdue.dailyRate.multiply(BigDecimal.valueOf(3));
        bookings.save(overdue);
    }
}
