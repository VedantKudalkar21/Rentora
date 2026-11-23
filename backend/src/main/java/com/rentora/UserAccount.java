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
    @Column(length = 20) String phone;
    @Column(length = 80) String city;
    @Column(length = 500) String bio;
    @Column(unique = true, length = 255) String googleSubject;
    @Column(nullable = false, columnDefinition = "boolean default true") boolean passwordLoginEnabled = true;
    @Column(nullable = false, columnDefinition = "bigint default 0") long authVersion = 0;
    protected UserAccount() {}
    UserAccount(String name, String email, String passwordHash, Role role) {
        this.name = name; this.email = email; this.passwordHash = passwordHash; this.role = role;
    }
}
