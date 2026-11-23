package com.rentora;

import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController @RequestMapping("/api")
public class EquipmentListingController {
    private final EquipmentListingService listings;
    EquipmentListingController(EquipmentListingService listings) { this.listings=listings; }
    @PostMapping(value="/listings",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED)
    Dto.ListingView submit(Principal principal,@Valid @RequestPart("listing") Dto.ListingRequest body,@RequestPart("photos") List<MultipartFile> photos) {
        return listings.submit(principal,body,photos);
    }
    @GetMapping("/listings/mine") List<Dto.ListingView> mine(Principal principal) { return listings.mine(principal); }
    @GetMapping("/admin/listings") List<Dto.ListingView> reviews(Principal principal) { return listings.reviews(principal); }
    @PatchMapping("/admin/listings/{id}/approve") Dto.ListingView approve(Principal principal,@PathVariable Long id) {
        return listings.review(principal,id,true,null);
    }
    @PatchMapping("/admin/listings/{id}/reject") Dto.ListingView reject(Principal principal,@PathVariable Long id,@Valid @RequestBody Dto.RejectionRequest body) {
        return listings.review(principal,id,false,body.reason());
    }
    @PostMapping(value="/admin/equipment/{id}/photos",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    Dto.EquipmentView photos(Principal principal,@PathVariable Long id,@Valid @RequestPart("condition") Dto.ConditionRequest body,@RequestPart("photos") List<MultipartFile> photos) {
        return listings.updatePhotos(principal,id,body,photos);
    }
    @GetMapping("/equipment/photos/{id}") ResponseEntity<byte[]> image(@PathVariable Long id,Principal principal) {
        byte[] content=listings.photo(id,principal);
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).cacheControl(CacheControl.noStore())
            .header(HttpHeaders.CONTENT_DISPOSITION,"inline; filename=\"product-"+id+".jpg\"")
            .header("X-Content-Type-Options","nosniff").body(content);
    }
}
