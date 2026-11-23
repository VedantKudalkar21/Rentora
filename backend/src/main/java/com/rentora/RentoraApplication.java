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
