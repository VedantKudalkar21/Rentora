-- Optional: the default application URL can also create this database automatically.
CREATE DATABASE IF NOT EXISTS rentora CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rentora;
-- Spring Data JPA creates users, equipment, and bookings at application startup.
-- The relationships are users (1) -> bookings (many), equipment (1) -> bookings (many).
-- Do not manually create duplicate tables. See backend/src/main/java/com/rentora for entities.
