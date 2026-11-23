package com.rentora;

import java.security.Principal;
import java.time.Clock;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EquipmentListingService {
    private final EquipmentRepository equipment;
    private final EquipmentPhotoRepository photos;
    private final ProductPhotoService images;
    private final AuthService auth;
    private final Clock clock;
    EquipmentListingService(EquipmentRepository equipment,EquipmentPhotoRepository photos,ProductPhotoService images,AuthService auth,Clock clock) {
        this.equipment=equipment;this.photos=photos;this.images=images;this.auth=auth;this.clock=clock;
    }
    Dto.EquipmentView view(Equipment item) {
        List<Dto.PhotoView> imageViews=photos.findIdsByEquipmentId(item.id).stream()
            .map(id -> new Dto.PhotoView(id,"/api/equipment/photos/"+id)).toList();
        return Dto.EquipmentView.from(item,imageViews);
    }
    private Dto.ListingView listing(Equipment item) {
        return new Dto.ListingView(view(item),item.approvalStatus,item.reviewNote,item.submittedAt,item.owner.email);
    }
    @Transactional
    public Dto.ListingView submit(Principal principal,Dto.ListingRequest body,List<MultipartFile> files) {
        UserAccount owner=auth.current(principal);requireRole(owner,UserAccount.Role.CUSTOMER);
        if(body.name().strip().length()<2 || body.conditionNotes().strip().length()<10) throw error(400,"Provide a product name and at least 10 characters describing its condition.");
        List<byte[]> prepared=images.prepare(files);
        Equipment item=new Equipment(body.name().strip(),body.category(),body.description().strip(),body.dailyRate());
        item.owner=owner;item.itemCondition=body.itemCondition();item.conditionNotes=body.conditionNotes().strip();
        item.approvalStatus=Equipment.ApprovalStatus.PENDING;item.active=false;item.submittedAt=clock.instant();
        equipment.save(item);
        photos.saveAll(prepared.stream().map(content -> new EquipmentPhoto(item,content)).toList());
        return listing(item);
    }
    @Transactional(readOnly=true)
    public List<Dto.ListingView> mine(Principal principal) {
        UserAccount owner=auth.current(principal);requireRole(owner,UserAccount.Role.CUSTOMER);
        return equipment.findByOwnerIdOrderByIdDesc(owner.id).stream().map(this::listing).toList();
    }
    @Transactional(readOnly=true)
    public List<Dto.ListingView> reviews(Principal principal) {
        requireRole(auth.current(principal),UserAccount.Role.ADMIN);
        return equipment.findByOwnerIsNotNullOrderByIdDesc().stream().map(this::listing).toList();
    }
    @Transactional
    public Dto.ListingView review(Principal principal,Long id,boolean approve,String reason) {
        requireRole(auth.current(principal),UserAccount.Role.ADMIN);
        Equipment item=equipment.lockById(id).orElseThrow(() -> error(404,"Listing not found."));
        if(item.owner==null) throw error(404,"Customer listing not found.");
        if(item.approvalStatus!=Equipment.ApprovalStatus.PENDING) throw error(409,"This listing has already been reviewed.");
        if(approve && photos.findIdsByEquipmentId(item.id).isEmpty()) throw error(409,"A product photo is required before approval.");
        if(!approve && (reason==null || reason.strip().length()<5)) throw error(400,"Give the customer a rejection reason of at least five characters.");
        item.approvalStatus=approve ? Equipment.ApprovalStatus.APPROVED : Equipment.ApprovalStatus.REJECTED;
        item.active=approve;item.reviewNote=approve ? "Approved for the catalogue." : reason.strip();
        return listing(item);
    }
    @Transactional
    public Dto.EquipmentView updatePhotos(Principal principal,Long id,Dto.ConditionRequest body,List<MultipartFile> files) {
        requireRole(auth.current(principal),UserAccount.Role.ADMIN);
        if(body.conditionNotes().strip().length()<10) throw error(400,"Describe the condition in at least 10 characters.");
        List<byte[]> prepared=images.prepare(files);
        Equipment item=equipment.lockById(id).orElseThrow(() -> error(404,"Equipment not found."));
        if(item.approvalStatus!=Equipment.ApprovalStatus.APPROVED) throw error(409,"Review this submission before changing its photos.");
        photos.deleteForEquipment(id);
        photos.saveAll(prepared.stream().map(content -> new EquipmentPhoto(item,content)).toList());
        item.itemCondition=body.itemCondition();item.conditionNotes=body.conditionNotes().strip();
        return view(item);
    }
    @Transactional(readOnly=true)
    public byte[] photo(Long id,Principal principal) {
        EquipmentPhoto photo=photos.findById(id).orElseThrow(() -> error(404,"Photo not found."));
        Equipment item=photo.equipment;
        if(item.approvalStatus!=Equipment.ApprovalStatus.APPROVED) {
            if(principal==null) throw error(404,"Photo not found.");
            UserAccount viewer=auth.current(principal);
            if(viewer.role!=UserAccount.Role.ADMIN && (item.owner==null || !item.owner.id.equals(viewer.id))) throw error(404,"Photo not found.");
        }
        return photo.content;
    }
    private void requireRole(UserAccount user,UserAccount.Role role) { if(user.role!=role) throw error(403,"This action is not available to your account role."); }
    private ResponseStatusException error(int status,String message) { return new ResponseStatusException(HttpStatus.valueOf(status),message); }
}
