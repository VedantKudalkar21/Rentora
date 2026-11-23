# Rentora — full application file codes

These are the complete application, configuration, and test files. The ZIP also includes the Maven wrapper scripts, npm lockfile, and README with Windows commands. Keep the relative paths shown below when creating or editing files.

## .gitignore

```text
**/node_modules/
**/dist/
**/target/
**/.env
**/.env.local
.idea/
.vscode/
*.log
```

## backend/.mvn/wrapper/maven-wrapper.properties

```properties
wrapperVersion=3.3.4
distributionType=only-script
distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/apache-maven-3.9.11-bin.zip
```

## backend/pom.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>3.5.16</version><relativePath/></parent>
  <groupId>com.rentora</groupId><artifactId>rentora</artifactId><version>1.0.0</version>
  <name>Rentora</name><description>Equipment rental and booking platform</description>
  <properties><java.version>21</java.version></properties>
  <dependencies>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-validation</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-security</artifactId></dependency>
    <dependency><groupId>com.mysql</groupId><artifactId>mysql-connector-j</artifactId><scope>runtime</scope></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-test</artifactId><scope>test</scope></dependency>
    <dependency><groupId>org.springframework.security</groupId><artifactId>spring-security-test</artifactId><scope>test</scope></dependency>
    <dependency><groupId>com.h2database</groupId><artifactId>h2</artifactId><scope>test</scope></dependency>
  </dependencies>
  <build><plugins><plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build>
</project>
```

## backend/src/main/java/com/rentora/ApiErrors.java

```java
package com.rentora;

import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;

@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<?> status(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("message", ex.getReason() == null ? "Request failed." : ex.getReason()));
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<?> validation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage()).findFirst().orElse("Invalid input.");
        return ResponseEntity.badRequest().body(Map.of("message", message));
    }
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<?> malformed(Exception ex) { return ResponseEntity.badRequest().body(Map.of("message", "Invalid request. Check dates and numeric values.")); }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<?> duplicate(DataIntegrityViolationException ex) {
        return ResponseEntity.status(409).body(Map.of("message", "That record already exists or is referenced by a booking."));
    }
}
```

## backend/src/main/java/com/rentora/AuthController.java

```java
package com.rentora;

import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/auth")
public class AuthController {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final HttpSessionSecurityContextRepository contexts;
    AuthController(UserRepository users, PasswordEncoder passwords, HttpSessionSecurityContextRepository contexts) {
        this.users = users; this.passwords = passwords; this.contexts = contexts;
    }
    @GetMapping("/csrf") Map<String,String> csrf(CsrfToken token) {
        return Map.of("token",token.getToken(),"headerName",token.getHeaderName());
    }
    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    Dto.UserView register(@Valid @RequestBody Dto.RegisterRequest body, HttpServletRequest req, HttpServletResponse res) {
        String email = body.email().strip().toLowerCase(Locale.ROOT);
        if (users.existsByEmail(email)) throw new ResponseStatusException(HttpStatus.CONFLICT,"This email is already registered.");
        if (body.name().strip().length() < 2) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter a name with at least two characters.");
        checkPasswordBytes(body.password());
        UserAccount user = users.save(new UserAccount(body.name().strip(),email,passwords.encode(body.password()),UserAccount.Role.CUSTOMER));
        signIn(user,req,res);
        return Dto.UserView.from(user);
    }
    @PostMapping("/login")
    Dto.UserView login(@Valid @RequestBody Dto.LoginRequest body, HttpServletRequest req, HttpServletResponse res) {
        checkPasswordBytes(body.password());
        UserAccount user = users.findByEmail(body.email().strip().toLowerCase(Locale.ROOT))
            .filter(u -> passwords.matches(body.password(),u.passwordHash))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Incorrect email or password."));
        signIn(user,req,res);
        return Dto.UserView.from(user);
    }
    @GetMapping("/me") Dto.UserView me(Principal principal) { return Dto.UserView.from(current(principal)); }
    @PostMapping("/logout") Map<String,String> logout(HttpServletRequest req) {
        HttpSession session = req.getSession(false);
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();
        return Map.of("message","Logged out.");
    }
    UserAccount current(Principal principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Please log in.");
        return users.findByEmail(principal.getName()).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Please log in again."));
    }
    private void signIn(UserAccount user, HttpServletRequest req, HttpServletResponse res) {
        if (req.getSession(false) != null) req.changeSessionId();
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(user.email, null,
            List.of(new SimpleGrantedAuthority("ROLE_" + user.role.name()))));
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context,req,res);
    }
    private void checkPasswordBytes(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Password must be at most 72 UTF-8 bytes.");
    }
}
```

## backend/src/main/java/com/rentora/Booking.java

```java
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
```

## backend/src/main/java/com/rentora/BookingController.java

```java
package com.rentora;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api")
public class BookingController {
    private final RentalService rentals;
    private final AuthController auth;
    BookingController(RentalService rentals, AuthController auth) { this.rentals=rentals; this.auth=auth; }
    @PostMapping("/bookings") @ResponseStatus(HttpStatus.CREATED)
    Dto.BookingView book(@Valid @RequestBody Dto.BookRequest req, Principal principal) { return rentals.book(auth.current(principal),req); }
    @GetMapping("/bookings/mine") List<Dto.BookingView> mine(Principal principal) { return rentals.mine(auth.current(principal)); }
    @PatchMapping("/bookings/{id}/cancel") Dto.BookingView cancel(@PathVariable Long id, Principal principal) { return rentals.cancel(id,auth.current(principal)); }
    @GetMapping("/admin/bookings") List<Dto.BookingView> all() { return rentals.all(); }
    @PatchMapping("/admin/bookings/{id}/approve") Dto.BookingView approve(@PathVariable Long id) { return rentals.decide(id,true); }
    @PatchMapping("/admin/bookings/{id}/reject") Dto.BookingView reject(@PathVariable Long id) { return rentals.decide(id,false); }
    @PatchMapping("/admin/bookings/{id}/return") Dto.BookingView returned(@PathVariable Long id,@Valid @RequestBody Dto.ReturnRequest req) { return rentals.recordReturn(id,req.returnedDate()); }
}
```

## backend/src/main/java/com/rentora/BookingRepository.java

```java
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
```

## backend/src/main/java/com/rentora/Dto.java

```java
package com.rentora;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public final class Dto {
    private Dto() {}
    public record RegisterRequest(@NotBlank @Size(min=2, max=80) String name,
            @NotBlank @Email @Size(max=120) String email, @NotBlank @Size(min=8,max=72) String password) {}
    public record LoginRequest(@NotBlank @Email @Size(max=120) String email, @NotBlank @Size(max=72) String password) {}
    public record UserView(Long id, String name, String email, UserAccount.Role role) {
        static UserView from(UserAccount u) { return new UserView(u.id, u.name, u.email, u.role); }
    }
    public record EquipmentRequest(@NotBlank @Size(min=2,max=100) String name,
            @NotBlank @Pattern(regexp="Cameras|Tools|Outdoor|Electronics|Events") String category,
            @NotBlank @Size(max=1500) String description,
            @NotNull @DecimalMin("1.00") @DecimalMax("1000000.00") @Digits(integer=7,fraction=2) BigDecimal dailyRate) {}
    public record EquipmentView(Long id, String name, String category, String description, BigDecimal dailyRate, boolean active) {
        static EquipmentView from(Equipment e) { return new EquipmentView(e.id,e.name,e.category,e.description,e.dailyRate,e.active); }
    }
    public record BookRequest(@NotNull @Positive Long equipmentId, @NotNull LocalDate startDate, @NotNull LocalDate endDate) {}
    public record ReturnRequest(@NotNull LocalDate returnedDate) {}
    public record ActiveRequest(boolean active) {}
    public record BookingView(Long id, Long equipmentId, String equipmentName, String category,
            String customerName, String customerEmail, LocalDate startDate, LocalDate endDate, long days,
            BigDecimal dailyRate, BigDecimal rentalAmount, BigDecimal lateFee, BigDecimal total,
            Booking.Status status, LocalDate returnedDate, Instant createdAt) {}
}
```

## backend/src/main/java/com/rentora/Equipment.java

```java
package com.rentora;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "equipment")
public class Equipment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Column(nullable = false, length = 100) String name;
    @Column(nullable = false, length = 40) String category;
    @Column(nullable = false, length = 1500) String description;
    @Column(nullable = false, precision = 12, scale = 2) BigDecimal dailyRate;
    @Column(nullable = false) boolean active = true;
    protected Equipment() {}
    Equipment(String name, String category, String description, BigDecimal dailyRate) {
        this.name = name; this.category = category; this.description = description; this.dailyRate = dailyRate;
    }
}
```

## backend/src/main/java/com/rentora/EquipmentController.java

```java
package com.rentora;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api")
public class EquipmentController {
    private final RentalService rentals;
    EquipmentController(RentalService rentals) { this.rentals=rentals; }
    @GetMapping("/equipment") List<Dto.EquipmentView> list() { return rentals.catalogue(); }
    @GetMapping("/equipment/{id}/availability") Map<String,Object> availability(@PathVariable Long id,
        @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate start,
        @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate end) { return rentals.availability(id,start,end); }
    @PostMapping("/admin/equipment") @ResponseStatus(HttpStatus.CREATED)
    Dto.EquipmentView create(@Valid @RequestBody Dto.EquipmentRequest req) { return rentals.saveEquipment(null,req); }
    @PutMapping("/admin/equipment/{id}") Dto.EquipmentView update(@PathVariable Long id, @Valid @RequestBody Dto.EquipmentRequest req) { return rentals.saveEquipment(id,req); }
    @PatchMapping("/admin/equipment/{id}/active") Dto.EquipmentView active(@PathVariable Long id, @RequestBody Dto.ActiveRequest req) { return rentals.setActive(id,req.active()); }
}
```

## backend/src/main/java/com/rentora/EquipmentRepository.java

```java
package com.rentora;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface EquipmentRepository extends JpaRepository<Equipment, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Equipment e where e.id = :id")
    Optional<Equipment> lockById(@Param("id") Long id);
}
```

## backend/src/main/java/com/rentora/RentalService.java

```java
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
    RentalService(EquipmentRepository equipment, BookingRepository bookings, Clock clock) {
        this.equipment = equipment; this.bookings = bookings; this.clock = clock;
    }
    @Transactional(readOnly = true)
    public List<Dto.EquipmentView> catalogue() { return equipment.findAll().stream().map(Dto.EquipmentView::from).toList(); }
    @Transactional(readOnly = true)
    public Map<String,Object> availability(Long id, LocalDate start, LocalDate end) {
        validateDates(start,end);
        Equipment e = equipment.findById(id).orElseThrow(() -> error(404,"Equipment not found."));
        boolean available = e.active && bookings.countOverlaps(id,start,end,RESERVED) == 0;
        return Map.of("available",available,"days",days(start,end),"total",e.dailyRate.multiply(BigDecimal.valueOf(days(start,end))));
    }
    @Transactional
    public Dto.BookingView book(UserAccount user, Dto.BookRequest req) {
        if (user.role != UserAccount.Role.CUSTOMER) throw error(403,"Use a customer account to rent equipment.");
        validateDates(req.startDate(),req.endDate());
        // Lock the physical item before checking dates; concurrent requests must wait.
        Equipment e = locked(req.equipmentId());
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
        return Dto.EquipmentView.from(equipment.save(e));
    }
    @Transactional
    public Dto.EquipmentView setActive(Long id, boolean active) {
        Equipment e = locked(id);
        if (!active && bookings.existsByEquipmentIdAndStatusInAndEndDateGreaterThanEqual(id,RESERVED,today()))
            throw error(409,"Cancel or reject upcoming reservations before marking this item under maintenance.");
        if (!active && bookings.findAllByOrderByCreatedAtDesc().stream().anyMatch(b -> b.equipment.id.equals(id) && b.status==Booking.Status.APPROVED))
            throw error(409,"Record outstanding returns before marking this item under maintenance.");
        e.active=active;
        return Dto.EquipmentView.from(e);
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
```

## backend/src/main/java/com/rentora/RentoraApplication.java

```java
package com.rentora;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class RentoraApplication {
    public static void main(String[] args) { SpringApplication.run(RentoraApplication.class, args); }
    @Bean Clock appClock() { return Clock.system(ZoneId.of("Asia/Kolkata")); }
}
```

## backend/src/main/java/com/rentora/SecurityConfig.java

```java
package com.rentora;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
    @Bean org.springframework.security.core.userdetails.UserDetailsService userDetailsService(UserRepository users) {
        return email -> users.findByEmail(email).map(user ->
            org.springframework.security.core.userdetails.User.withUsername(user.email).password(user.passwordHash)
                .roles(user.role.name()).build()).orElseThrow(() ->
                    new org.springframework.security.core.userdetails.UsernameNotFoundException("Account not found."));
    }
    @Bean HttpSessionSecurityContextRepository contextRepository() { return new HttpSessionSecurityContextRepository(); }
    @Bean SecurityFilterChain security(HttpSecurity http, HttpSessionSecurityContextRepository contexts) throws Exception {
        http.csrf(csrf -> csrf.csrfTokenRepository(new HttpSessionCsrfTokenRepository())
                .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
            .securityContext(context -> context.securityContextRepository(contexts))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/csrf", "/api/auth/login", "/api/auth/register", "/error").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/equipment", "/api/equipment/*/availability").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((req,res,ex) -> json(res,401,"Please log in to continue."))
                .accessDeniedHandler((req,res,ex) -> json(res,403,"Access denied or security token expired. Refresh and try again.")))
            .formLogin(form -> form.disable()).httpBasic(basic -> basic.disable()).logout(logout -> logout.disable());
        return http.build();
    }
    private static void json(HttpServletResponse res, int status, String message) throws java.io.IOException {
        res.setStatus(status); res.setContentType("application/json");
        res.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
```

## backend/src/main/java/com/rentora/SeedData.java

```java
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
```

## backend/src/main/java/com/rentora/UserAccount.java

```java
package com.rentora;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class UserAccount {
    public enum Role { CUSTOMER, ADMIN }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Column(nullable = false, length = 80) String name;
    @Column(nullable = false, unique = true, length = 120) String email;
    @Column(nullable = false) String passwordHash;
    @Enumerated(EnumType.STRING) @Column(nullable = false) Role role;
    protected UserAccount() {}
    UserAccount(String name, String email, String passwordHash, Role role) {
        this.name = name; this.email = email; this.passwordHash = passwordHash; this.role = role;
    }
}
```

## backend/src/main/java/com/rentora/UserRepository.java

```java
package com.rentora;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
public interface UserRepository extends JpaRepository<UserAccount, Long> {
    Optional<UserAccount> findByEmail(String email);
    boolean existsByEmail(String email);
}
```

## backend/src/main/resources/application.properties

```properties
spring.application.name=Rentora
server.port=${PORT:8080}
spring.datasource.url=${DB_URL:jdbc:mysql://localhost:3306/rentora?createDatabaseIfNotExist=true&serverTimezone=Asia/Kolkata}
spring.datasource.username=${DB_USERNAME:root}
spring.datasource.password=${DB_PASSWORD:}
spring.jpa.hibernate.ddl-auto=update
spring.jpa.open-in-view=false
spring.jpa.properties.hibernate.jdbc.time_zone=Asia/Kolkata
server.servlet.session.timeout=2h
server.servlet.session.cookie.http-only=true
server.servlet.session.cookie.same-site=lax
server.servlet.session.cookie.secure=${COOKIE_SECURE:false}
server.error.include-message=never
app.seed-demo=${SEED_DEMO:true}
app.admin.email=${ADMIN_EMAIL:admin@rentora.local}
app.admin.password=${ADMIN_PASSWORD:Admin@123}
```

## backend/src/test/java/com/rentora/RentoraIntegrationTest.java

```java
package com.rentora;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class RentoraIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired EquipmentRepository equipment;
    @Autowired BookingRepository bookings;
    @Autowired RentalService rentals;
    @Autowired Clock clock;
    LocalDate day() { return LocalDate.now(clock); }
    String suffix() { return UUID.randomUUID().toString().substring(0,8); }
    MockHttpSession login(String email,String password) throws Exception {
        return (MockHttpSession)mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(new Dto.LoginRequest(email,password))))
            .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
    }
    MockHttpSession customer() throws Exception { return login("user@rentora.local","User@1234"); }
    MockHttpSession admin() throws Exception { return login("admin@rentora.local","Admin@123"); }
    Equipment item() { return equipment.save(new Equipment("Test Camera " + suffix(),"Cameras","Integration-test equipment",new BigDecimal("500.00"))); }
    UserAccount demoUser() { return users.findByEmail("user@rentora.local").orElseThrow(); }
    Dto.BookRequest request(Equipment e) { return new Dto.BookRequest(e.id,day(),day().plusDays(2)); }

    @Test void cataloguePublicAndAdminRoutesProtected() throws Exception {
        mvc.perform(get("/api/equipment")).andExpect(status().isOk());
        mvc.perform(get("/api/admin/bookings")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/bookings").session(customer())).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/bookings").session(admin())).andExpect(status().isOk());
    }
    @Test void csrfRequiredAndRealSessionTokenWorks() throws Exception {
        String body=json.writeValueAsString(new Dto.LoginRequest("user@rentora.local","User@1234"));
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        MvcResult token=mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        JsonNode node=json.readTree(token.getResponse().getContentAsString());
        MockHttpSession session=(MockHttpSession)token.getRequest().getSession(false);
        mvc.perform(post("/api/auth/login").session(session).header(node.get("headerName").asText(),node.get("token").asText())
            .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.role").value("CUSTOMER"));
    }
    @Test void registrationAlwaysCreatesCustomerAndRejectsDuplicates() throws Exception {
        String email="new-" + suffix() + "@example.com";
        String body="{\"name\":\"Test User\",\"email\":\""+email+"\",\"password\":\"Password@123\",\"role\":\"ADMIN\"}";
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.role").value("CUSTOMER")).andExpect(jsonPath("$.passwordHash").doesNotExist());
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
        assertNotEquals("Password@123",users.findByEmail(email).orElseThrow().passwordHash);
    }
    @Test void wrongPasswordFailsAndLogoutEndsSession() throws Exception {
        mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"user@rentora.local\",\"password\":\"incorrect\"}")).andExpect(status().isUnauthorized());
        MockHttpSession session=customer();
        mvc.perform(post("/api/auth/logout").session(session).with(csrf())).andExpect(status().isOk());
        assertTrue(session.isInvalid());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }
    @Test void overlapConflictsAndCancellationReleasesDates() throws Exception {
        Equipment e=item(); MockHttpSession session=customer();
        String body=json.writeValueAsString(request(e));
        MvcResult created=mvc.perform(post("/api/bookings").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.rentalAmount").value(1500)).andReturn();
        long id=json.readTree(created.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(post("/api/bookings").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
        mvc.perform(patch("/api/bookings/"+id+"/cancel").session(session).with(csrf())).andExpect(status().isOk());
        mvc.perform(post("/api/bookings").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated());
    }
    @Test void inclusiveBoundariesBlockSharedEndDateButAllowNextDay() {
        Equipment e=item(); rentals.book(demoUser(),request(e));
        assertFalse((Boolean)rentals.availability(e.id,day().plusDays(2),day().plusDays(3)).get("available"));
        assertTrue((Boolean)rentals.availability(e.id,day().plusDays(3),day().plusDays(4)).get("available"));
    }
    @Test void dateValidationAndSingleDayCharge() throws Exception {
        Equipment e=item(); MockHttpSession session=customer();
        for (Dto.BookRequest request:List.of(new Dto.BookRequest(e.id,day().minusDays(1),day()),
            new Dto.BookRequest(e.id,day().plusDays(2),day()),new Dto.BookRequest(e.id,day(),day().plusDays(90)))) {
            mvc.perform(post("/api/bookings").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(request))).andExpect(status().isBadRequest());
        }
        Dto.BookingView single=rentals.book(demoUser(),new Dto.BookRequest(e.id,day(),day()));
        assertEquals(1,single.days()); assertEquals(0,new BigDecimal("500.00").compareTo(single.rentalAmount()));
    }
    @Test void rateSnapshotSurvivesEquipmentEdit() {
        Equipment e=item(); Dto.BookingView booking=rentals.book(demoUser(),request(e));
        rentals.saveEquipment(e.id,new Dto.EquipmentRequest(e.name,"Cameras","Updated description",new BigDecimal("999.00")));
        Dto.BookingView loaded=rentals.mine(demoUser()).stream().filter(b->b.id().equals(booking.id())).findFirst().orElseThrow();
        assertEquals(0,new BigDecimal("1500.00").compareTo(loaded.rentalAmount()));
        assertEquals(0,new BigDecimal("500.00").compareTo(loaded.dailyRate()));
    }
    @Test void onlyOwnerCanCancelAndOnlyAdminCanApprove() throws Exception {
        Dto.BookingView b=rentals.book(demoUser(),request(item()));
        String email="other-"+suffix()+"@example.com";
        MvcResult registration=mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Other User\",\"email\":\""+email+"\",\"password\":\"Password@123\"}"))
            .andExpect(status().isCreated()).andReturn();
        MockHttpSession other=(MockHttpSession)registration.getRequest().getSession(false);
        mvc.perform(patch("/api/bookings/"+b.id()+"/cancel").session(other).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(patch("/api/admin/bookings/"+b.id()+"/approve").session(customer()).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(patch("/api/admin/bookings/"+b.id()+"/approve").session(admin()).with(csrf())).andExpect(status().isOk());
        mvc.perform(patch("/api/admin/bookings/"+b.id()+"/reject").session(admin()).with(csrf())).andExpect(status().isConflict());
    }
    @Test void actualReturnCalculatesLateFeeAndCannotBeRepeated() throws Exception {
        Equipment e=item(); Booking b=new Booking(); b.user=demoUser(); b.equipment=e;
        b.startDate=day().minusDays(4);b.endDate=day().minusDays(2);b.dailyRate=e.dailyRate;
        b.rentalAmount=e.dailyRate.multiply(BigDecimal.valueOf(3));b.status=Booking.Status.APPROVED;
        long id=bookings.save(b).id;
        MockHttpSession session=admin();
        mvc.perform(patch("/api/admin/bookings/"+id+"/return").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(new Dto.ReturnRequest(day().plusDays(1))))).andExpect(status().isBadRequest());
        mvc.perform(patch("/api/admin/bookings/"+id+"/return").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(new Dto.ReturnRequest(day())))).andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("RETURNED")).andExpect(jsonPath("$.lateFee").value(1000)).andExpect(jsonPath("$.total").value(2500));
        mvc.perform(patch("/api/admin/bookings/"+id+"/return").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(new Dto.ReturnRequest(day())))).andExpect(status().isConflict());
    }
    @Test void inventoryMaintenanceCannotBreakReservations() throws Exception {
        MockHttpSession session=admin();
        MvcResult created=mvc.perform(post("/api/admin/equipment").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"New Drill\",\"category\":\"Tools\",\"description\":\"A useful drill\",\"dailyRate\":350}"))
            .andExpect(status().isCreated()).andReturn();
        long id=json.readTree(created.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(patch("/api/admin/equipment/"+id+"/active").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
            .andExpect(status().isOk());
        ResponseStatusException unavailable=assertThrows(ResponseStatusException.class,()->rentals.book(demoUser(),new Dto.BookRequest(id,day(),day())));
        assertEquals(409,unavailable.getStatusCode().value());
        rentals.setActive(id,true); rentals.book(demoUser(),new Dto.BookRequest(id,day(),day()));
        mvc.perform(patch("/api/admin/equipment/"+id+"/active").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
            .andExpect(status().isConflict());
    }
    @Test void concurrentRequestsCreateOnlyOneReservation() throws Exception {
        Equipment e=item(); UserAccount user=demoUser(); Dto.BookRequest body=request(e);
        ExecutorService executor=Executors.newFixedThreadPool(2);
        CountDownLatch ready=new CountDownLatch(2), start=new CountDownLatch(1);
        Callable<Integer> attempt=() -> { ready.countDown(); start.await(10,TimeUnit.SECONDS); try { rentals.book(user,body); return 201; }
            catch(ResponseStatusException ex) { return ex.getStatusCode().value(); } };
        try {
            Future<Integer> first=executor.submit(attempt), second=executor.submit(attempt);
            assertTrue(ready.await(10,TimeUnit.SECONDS)); start.countDown();
            List<Integer> codes=new java.util.ArrayList<>(List.of(first.get(15,TimeUnit.SECONDS),second.get(15,TimeUnit.SECONDS)));
            java.util.Collections.sort(codes); assertEquals(List.of(201,409),codes);
        } finally { executor.shutdownNow(); }
    }
}
```

## backend/src/test/resources/application-test.properties

```properties
spring.datasource.url=jdbc:h2:mem:rentora-test;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000
spring.datasource.driver-class-name=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=
spring.jpa.hibernate.ddl-auto=create-drop
app.seed-demo=true
logging.level.org.springframework.security=ERROR
```

## backend/src/test/resources/mockito-extensions/org.mockito.plugins.MockMaker

```text
mock-maker-subclass
```

## database.sql

```sql
-- Optional: the default application URL can also create this database automatically.
CREATE DATABASE IF NOT EXISTS rentora CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rentora;
-- Spring Data JPA creates users, equipment, and bookings at application startup.
-- The relationships are users (1) -> bookings (many), equipment (1) -> bookings (many).
-- Do not manually create duplicate tables. See backend/src/main/java/com/rentora for entities.
```

## frontend/index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#153f35" />
    <meta name="description" content="Rentora — equipment for your next big idea. Browse, book, and rent with confidence." />
    <title>Rentora | Own the moment.</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>
```

## frontend/package.json

```json
{
  "name": "rentora-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": { "dev": "vite --host 127.0.0.1", "build": "vite build", "preview": "vite preview --host 127.0.0.1" },
  "dependencies": { "react": "19.2.0", "react-dom": "19.2.0" },
  "devDependencies": { "@vitejs/plugin-react": "5.1.1", "vite": "7.2.2" }
}
```

## frontend/public/favicon.svg

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#153f35"/><path d="M20 45V18h15a9 9 0 0 1 0 18H20m13 0 13 12" fill="none" stroke="#d9f6a6" stroke-width="6" stroke-linejoin="round"/></svg>
```

## frontend/src/App.jsx

```jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, clearSecurityToken } from './api';
import EquipmentArt from './EquipmentArt';

const CATEGORIES = ['All equipment', 'Cameras', 'Tools', 'Outdoor', 'Electronics', 'Events'];
const MONEY = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const money = value => MONEY.format(Number(value || 0));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateLabel = value => value ? new Date(value + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const statusLabel = value => value[0] + value.slice(1).toLowerCase();
const blankEquipment = { name: '', category: 'Cameras', description: '', dailyRate: '' };

function Icon({ name, size = 20 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    bag: <><path d="M5 7h14l2 14H3L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    plus: <path d="M12 4v16M4 12h16"/>,
    logout: <><path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h11"/></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
    chart: <><path d="M4 3v18h17M9 16v-5m5 5V7m5 9V4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.bag}</svg>;
}

function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => { dialog.close(); previousFocus?.focus(); };
  }, []);
  return <dialog ref={ref} className={'modal ' + (wide ? 'wide-modal' : '')} onCancel={onClose} onClick={event => { if (event.target === ref.current) onClose(); }}>
    <div className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </dialog>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [page, setPage] = useState('catalogue');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All equipment');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [connectionError, setConnectionError] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [bookingFilter, setBookingFilter] = useState('ALL');
  const toastTimer = useRef();
  const isAdmin = user?.role === 'ADMIN';
  const notify = useCallback((message, error = false) => {
    clearTimeout(toastTimer.current); setToast({ message, error });
    toastTimer.current = setTimeout(() => setToast(null), 5500);
  }, []);
  const loadCatalogue = useCallback(async () => setEquipment(await api('/equipment')), []);
  const loadBookings = useCallback(async () => {
    if (!user) { setBookings([]); return; }
    setBookings(await api(isAdmin ? '/admin/bookings' : '/bookings/mine'));
  }, [user, isAdmin]);

  useEffect(() => {
    let alive = true;
    async function init() {
      try {
        const items = await api('/equipment');
        if (!alive) return;
        setEquipment(items);
        try { const account = await api('/auth/me'); if (alive) setUser(account); }
        catch (error) { if (error.status !== 401) throw error; }
      } catch { if (alive) setConnectionError('Cannot reach Rentora. Start the Spring Boot backend on port 8080, then refresh this page.'); }
      finally { if (alive) setLoading(false); }
    }
    init(); return () => { alive = false; };
  }, []);
  useEffect(() => { loadBookings().catch(error => notify(error.message, true)); }, [loadBookings, notify]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  async function mutate(path, method = 'PATCH', body, success = 'Saved successfully.') {
    setWorking(true);
    try { await api(path, { method, ...(body === undefined ? {} : { body }) }); await Promise.all([loadCatalogue(), loadBookings()]); notify(success); return true; }
    catch (error) { notify(error.message, true); return false; }
    finally { setWorking(false); }
  }
  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); clearSecurityToken(); setUser(null); setBookings([]); setPage('catalogue'); notify('You have been logged out.'); }
    catch (error) { notify(error.message, true); }
  }
  function navigate(next) {
    if (next === 'rentals' && !user) { setModal({ type: 'auth' }); return; }
    setPage(next); setQuery('');
  }
  const visibleItems = equipment.filter(item => (category === 'All equipment' || item.category === category) && `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase()));
  const visibleBookings = bookings.filter(b => (bookingFilter === 'ALL' || b.status === bookingFilter) && `${b.equipmentName} ${b.customerName} ${b.customerEmail} ${b.id}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="app-shell">
    <aside className="sidebar">
      <a href="#" className="brand" onClick={event => { event.preventDefault(); navigate('catalogue'); }}><span className="brand-mark">r<span>↗</span></span>rentora<span className="brand-dot">.</span></a>
      <div className="workspace-label">YOUR RENTAL SPACE</div>
      <nav aria-label="Main navigation">
        <button className={page === 'catalogue' ? 'nav-item selected' : 'nav-item'} onClick={() => navigate('catalogue')}><Icon name="grid"/>Explore equipment<Icon name="arrow" size={16}/></button>
        <button className={page === 'rentals' ? 'nav-item selected' : 'nav-item'} onClick={() => navigate('rentals')}><Icon name="bag"/>{isAdmin ? 'Manage bookings' : 'My rentals'}</button>
        {isAdmin && <button className={page === 'inventory' ? 'nav-item selected' : 'nav-item'} onClick={() => navigate('inventory')}><Icon name="chart"/>Equipment manager</button>}
      </nav>
      <div className="sidebar-note"><span className="note-icon">↗</span><h3>Big plans.<br/>Small commitments.</h3><p>Get the gear you need,<br/>for just the time you need it.</p><span className="tiny-tag">RENT. CREATE. REPEAT.</span></div>
      <div className="sidebar-bottom"><Icon name="shield" size={17}/><span>Simple rentals. Real possibilities.</span></div>
    </aside>

    <div className="main-column">
      <header className="topbar">
        <span className="breadcrumb">Your workspace <span>/</span> <strong>{page === 'catalogue' ? 'Explore' : page === 'inventory' ? 'Inventory' : 'Bookings'}</strong></span>
        <div className="account-actions">{user ? <><div className="account-avatar">{user.name[0].toUpperCase()}</div><div className="account-info"><strong>{user.name}</strong><span>{isAdmin ? 'Administrator' : 'Customer account'}</span></div><button className="icon-button" title="Log out" aria-label="Log out" onClick={logout}><Icon name="logout"/></button></> : <><span className="muted desktop-only">Your next project starts here.</span><button className="button dark small" onClick={() => setModal({ type: 'auth' })}>Sign in <Icon name="arrow" size={16}/></button></>}</div>
      </header>
      <main>
        {connectionError && <div className="error-banner" role="alert">{connectionError}</div>}
        {page === 'catalogue' && <>
          <section className="hero">
            <div className="hero-copy"><div className="eyebrow"><span className="live-dot"/>LESS OWNING. MORE DOING.</div><h1>Own the moment.<br/><span>Rent the equipment.</span></h1><p>From weekend adventures to your next big idea.<br className="desktop-only"/> Find the right gear, without the full-time price tag.</p><button className="button dark" onClick={() => document.getElementById('catalogue').scrollIntoView({ behavior: 'smooth' })}>Find your gear <Icon name="arrow" size={18}/></button><div className="hero-foot"><Icon name="check" size={16}/>Flexible dates<span>·</span><Icon name="check" size={16}/>Transparent pricing</div></div>
            <div className="hero-visual" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="visual-sticker">A LITTLE GEAR.<br/>A LOT OF POSSIBILITY. <span>✦</span></div><div className="hero-art"><EquipmentArt category="Cameras"/></div><div className="floating-label"><span>↗</span><div>Make it happen.<small>We'll bring the gear.</small></div></div><span className="hero-star">✳</span></div>
          </section>
          <section id="catalogue" className="catalogue-section">
            <div className="section-top"><div><div className="eyebrow subtle">THE GOOD STUFF, ON YOUR TERMS</div><h2>What are you planning?</h2></div><label className="search-box"><Icon name="search"/><input aria-label="Search equipment" placeholder="Search cameras, tools, and more…" value={query} onChange={event => setQuery(event.target.value)}/></label></div>
            <div className="category-row">{CATEGORIES.map(cat => <button key={cat} className={category === cat ? 'category active' : 'category'} onClick={() => setCategory(cat)}>{cat}</button>)}</div>
            <div className="results-line"><span>{loading ? 'Finding your next rental…' : `${visibleItems.length} items to make it happen`}</span><span>One item. Your chosen dates.</span></div>
            <div className="equipment-grid">{visibleItems.map(item => <article className="equipment-card" key={item.id}>
              <div className={'art-panel art-' + item.category.toLowerCase()}><span className="equipment-category">{item.category}</span><span className={item.active ? 'stock-label' : 'stock-label unavailable'}>{item.active ? 'Check dates' : 'Maintenance'}</span><EquipmentArt category={item.category}/></div>
              <div className="card-body"><h3>{item.name}</h3><p>{item.description}</p><div className="card-bottom"><div className="price">{money(item.dailyRate)}<span> / day</span></div><button className="rent-button" disabled={!item.active || isAdmin} onClick={() => setModal({ type: user ? 'book' : 'auth', item })} aria-label={'Rent ' + item.name}><Icon name="arrow" size={19}/></button></div></div>
            </article>)}</div>
            {!loading && !visibleItems.length && <Empty title="No equipment found" text="Try another search or choose a different category."/>}
            {isAdmin && <p className="helper">You are browsing as an admin. Use a customer account to place a rental request.</p>}
          </section>
          <section className="promise-strip"><div><Icon name="clock"/><strong>Only for the time you need</strong><span>Choose dates that work for you.</span></div><div><Icon name="shield"/><strong>Every request, accounted for</strong><span>Track approval and return status.</span></div><div><Icon name="check"/><strong>No pricing surprises</strong><span>See your rental amount upfront.</span></div></section>
        </>}

        {page === 'rentals' && <>
          <PageHeading eyebrow={isAdmin ? 'THE OPERATIONS DESK' : 'YOUR NEXT CHAPTER'} title={isAdmin ? 'Every rental, in one place.' : 'Good gear. Great plans.'} text={isAdmin ? 'Review requests, approve rentals, and keep returns on track.' : 'Your upcoming plans and past adventures, all accounted for.'}/>
          <div className="stats-grid"><Stat label="Total bookings" value={bookings.length}/><Stat label="Awaiting approval" value={bookings.filter(b => b.status === 'PENDING').length}/><Stat label="Approved rentals" value={bookings.filter(b => b.status === 'APPROVED').length}/><Stat label={isAdmin ? 'Completed rental value' : 'Completed rentals'} value={isAdmin ? money(bookings.filter(b => b.status === 'RETURNED').reduce((sum, b) => sum + Number(b.total), 0)) : bookings.filter(b => b.status === 'RETURNED').length}/></div>
          <div className="bookings-toolbar"><h2>{isAdmin ? 'Booking requests' : 'My bookings'}</h2><div className="toolbar-controls"><input className="text-input" aria-label="Search bookings" placeholder="Search bookings…" value={query} onChange={event => setQuery(event.target.value)}/><select aria-label="Filter bookings by status" value={bookingFilter} onChange={event => setBookingFilter(event.target.value)}><option value="ALL">All statuses</option>{['PENDING','APPROVED','REJECTED','CANCELLED','RETURNED'].map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select><button className="button secondary small" onClick={() => loadBookings().catch(error => notify(error.message,true))}>Refresh</button></div></div>
          <div className="booking-list">{visibleBookings.map(b => <article className="booking-card" key={b.id}>
            <div className={'booking-art art-' + b.category.toLowerCase()}><EquipmentArt category={b.category} small/></div>
            <div className="booking-detail"><div className="booking-title"><span className="eyebrow subtle">RENTAL #{String(b.id).padStart(4, '0')}</span><span className={'status status-' + b.status.toLowerCase()}>{statusLabel(b.status)}</span></div><h3>{b.equipmentName}</h3><p>{dateLabel(b.startDate)} <span>→</span> {dateLabel(b.endDate)} <span>·</span> {b.days} {b.days === 1 ? 'day' : 'days'}</p>{isAdmin && <p className="customer-line">{b.customerName} <span>·</span> {b.customerEmail}</p>}<div className="booking-money"><span>Rental <strong>{money(b.rentalAmount)}</strong></span>{Number(b.lateFee) > 0 && <span className="late-fee">{b.status === 'RETURNED' ? 'Late fee' : 'Estimated late fee'} <strong>{money(b.lateFee)}</strong></span>}<span>Total <strong>{money(b.total)}</strong></span></div>{b.returnedDate && <p className="helper">Returned on {dateLabel(b.returnedDate)}</p>}</div>
            <div className="booking-actions">{isAdmin && b.status === 'PENDING' && <><button className="button dark small" disabled={working} onClick={() => mutate(`/admin/bookings/${b.id}/approve`, 'PATCH', undefined, 'Rental approved.')}>Approve</button><button className="button secondary small danger-text" disabled={working} onClick={() => setModal({ type: 'confirm', title: 'Reject this request?', text: 'The customer will see this request as rejected and the dates will become available.', path: `/admin/bookings/${b.id}/reject`, success: 'Request rejected.' })}>Reject</button></>}{isAdmin && b.status === 'APPROVED' && <button className="button dark small" disabled={working} onClick={() => setModal({ type: 'return', booking: b })}>Record return</button>}{!isAdmin && ['PENDING','APPROVED'].includes(b.status) && b.startDate >= today() && <button className="button secondary small" disabled={working} onClick={() => setModal({ type: 'confirm', title: 'Cancel this booking?', text: 'This will release the reserved dates. You can make a new booking whenever you are ready.', path: `/bookings/${b.id}/cancel`, success: 'Booking cancelled.' })}>Cancel booking</button>}</div>
          </article>)}</div>
          {!visibleBookings.length && <Empty title="A little quiet here." text="Your booking requests will appear here."/>}
          <p className="helper">Rental days include both start and end dates. Late returns add one daily rental rate per overdue day. Amounts are rental records; online payment is not integrated.</p>
        </>}

        {page === 'inventory' && isAdmin && <>
          <div className="heading-with-action"><PageHeading eyebrow="KEEP THE POSSIBILITIES COMING" title="Your equipment collection." text="Add new gear, update pricing, and manage maintenance."/><button className="button dark" onClick={() => setModal({ type: 'equipment' })}><Icon name="plus"/>Add equipment</button></div>
          <div className="inventory-list">{equipment.map(item => <article className="inventory-item" key={item.id}><div className={'inventory-art art-' + item.category.toLowerCase()}><EquipmentArt category={item.category} small/></div><div className="inventory-info"><h3>{item.name}</h3><p>{item.category} <span>·</span> {money(item.dailyRate)} / day</p></div><span className={item.active ? 'status status-approved' : 'status status-pending'}>{item.active ? 'Listed' : 'Maintenance'}</span><button className="button secondary small" onClick={() => setModal({ type: 'equipment', item })}>Edit</button><button className="button secondary small" disabled={working} onClick={() => mutate(`/admin/equipment/${item.id}/active`, 'PATCH', { active: !item.active }, item.active ? 'Equipment marked under maintenance.' : 'Equipment is listed again.')}>{item.active ? 'Maintenance' : 'List again'}</button></article>)}</div>
          {!equipment.length && <Empty title="Start your collection" text="Add your first piece of equipment to make it available for rentals."/>}
        </>}
        <footer><span className="footer-brand">rentora.</span><span>A little less owning. A little more living.</span><span>Built for your next big idea.</span></footer>
      </main>
    </div>
    {toast && <div className={'toast ' + (toast.error ? 'toast-error' : '')} role={toast.error ? 'alert' : 'status'}><Icon name={toast.error ? 'close' : 'check'}/>{toast.message}<button aria-label="Dismiss notification" onClick={() => setToast(null)}>×</button></div>}
    {modal?.type === 'auth' && <AuthModal onClose={() => setModal(null)} onSuccess={account => { setUser(account); setModal(account.role === 'CUSTOMER' && modal.item ? { type: 'book', item: modal.item } : null); notify(`Welcome, ${account.name.split(' ')[0]}!`); }}/>} 
    {modal?.type === 'book' && <BookingModal item={modal.item} onClose={() => setModal(null)} onBooked={async () => { setModal(null); setPage('rentals'); await loadBookings(); notify('Request sent! Your equipment is reserved while the admin reviews it.'); }}/>} 
    {modal?.type === 'equipment' && <EquipmentModal item={modal.item} onClose={() => setModal(null)} onSave={async body => { const ok = await mutate(modal.item ? `/admin/equipment/${modal.item.id}` : '/admin/equipment', modal.item ? 'PUT' : 'POST', body, 'Equipment saved.'); if (ok) setModal(null); }} working={working}/>} 
    {modal?.type === 'return' && <ReturnModal booking={modal.booking} onClose={() => setModal(null)} working={working} onSave={async returnedDate => { if (await mutate(`/admin/bookings/${modal.booking.id}/return`, 'PATCH', { returnedDate }, 'Return recorded and final charges calculated.')) setModal(null); }}/>} 
    {modal?.type === 'confirm' && <Modal title={modal.title} onClose={() => setModal(null)}><p className="modal-description">{modal.text}</p><div className="form-actions"><button className="button secondary" onClick={() => setModal(null)}>Go back</button><button className="button dark" disabled={working} onClick={async () => { if (await mutate(modal.path,'PATCH',undefined,modal.success)) setModal(null); }}>{working ? 'Saving…' : 'Confirm'}</button></div></Modal>}
  </div>;
}

function PageHeading({ eyebrow, title, text }) { return <div className="page-heading"><div className="eyebrow subtle">{eyebrow}</div><h1>{title}</h1><p>{text}</p></div>; }
function Stat({ label, value }) { return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div>; }
function Empty({ title, text }) { return <div className="empty"><Icon name="bag" size={34}/><h3>{title}</h3><p>{text}</p></div>; }

function AuthModal({ onClose, onSuccess }) {
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = event => setForm({ ...form, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { onSuccess(await api(register ? '/auth/register' : '/auth/login', { method: 'POST', body: register ? form : { email: form.email, password: form.password } })); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <Modal title={register ? 'Make room for possibility.' : 'Welcome back.'} onClose={onClose}>
    <p className="modal-description">{register ? 'Create your account and get your next plan moving.' : 'Your next great rental is just a sign-in away.'}</p>
    <div className="auth-tabs"><button className={!register ? 'active' : ''} onClick={() => { setRegister(false); setError(''); }}>Sign in</button><button className={register ? 'active' : ''} onClick={() => { setRegister(true); setError(''); }}>Create account</button></div>
    <form onSubmit={submit} className="form-stack">{register && <label>Full name<input required minLength={2} maxLength={80} autoComplete="name" name="name" value={form.name} onChange={change} placeholder="Your full name"/></label>}<label>Email address<input required type="email" autoComplete="email" name="email" maxLength={120} value={form.email} onChange={change} placeholder="you@example.com"/></label><label>Password<input required type="password" minLength={register ? 8 : 1} maxLength={72} autoComplete={register ? 'new-password' : 'current-password'} name="password" value={form.password} onChange={change} placeholder={register ? 'At least 8 characters' : 'Your password'}/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button dark full" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}<Icon name="arrow" size={18}/></button></form>
    {!register && <div className="demo-logins"><span>TRY THE DEMO</span><button onClick={() => setForm({ name: '', email: 'user@rentora.local', password: 'User@1234' })}>Fill customer login</button><button onClick={() => setForm({ name: '', email: 'admin@rentora.local', password: 'Admin@123' })}>Fill admin login</button></div>}
  </Modal>;
}

function BookingModal({ item, onClose, onBooked }) {
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(today());
  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true; setChecking(true); setError(''); setAvailability(null);
    api(`/equipment/${item.id}/availability?start=${start}&end=${end}`).then(data => { if (alive) setAvailability(data); }).catch(err => { if (alive) setError(err.message); }).finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [start, end, item.id]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api('/bookings', { method: 'POST', body: { equipmentId: item.id, startDate: start, endDate: end } }); await onBooked(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <Modal title="Make it yours. For a while." onClose={onClose}><div className="booking-summary"><div className={'summary-art art-' + item.category.toLowerCase()}><EquipmentArt category={item.category} small/></div><div><h3>{item.name}</h3><p>{money(item.dailyRate)} / day</p></div></div><form className="form-stack" onSubmit={submit}><div className="two-fields"><label>Start date<input type="date" required min={today()} value={start} onChange={event => { setStart(event.target.value); if (event.target.value > end) setEnd(event.target.value); }}/></label><label>End date<input type="date" required min={start || today()} value={end} onChange={event => setEnd(event.target.value)}/></label></div><div className="price-summary"><span>{availability ? `${availability.days} ${availability.days === 1 ? 'day' : 'days'} × ${money(item.dailyRate)}` : 'Rental estimate'}<strong>{availability ? money(availability.total) : '—'}</strong></span><small>Both start and end dates are included. Maximum rental: 90 days.</small></div>{checking ? <p className="helper">Checking availability…</p> : availability && <p className={availability.available ? 'availability-yes' : 'form-error'}>{availability.available ? '✓ Available for these dates' : 'Already reserved or under maintenance. Try different dates.'}</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="button dark full" disabled={busy || checking || !availability?.available}>{busy ? 'Sending request…' : 'Request booking'}<Icon name="arrow" size={18}/></button><p className="helper">Dates are reserved immediately while the admin reviews your request. Late returns add {money(item.dailyRate)} per overdue day.</p></form></Modal>;
}

function EquipmentModal({ item, onClose, onSave, working }) {
  const [form, setForm] = useState(item ? { name: item.name, category: item.category, description: item.description, dailyRate: item.dailyRate } : blankEquipment);
  const change = event => setForm({ ...form, [event.target.name]: event.target.value });
  return <Modal title={item ? 'Give your gear an update.' : 'Add something great.'} onClose={onClose}><form className="form-stack" onSubmit={event => { event.preventDefault(); onSave({ ...form, dailyRate: Number(form.dailyRate) }); }}><label>Equipment name<input name="name" required minLength={2} maxLength={100} value={form.name} onChange={change}/></label><div className="two-fields"><label>Category<select name="category" value={form.category} onChange={change}>{CATEGORIES.slice(1).map(cat => <option key={cat}>{cat}</option>)}</select></label><label>Daily rate (₹)<input name="dailyRate" type="number" required min="1" max="1000000" step="0.01" value={form.dailyRate} onChange={change}/></label></div><label>Description<textarea name="description" required maxLength={1500} rows={4} value={form.description} onChange={change}/></label><p className="helper">Each listing represents one physical item. Existing bookings retain their original daily rate.</p><button className="button dark full" disabled={working}>{working ? 'Saving…' : 'Save equipment'}</button></form></Modal>;
}

function ReturnModal({ booking, onClose, onSave, working }) {
  const [returnedDate, setReturnedDate] = useState(today());
  const overdueDays = Math.max(0, Math.round((new Date(returnedDate + 'T00:00:00Z') - new Date(booking.endDate + 'T00:00:00Z')) / 86400000));
  return <Modal title="Back from a good adventure." onClose={onClose}><p className="modal-description">Record the actual return date for {booking.equipmentName}.</p><form className="form-stack" onSubmit={event => { event.preventDefault(); onSave(returnedDate); }}><label>Return date<input type="date" required min={booking.startDate} max={today()} value={returnedDate} onChange={event => setReturnedDate(event.target.value)}/></label><div className="price-summary"><span>Original rental<strong>{money(booking.rentalAmount)}</strong></span><span>Late fee ({overdueDays || 0} days)<strong>{money((overdueDays || 0) * Number(booking.dailyRate))}</strong></span><span className="total-row">Final total<strong>{money(Number(booking.rentalAmount) + (overdueDays || 0) * Number(booking.dailyRate))}</strong></span></div><button className="button dark full" disabled={working || booking.startDate > today()}>{working ? 'Saving…' : 'Confirm return'}</button>{booking.startDate > today() && <p className="form-error">This rental has not started yet.</p>}</form></Modal>;
}
```

## frontend/src/EquipmentArt.jsx

```jsx
export default function EquipmentArt({ category, small = false }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return <svg className={small ? 'equipment-art small-art' : 'equipment-art'} viewBox="0 0 280 170" aria-hidden="true">
    <ellipse cx="140" cy="145" rx="74" ry="9" fill="currentColor" opacity=".09" />
    <g {...common}>
      {category === 'Cameras' && <>
        <path d="M77 69h24l11-18h44l10 18h34a10 10 0 0 1 10 10v51a10 10 0 0 1-10 10H77a10 10 0 0 1-10-10V79a10 10 0 0 1 10-10Z" fill="currentColor" fillOpacity=".09" />
        <circle cx="141" cy="103" r="28" fill="var(--art-bg, #e1ebe5)"/><circle cx="141" cy="103" r="18"/><path d="m133 94 13 18m-14-4 15-12" opacity=".3"/><path d="M176 84h15M79 82h15M82 61h17"/>
      </>}
      {category === 'Tools' && <>
        <path d="M76 55h81a9 9 0 0 1 9 9v35H77a12 12 0 0 1-12-12V67a12 12 0 0 1 11-12Z" fill="currentColor" fillOpacity=".1"/>
        <path d="M165 63h20v27h-20m20-19h28m-94 29-7 35H83l7-35m-12 36h47v11H78zM79 68h17m-17 10h17m-17 10h17"/>
      </>}
      {category === 'Outdoor' && <>
        <path d="m140 38 77 99H63l77-99Z" fill="currentColor" fillOpacity=".08"/>
        <path d="m140 38 38 99m-38-99-38 99m38-61 21 61h-42l21-61ZM140 29v12M60 144h160M79 70l-7-4m133 1-7 5"/>
        <path d="M58 42h17m-8-8v16M209 33h10m-5-5v10" strokeWidth="2" opacity=".4"/>
      </>}
      {category === 'Electronics' && <>
        <path d="M80 72h117a13 13 0 0 1 13 13v37a13 13 0 0 1-13 13H80a13 13 0 0 1-13-13V85a13 13 0 0 1 13-13Z" fill="currentColor" fillOpacity=".09"/>
        <ellipse cx="178" cy="103" rx="22" ry="23"/><ellipse cx="178" cy="103" rx="13" ry="14"/>
        <path d="M82 91h42m-42 10h42m-42 10h42M83 136v6m108-6v6M99 61h71"/>
      </>}
      {category === 'Events' && <>
        <rect x="101" y="35" width="79" height="109" rx="13" fill="currentColor" fillOpacity=".09"/>
        <circle cx="140" cy="105" r="25"/><circle cx="140" cy="105" r="12"/><circle cx="140" cy="61" r="10"/>
        <path d="M194 77V52l16-4v22m-16 10c-8-7-14 4-6 7 4 1 6-2 6-7Zm16-8c-8-7-14 4-6 7 4 1 6-2 6-7Z" strokeWidth="2"/>
      </>}
    </g>
  </svg>;
}
```

## frontend/src/api.js

```javascript
let securityToken;

export function clearSecurityToken() { securityToken = undefined; }

export async function api(path, options = {}) {
  const method = options.method || 'GET';
  const headers = { ...options.headers };
  if (method !== 'GET') {
    if (!securityToken) {
      const response = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Cannot connect securely to the server. Refresh and try again.');
      securityToken = await response.json();
    }
    headers[securityToken.headerName] = securityToken.token;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  }
  const response = await fetch('/api' + path, {
    ...options, method, headers, credentials: 'same-origin',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 403) clearSecurityToken();
    const error = new Error(data.message || 'The request failed. Please try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}
```

## frontend/src/main.jsx

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
```

## frontend/src/styles.css

```css
:root{font-family:Inter,"Segoe UI",Arial,sans-serif;color:#233d34;background:#f8f9f6;font-synthesis:none;font-weight:400;--green:#153f35;--mint:#e5eedf;--lime:#dbf6a5;--muted:#778179;--border:#e4e8e0}
*{box-sizing:border-box}body{margin:0}button,input,select,textarea{font:inherit}button,a,input,select,textarea{-webkit-tap-highlight-color:transparent}button,a{touch-action:manipulation}button{cursor:pointer}button:disabled{cursor:not-allowed;opacity:.5}button{transition:background .18s,transform .18s,box-shadow .18s}button:not(:disabled):active{transform:translateY(1px)}a{color:inherit}button:focus-visible,a:focus-visible{outline:3px solid #91ad72;outline-offset:4px}input:focus,select:focus,textarea:focus{outline:2px solid #9bb58a;outline-offset:1px}h1,h2,h3,p{margin:0}button svg{flex-shrink:0}.app-shell{min-height:100vh}.sidebar{width:240px;position:fixed;inset:0 auto 0 0;background:#fff;border-right:1px solid var(--border);padding:35px 20px 22px;display:flex;flex-direction:column;z-index:10}.brand{display:flex;align-items:center;text-decoration:none;font-size:30px;font-weight:750;letter-spacing:-1.4px;padding:0 10px}.brand-dot{color:#83a859}.brand-mark{position:relative;width:34px;height:35px;background:var(--green);border-radius:11px;color:var(--lime);font-size:26px;font-weight:600;line-height:30px;padding-left:8px;margin-right:10px;letter-spacing:-2px}.brand-mark span{position:absolute;font-size:19px;right:4px;top:-3px}.workspace-label{font-size:9px;font-weight:700;color:#a0a79f;letter-spacing:1.6px;margin:53px 14px 16px}.nav-item{width:100%;display:flex;align-items:center;gap:11px;padding:15px 13px;border:0;background:transparent;text-align:left;font-size:12px;font-weight:550;color:#707a73;border-radius:8px;margin-bottom:6px}.nav-item svg:last-child:not(:first-child){margin-left:auto}.nav-item:hover{background:#f2f5ee}.nav-item.selected{color:var(--green);background:#eaf0e3;font-weight:700}.sidebar-note{margin:55px 10px 20px;background:#f4f6ec;border:1px solid #e9eddd;border-radius:12px;padding:18px 17px 20px}.note-icon{color:#6d8956;font-size:26px}.sidebar-note h3{font-size:18px;line-height:1.35;font-weight:650;letter-spacing:-.4px;margin:11px 0}.sidebar-note p{font-size:11px;line-height:1.8;color:#858d7f}.tiny-tag{display:block;font-size:8px;letter-spacing:1px;color:#7c8d69;margin-top:22px;font-weight:700}.sidebar-bottom{display:flex;align-items:center;gap:7px;margin-top:auto;color:#8a9388;font-size:8px;padding:15px 6px 0}.main-column{margin-left:240px}.topbar{height:91px;background:#fff;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 43px;gap:20px}.breadcrumb{font-size:11px;color:#929a92}.breadcrumb span{margin:0 13px;color:#b8beb6}.breadcrumb strong{font-weight:550;color:#405344}.account-actions{display:flex;align-items:center;gap:12px;font-size:11px}.muted{color:#8a9389}.account-avatar{height:35px;width:35px;display:grid;place-items:center;background:#e7eddf;color:var(--green);border-radius:50%;font-weight:700}.account-info{display:flex;flex-direction:column;gap:4px}.account-info strong{font-size:11px;font-weight:600}.account-info span{font-size:9px;color:#969e93}.icon-button{display:grid;place-items:center;border:0;background:transparent;width:34px;height:34px;border-radius:50%;color:#758170}.icon-button:hover{background:#edf1e7}main{max-width:1540px;padding:34px 43px 0;margin:auto}.button{border:1px solid transparent;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;gap:12px;padding:13px 19px;font-size:12px;font-weight:600;text-decoration:none;white-space:nowrap}.button.dark{background:var(--green);color:#fff}.button.dark:hover:not(:disabled){background:#23594b;box-shadow:0 3px 9px #173e3320}.button.secondary{background:#fff;border-color:#dfe5db;color:#4d5d4d}.button.secondary:hover:not(:disabled){background:#edf3e8}.button.small{font-size:10px;padding:10px 13px;gap:7px}.button.full{width:100%}.hero{position:relative;display:flex;min-height:342px;border-radius:15px;overflow:hidden;background:#e7eedf;padding:38px 39px;isolation:isolate}.hero-copy{z-index:2;flex:1}.eyebrow{font-size:9px;font-weight:700;letter-spacing:1.6px;display:flex;align-items:center;gap:7px;color:#58774d}.live-dot{height:5px;width:5px;background:#668b51;display:inline-block;border-radius:50%}.hero h1{font-size:clamp(30px,3.3vw,48px);font-weight:650;line-height:1.15;letter-spacing:-2px;margin:19px 0 14px}.hero h1 span{color:#5d7953}.hero p{font-size:12px;line-height:1.85;color:#78856e;margin-bottom:20px}.hero .button{font-size:11px;padding:12px 17px}.hero-foot{display:flex;align-items:center;gap:6px;font-size:9px;color:#6d7f62;margin-top:19px}.hero-foot>span{margin:0 6px}.hero-visual{position:relative;flex:0 0 39%;min-height:240px;z-index:1}.orbit{position:absolute;border:1px solid #cbd9bcb0;border-radius:50%;width:330px;height:330px;top:7px;left:-12px}.orbit-two{width:260px;height:260px;top:43px;left:23px}.hero-art{position:absolute;width:290px;max-width:110%;top:70px;left:-7px;transform:rotate(-10deg);color:#315c45;filter:drop-shadow(0 18px 13px #6b806433)}.hero-art .equipment-art{width:100%;height:auto;--art-bg:#c9dcb8}.visual-sticker{font-size:9px;letter-spacing:1.4px;line-height:1.5;color:#6b8355;position:absolute;right:15px;top:20px;transform:rotate(8deg);font-weight:700}.visual-sticker span{font-size:25px;display:block;margin-top:5px}.floating-label{position:absolute;right:-9px;bottom:11px;background:#fffdf5;border:1px solid #e1e7d5;padding:12px 18px;box-shadow:0 7px 15px #49603e0d;border-radius:10px;transform:rotate(-5deg);display:flex;align-items:center;gap:10px;font-size:12px;font-weight:650}.floating-label>span{background:#e5efd9;color:#5f804a;height:28px;width:28px;display:grid;place-items:center;border-radius:50%;font-size:17px}.floating-label small{display:block;font-size:8px;color:#8d9980;margin-top:4px;font-weight:400}.hero-star{font-size:31px;position:absolute;left:10px;top:4px;color:#9db48a}.catalogue-section{margin-top:39px;scroll-margin-top:25px}.section-top{display:flex;justify-content:space-between;gap:20px;align-items:end}.subtle{color:#9aa38f;font-size:8px;letter-spacing:1.6px}h2{font-size:23px;font-weight:650;letter-spacing:-.7px}.section-top h2{margin-top:9px}.search-box{width:290px;background:#fff;border:1px solid var(--border);border-radius:7px;display:flex;align-items:center;gap:10px;padding:0 12px;color:#8d9885}.search-box input{background:transparent;border:0;width:100%;padding:13px 0;font-size:10px;color:#3a4e37}.search-box input:focus{outline:0}.search-box:focus-within{outline:2px solid #9bb58a}.search-box input::placeholder{color:#a3ab9d}.category-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:3px;margin:23px 0 17px}.category{padding:9px 15px;border:1px solid #e2e7db;border-radius:6px;background:#fff;color:#85907b;font-size:10px;white-space:nowrap}.category:hover{background:#edf3e7}.category.active{color:#fff;background:var(--green);border-color:var(--green)}.results-line{display:flex;justify-content:space-between;color:#959e8f;font-size:9px;margin-bottom:15px}.results-line span:last-child{color:#b0b7a7}.equipment-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.equipment-card{border:1px solid #e4e8df;border-radius:11px;overflow:hidden;background:#fff;transition:transform .2s,box-shadow .2s}.equipment-card:hover{transform:translateY(-3px);box-shadow:0 8px 22px #273f2810}.art-panel{position:relative;height:188px;display:flex;align-items:center;justify-content:center}.art-cameras{background:#e9eee6;color:#5c735e;--art-bg:#e9eee6}.art-tools{background:#f2eee2;color:#a29162;--art-bg:#f2eee2}.art-outdoor{background:#e7ede3;color:#728568;--art-bg:#e7ede3}.art-electronics{background:#e8eced;color:#72848c;--art-bg:#e8eced}.art-events{background:#f2e9e5;color:#a48478;--art-bg:#f2e9e5}.equipment-art{width:95%;height:160px;max-width:270px;transition:transform .3s}.equipment-card:hover .equipment-art{transform:scale(1.035)}.equipment-category{position:absolute;top:13px;left:13px;font-size:8px;padding:5px 8px;background:#ffffffb8;border-radius:4px;color:#74816a}.stock-label{position:absolute;top:16px;right:12px;display:flex;align-items:center;gap:4px;font-size:7px;color:#728266}.stock-label:before{content:'';width:4px;height:4px;border-radius:50%;background:#8da477}.stock-label.unavailable{color:#ab7a5b}.stock-label.unavailable:before{background:#c79871}.card-body{padding:19px 17px 15px}.card-body h3{font-size:13px;letter-spacing:-.15px;font-weight:650}.card-body>p{font-size:10px;color:#949c8c;line-height:1.75;margin:9px 0 20px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:35px}.card-bottom{border-top:1px solid #eef0e9;padding-top:13px;display:flex;align-items:center;justify-content:space-between}.price{font-size:16px;font-weight:700;letter-spacing:-.4px}.price>span{color:#9fa693;font-size:9px;font-weight:400;letter-spacing:0}.rent-button{height:30px;width:32px;border:1px solid #e2e8d9;background:#f0f5e9;border-radius:6px;display:grid;place-items:center;color:#607d4d}.rent-button:hover:not(:disabled){background:#ddecc8}.promise-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding:30px 8px;border-top:1px solid var(--border);margin-top:38px}.promise-strip>div{display:grid;grid-template-columns:28px 1fr;gap:5px 8px}.promise-strip svg{grid-row:1/3;color:#7b9168}.promise-strip strong{font-size:10px;font-weight:600}.promise-strip span{font-size:9px;color:#9ca48f}footer{display:flex;align-items:center;gap:20px;border-top:1px solid var(--border);padding:22px 0;color:#a0a793;font-size:8px;margin-top:25px}footer span:last-child{margin-left:auto}.footer-brand{font-size:17px;letter-spacing:-.8px;color:#6e8061;font-weight:700}.page-heading{margin:5px 0 28px}.page-heading h1{font-size:32px;letter-spacing:-1.2px;font-weight:650;margin:13px 0}.page-heading p{font-size:12px;color:#8c9684;line-height:1.8}.heading-with-action{display:flex;justify-content:space-between;align-items:center;gap:20px}.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:30px 0}.stat-card{border:1px solid var(--border);background:#fff;padding:20px;border-radius:10px;display:flex;flex-direction:column;gap:12px}.stat-card>span{font-size:10px;color:#929b89}.stat-card>strong{font-size:27px;letter-spacing:-.9px;font-weight:650}.stat-card:last-child{background:#eaf0e1}.bookings-toolbar{display:flex;align-items:center;justify-content:space-between;margin:30px 0 18px;gap:15px}.bookings-toolbar h2{font-size:19px}.toolbar-controls{display:flex;gap:9px;align-items:center}.toolbar-controls input{width:150px}.toolbar-controls input,.toolbar-controls select{font-size:10px;padding:10px}.booking-list{display:flex;flex-direction:column;gap:14px}.booking-card{display:flex;align-items:center;gap:20px;border:1px solid var(--border);background:#fff;border-radius:11px;padding:18px}.booking-art{width:125px;height:120px;flex-shrink:0;border-radius:7px;display:grid;place-items:center}.small-art{width:100%;height:auto}.booking-detail{flex:1;min-width:0}.booking-title{display:flex;align-items:center;gap:15px}.booking-detail h3{font-size:16px;letter-spacing:-.4px;margin:9px 0}.booking-detail>p{font-size:10px;line-height:1.8;color:#939c88}.booking-detail p>span{margin:0 5px;color:#bbc0b3}.status{font-size:8px;letter-spacing:.15px;display:inline-block;padding:5px 9px;border-radius:4px;white-space:nowrap}.status-pending{color:#9f7c38;background:#fbf2dd}.status-approved{color:#56804b;background:#eaf4e5}.status-returned{color:#698b91;background:#e9f3f3}.status-rejected,.status-cancelled{color:#9c7f74;background:#f5ede9}.booking-money{display:flex;gap:18px;flex-wrap:wrap;font-size:9px;color:#9ba38e;margin-top:12px}.booking-money strong{color:#4b6040;margin-left:5px;font-weight:600}.booking-money .late-fee,.booking-money .late-fee strong{color:#b17d47}.booking-actions{display:flex;flex-direction:column;gap:8px;min-width:100px}.customer-line{overflow-wrap:anywhere}.danger-text{color:#ae7562!important}.helper{font-size:10px;color:#99a08e;line-height:1.8;margin-top:13px}.inventory-list{display:flex;flex-direction:column;gap:12px}.inventory-item{padding:15px 17px;border:1px solid var(--border);border-radius:10px;background:#fff;display:flex;align-items:center;gap:15px}.inventory-art{width:95px;height:69px;border-radius:6px;display:grid;place-items:center}.inventory-info{flex:1}.inventory-info h3{font-size:13px;font-weight:600}.inventory-info p{font-size:10px;color:#949c8b;line-height:1.7;margin-top:7px}.inventory-info p span{margin:0 5px}.empty{padding:58px 25px;text-align:center;color:#a3ae94;border:1px dashed #dfe7d4;border-radius:12px;background:#f4f7ef;margin-top:20px}.empty h3{font-size:19px;color:#6c805a;margin:16px 0 9px}.empty p{font-size:12px}.error-banner{color:#a66649;background:#fcf0e7;padding:16px 20px;border:1px solid #eed9c6;border-radius:9px;font-size:12px;line-height:1.8;margin-bottom:20px}.modal{width:465px;max-width:calc(100vw - 28px);padding:28px;border:1px solid #e2e6db;border-radius:16px;box-shadow:0 30px 100px #112a2d30;color:#33482d;background:#fffefb;max-height:90vh;overflow-y:auto}.modal::backdrop{background:#17392f80;backdrop-filter:blur(4px)}.modal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}.modal-head h2{font-size:22px;letter-spacing:-.7px}.modal-head .icon-button{flex-shrink:0}.modal-description{color:#8a967e;font-size:12px;line-height:1.8;margin:10px 0 22px}.form-stack{display:flex;flex-direction:column;gap:18px}.form-stack label{font-size:11px;color:#647156;font-weight:550;display:flex;flex-direction:column;gap:8px}.form-stack input,.form-stack select,.form-stack textarea,.text-input,.toolbar-controls select{padding:12px;border:1px solid #dfe6d6;border-radius:7px;background:#fff;color:#475f37;font-size:12px;width:100%;min-width:0}.form-stack input::placeholder{color:#b0b8a4}.form-stack textarea{resize:vertical}.two-fields{display:grid;grid-template-columns:1fr 1fr;gap:15px}.form-error{color:#ad6a4b;font-size:11px;line-height:1.7;background:#fcf0e7;padding:10px;border-radius:6px}.form-actions{display:flex;justify-content:flex-end;gap:12px;margin-top:25px}.auth-tabs{display:flex;gap:5px;background:#eff3e9;border-radius:7px;padding:4px;margin:20px 0}.auth-tabs button{flex:1;background:transparent;border:0;padding:10px;border-radius:5px;font-size:11px;color:#94a084}.auth-tabs button.active{background:#fff;color:#46633b;box-shadow:0 2px 6px #6c845514}.demo-logins{display:flex;align-items:center;justify-content:center;gap:9px;flex-wrap:wrap;border-top:1px solid var(--border);margin-top:23px;padding-top:18px}.demo-logins>span{display:block;width:100%;text-align:center;font-size:8px;letter-spacing:1.8px;color:#acb39e;margin-bottom:3px}.demo-logins button{border:0;background:#eff4e8;color:#778e60;font-size:9px;border-radius:5px;padding:8px 11px}.booking-summary{display:flex;align-items:center;gap:16px;margin:20px 0 25px}.summary-art{width:95px;height:70px;border-radius:8px;display:grid;place-items:center}.booking-summary h3{font-size:14px}.booking-summary p{font-size:11px;margin-top:7px;color:#91a17c}.price-summary{background:#f1f5ea;border:1px solid #e5ebda;border-radius:9px;padding:16px}.price-summary>span{display:flex;justify-content:space-between;align-items:center;gap:15px;font-size:11px;color:#7c8f64;line-height:1.8}.price-summary strong{color:#456039;font-size:14px}.price-summary small{display:block;font-size:9px;color:#a1ae90;line-height:1.7;margin-top:10px}.price-summary .total-row{margin-top:10px;padding-top:10px;border-top:1px solid #dce5cf}.availability-yes{font-size:11px;color:#6f9258}.toast{position:fixed;bottom:26px;right:26px;max-width:calc(100vw - 40px);display:flex;align-items:center;gap:11px;background:#1d5141;color:#f4f9ee;border-radius:10px;padding:15px 18px;box-shadow:0 5px 25px #1a392838;font-size:12px;line-height:1.6;z-index:100}.toast>svg{flex-shrink:0}.toast-error{background:#a36b4f}.toast>button{background:transparent;color:inherit;border:0;font-size:20px;margin-left:10px}
@media(min-width:1600px){.hero{min-height:380px}.hero-visual{flex-basis:42%}.hero-art{width:340px;left:35px}.orbit{left:38px}.orbit-two{left:73px}.art-panel{height:220px}.equipment-art{height:185px;max-width:300px}.hero-art .equipment-art{height:auto}.small-art{height:auto}.visual-sticker{right:55px}.floating-label{right:45px;bottom:28px}}
@media(max-width:1200px){.sidebar{width:205px;padding-left:13px;padding-right:13px}.main-column{margin-left:205px}.topbar{padding:0 28px}main{padding:28px 28px 0}.hero{padding:30px;min-height:325px}.hero h1{font-size:36px}.hero-visual{flex-basis:35%}.hero-art{width:240px;top:80px;left:-20px}.orbit{left:-35px}.orbit-two{left:0}.visual-sticker{right:-8px;font-size:7px}.floating-label{right:-12px;padding:10px;font-size:10px}.hero-star{left:-12px}.equipment-grid{gap:14px}.card-body{padding:16px 13px 13px}.card-body h3{font-size:12px}.art-panel{height:165px}.equipment-art{height:135px}.small-art{height:auto}.equipment-category{left:10px;font-size:7px}.stock-label{font-size:6px}.section-top{gap:15px}.search-box{width:230px}.booking-art{width:95px;height:100px}.booking-card{gap:14px}.booking-detail h3{font-size:14px}.booking-money{gap:9px}.stat-card{padding:17px}.stat-card>strong{font-size:23px}}
@media(max-width:980px){.sidebar{width:180px;padding-left:10px;padding-right:10px}.main-column{margin-left:180px}.brand{font-size:26px;padding:0 7px}.brand-mark{width:30px;height:32px;margin-right:7px}.nav-item{font-size:10px;padding:13px 9px;gap:8px}.workspace-label{font-size:8px;margin-left:10px}.sidebar-note{margin-left:5px;margin-right:5px;padding:15px 13px}.sidebar-note h3{font-size:16px}.sidebar-bottom{font-size:7px}.topbar{padding:0 23px}.desktop-only{display:none}main{padding:24px 23px 0}.hero{min-height:300px;padding:27px}.hero h1{font-size:31px;letter-spacing:-1.3px}.hero p{font-size:10px;max-width:260px}.hero .eyebrow{font-size:7px}.hero-visual{flex-basis:28%}.hero-art{width:210px;max-width:none;left:-40px;top:95px}.orbit{width:250px;height:250px;left:-60px;top:25px}.orbit-two{width:200px;height:200px;left:-35px;top:50px}.visual-sticker{right:-10px;top:28px;font-size:6px}.hero-star{left:-30px;top:16px}.floating-label{bottom:0;right:-8px;font-size:8px;padding:8px}.floating-label small{font-size:7px}.floating-label>span{height:21px;width:21px;font-size:13px}.equipment-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.art-panel{height:175px}.equipment-art{height:155px}.section-top{align-items:start;flex-direction:column;gap:17px}.search-box{width:100%}.results-line span:last-child{display:none}.promise-strip{gap:14px;grid-template-columns:1fr}.promise-strip>div{gap:5px 8px}.promise-strip strong{font-size:11px}.promise-strip span{font-size:10px}.promise-strip svg{grid-row:1/3}.stats-grid{grid-template-columns:repeat(2,1fr)}.booking-card{align-items:start;flex-wrap:wrap}.booking-art{width:80px;height:85px}.booking-actions{flex-direction:row;width:100%;justify-content:flex-end}.booking-detail>p{font-size:9px}.bookings-toolbar{align-items:start;flex-direction:column}.toolbar-controls{width:100%;flex-wrap:wrap}.toolbar-controls input{flex:1;width:100px}.toolbar-controls select{width:135px}.inventory-item{flex-wrap:wrap;gap:12px}.inventory-info{flex-basis:calc(100% - 120px)}.inventory-item .status{margin-left:107px}.inventory-art{width:80px}.heading-with-action{align-items:start;flex-direction:column;margin-bottom:25px;gap:0}.page-heading h1{font-size:28px}footer{gap:12px}footer span:last-child{display:none}}
@media(max-width:650px){.sidebar{position:relative;width:100%;padding:17px 18px 0;border-right:0;border-bottom:1px solid var(--border)}.brand{font-size:26px;padding:0}.sidebar .workspace-label,.sidebar-note,.sidebar-bottom{display:none}.sidebar nav{display:flex;gap:6px;margin-top:17px;overflow-x:auto}.nav-item{margin:0;width:auto;white-space:nowrap;border-radius:7px 7px 0 0;padding:13px 11px;font-size:10px;gap:6px}.nav-item svg:last-child:not(:first-child){display:none}.nav-item svg{height:16px;width:16px}.main-column{margin-left:0}.topbar{height:65px;padding:0 19px}.breadcrumb{font-size:9px}.breadcrumb span{margin:0 7px}.account-actions{gap:8px}.account-info strong{font-size:9px;max-width:115px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.account-info span{font-size:8px}.account-avatar{height:29px;width:29px;font-size:11px}.account-actions .icon-button{height:25px;width:25px}.account-actions .icon-button svg{height:17px;width:17px}main{padding:19px 17px 0}.hero{padding:26px 23px;min-height:315px;border-radius:12px}.hero h1{font-size:34px;letter-spacing:-1.5px}.hero-copy{flex:0 0 100%}.hero p{font-size:11px;max-width:235px;position:relative;z-index:1}.hero-visual{position:absolute;right:-50px;bottom:-70px;width:230px;min-height:200px;opacity:.25;z-index:0}.hero-art{top:5px;left:10px}.hero-visual .visual-sticker,.hero-visual .floating-label,.hero-star{display:none}.orbit{top:-40px}.orbit-two{top:-15px}.hero-foot{font-size:8px}.hero .eyebrow{font-size:7px}.catalogue-section{margin-top:30px}h2{font-size:22px}.subtle{font-size:7px}.category-row{gap:7px;margin-top:19px}.category{font-size:9px;padding:8px 12px}.results-line{font-size:8px}.equipment-grid{gap:12px}.art-panel{height:145px}.equipment-art{height:125px}.equipment-category{font-size:6px;top:9px;left:8px;padding:4px 6px}.stock-label{top:11px;right:7px;font-size:5px;gap:3px}.stock-label:before{width:3px;height:3px}.card-body{padding:13px 11px}.card-body h3{font-size:11px;line-height:1.5;min-height:33px}.card-body>p{font-size:9px;line-height:1.7;margin:5px 0 12px;min-height:31px}.price{font-size:13px}.price>span{font-size:7px}.rent-button{width:27px;height:27px}.rent-button svg{width:16px}.card-bottom{padding-top:10px}.promise-strip{padding:23px 3px;margin-top:27px;gap:19px}footer{padding:20px 0;font-size:7px;gap:12px}.footer-brand{font-size:15px}.page-heading{margin:7px 0 22px}.page-heading h1{font-size:28px}.page-heading p{font-size:11px}.stats-grid{gap:10px}.stat-card{padding:16px}.stat-card>span{font-size:9px}.stat-card>strong{font-size:24px}.booking-card{padding:14px;gap:12px}.booking-art{width:65px;height:75px}.booking-detail h3{font-size:13px}.booking-title{gap:7px;flex-wrap:wrap}.booking-title .eyebrow{font-size:6px}.status{font-size:7px;padding:4px 6px}.booking-detail>p{font-size:8px}.booking-detail p>span{margin:0 3px}.booking-money{gap:6px;font-size:8px}.booking-money strong{margin-left:3px}.booking-actions .button{font-size:9px}.inventory-item{padding:13px;gap:10px}.inventory-art{width:70px;height:60px}.inventory-info{flex-basis:calc(100% - 85px)}.inventory-info h3{font-size:12px}.inventory-item .status{margin-left:0}.inventory-item .button{font-size:9px;padding:9px 11px}.inventory-info p{font-size:9px}.modal{padding:23px}.modal-head h2{font-size:20px}.two-fields{gap:10px}.form-stack input{padding:11px 9px;font-size:11px}.modal .helper{font-size:9px}.toast{bottom:16px;right:14px;padding:12px 14px;font-size:11px;max-width:calc(100vw - 28px)}.small-art{height:auto}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
```

## frontend/vite.config.js

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:8080' } },
  preview: { port: 4173, proxy: { '/api': 'http://localhost:8080' } },
});
```

