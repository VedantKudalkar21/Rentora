package com.rentora;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api")
public class BookingController {
    private final RentalService rentals;
    private final AuthService auth;
    BookingController(RentalService rentals, AuthService auth) { this.rentals=rentals; this.auth=auth; }
    @PostMapping("/bookings") @ResponseStatus(HttpStatus.CREATED)
    Dto.BookingView book(@Valid @RequestBody Dto.BookRequest req, Principal principal) { return rentals.book(auth.current(principal),req); }
    @GetMapping("/bookings/mine") List<Dto.BookingView> mine(Principal principal) { return rentals.mine(auth.current(principal)); }
    @PatchMapping("/bookings/{id}/cancel") Dto.BookingView cancel(@PathVariable Long id, Principal principal) { return rentals.cancel(id,auth.current(principal)); }
    @GetMapping("/admin/bookings") List<Dto.BookingView> all() { return rentals.all(); }
    @PatchMapping("/admin/bookings/{id}/approve") Dto.BookingView approve(@PathVariable Long id) { return rentals.decide(id,true); }
    @PatchMapping("/admin/bookings/{id}/reject") Dto.BookingView reject(@PathVariable Long id) { return rentals.decide(id,false); }
    @PatchMapping("/admin/bookings/{id}/return") Dto.BookingView returned(@PathVariable Long id,@Valid @RequestBody Dto.ReturnRequest req) { return rentals.recordReturn(id,req.returnedDate()); }
}
