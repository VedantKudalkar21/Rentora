package com.rentora;

import java.util.List;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface EquipmentPhotoRepository extends JpaRepository<EquipmentPhoto,Long> {
    // Fetch only IDs for cards and galleries; image bytes are served on demand.
    @Query("select p.id from EquipmentPhoto p where p.equipment.id = :equipmentId order by p.id")
    List<Long> findIdsByEquipmentId(@Param("equipmentId") Long equipmentId);
    @Modifying
    @Query("delete from EquipmentPhoto p where p.equipment.id = :equipmentId")
    void deleteForEquipment(@Param("equipmentId") Long equipmentId);
}
