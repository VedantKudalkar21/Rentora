package com.rentora;

import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class EquipmentController {

    private final RentalService rentals;

    EquipmentController(RentalService rentals) {
        this.rentals = rentals;
    }

    @GetMapping("/equipment")
    List<Dto.EquipmentView> list() {
        return rentals.catalogue();
    }

    @GetMapping("/equipment/{id}/availability")
    Map<String, Object> availability(
            @PathVariable Long id,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate start,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate end) {

        return rentals.availability(id, start, end);
    }

    @PostMapping("/admin/equipment")
    @ResponseStatus(HttpStatus.CREATED)
    Dto.EquipmentView create(
            @Valid @RequestBody Dto.EquipmentRequest request) {

        return rentals.saveEquipment(null, request);
    }

    @PutMapping("/admin/equipment/{id}")
    Dto.EquipmentView update(
            @PathVariable Long id,
            @Valid @RequestBody Dto.EquipmentRequest request) {

        return rentals.saveEquipment(id, request);
    }

    @PatchMapping("/admin/equipment/{id}/active")
    Dto.EquipmentView active(
            @PathVariable Long id,
            @RequestBody Dto.ActiveRequest request) {

        return rentals.setActive(id, request.active());
    }
}