package com.rentora;

import jakarta.persistence.*;

@Entity
@Table(
    name = "equipment_photos",
    indexes = @Index(
        name = "idx_photo_equipment",
        columnList = "equipment_id"
    )
)
public class EquipmentPhoto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "equipment_id")
    Equipment equipment;

    @Lob
    @Column(nullable = false, columnDefinition = "MEDIUMBLOB")
    byte[] content;

    protected EquipmentPhoto() {
    }

    EquipmentPhoto(Equipment equipment, byte[] content) {
        this.equipment = equipment;
        this.content = content;
    }
}