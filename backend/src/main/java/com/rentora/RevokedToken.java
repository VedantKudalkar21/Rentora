package com.rentora;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name="revoked_tokens")
public class RevokedToken {
    @Id @Column(length=36) String id;
    @Column(nullable=false) Instant expiresAt;
    protected RevokedToken() {}
    RevokedToken(String id,Instant expiresAt) { this.id=id;this.expiresAt=expiresAt; }
}
