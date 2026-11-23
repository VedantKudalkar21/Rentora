package com.rentora;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;

import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class RentoraIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired EquipmentRepository equipment;
    @Autowired BookingRepository bookings;
    @Autowired RentalService rentals;
    @Autowired Clock clock;
    LocalDate day() { return LocalDate.now(clock); }
    String suffix() { return UUID.randomUUID().toString().substring(0,8); }
    String login(String email,String password) throws Exception {
        MvcResult result=mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(new Dto.LoginRequest(email,password))))
            .andExpect(status().isOk()).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
    }
    String customer() throws Exception { return login("user@rentora.local","User@1234"); }
    String admin() throws Exception { return login("admin@rentora.local","Admin@123"); }
    Equipment item() { return equipment.save(new Equipment("Test Camera " + suffix(),"Cameras","Integration-test equipment",new BigDecimal("500.00"))); }
    UserAccount demoUser() { return users.findByEmail("user@rentora.local").orElseThrow(); }
    Dto.BookRequest request(Equipment e) { return new Dto.BookRequest(e.id,day(),day().plusDays(2)); }

    @Test void cataloguePublicAndAdminRoutesProtected() throws Exception {
        mvc.perform(get("/api/equipment")).andExpect(status().isOk());
        mvc.perform(get("/api/admin/bookings")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/bookings").header("Authorization","Bearer "+customer())).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/bookings").header("Authorization","Bearer "+admin())).andExpect(status().isOk());
    }
    @Test void jwtRequiredAndTamperedTokensAreRejected() throws Exception {
        String token=customer();
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("CUSTOMER"));
        String[] pieces=token.split("\\.");
        String payload=java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
            "{\"sub\":\"1\",\"role\":\"ADMIN\",\"iss\":\"rentora\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        mvc.perform(get("/api/admin/bookings").header("Authorization","Bearer "+pieces[0]+"."+payload+"."+pieces[2]))
            .andExpect(status().isUnauthorized());
    }
    @Test void registrationAlwaysCreatesCustomerAndRejectsDuplicates() throws Exception {
        String email="new-" + suffix() + "@example.com";
        String body="{\"name\":\"Test User\",\"email\":\""+email+"\",\"password\":\"Password@123\",\"role\":\"ADMIN\"}";
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.user.role").value("CUSTOMER")).andExpect(jsonPath("$.user.passwordHash").doesNotExist());
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
        assertNotEquals("Password@123",users.findByEmail(email).orElseThrow().passwordHash);
    }
    @Test void wrongPasswordFailsAndLogoutEndsSession() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"user@rentora.local\",\"password\":\"incorrect\"}")).andExpect(status().isUnauthorized());
        String session=customer();
        mvc.perform(post("/api/auth/logout").header("Authorization","Bearer "+session)).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+session)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }
    @Test void overlapConflictsAndCancellationReleasesDates() throws Exception {
        Equipment e=item(); String session=customer();
        String body=json.writeValueAsString(request(e));
        MvcResult created=mvc.perform(post("/api/bookings").header("Authorization","Bearer "+session).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.rentalAmount").value(1500)).andReturn();
        long id=json.readTree(created.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(post("/api/bookings").header("Authorization","Bearer "+session).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
        mvc.perform(patch("/api/bookings/"+id+"/cancel").header("Authorization","Bearer "+session)).andExpect(status().isOk());
        mvc.perform(post("/api/bookings").header("Authorization","Bearer "+session).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated());
    }
    @Test void inclusiveBoundariesBlockSharedEndDateButAllowNextDay() {
        Equipment e=item(); rentals.book(demoUser(),request(e));
        assertFalse((Boolean)rentals.availability(e.id,day().plusDays(2),day().plusDays(3)).get("available"));
        assertTrue((Boolean)rentals.availability(e.id,day().plusDays(3),day().plusDays(4)).get("available"));
    }
    @Test void dateValidationAndSingleDayCharge() throws Exception {
        Equipment e=item(); String session=customer();
        for (Dto.BookRequest request:List.of(new Dto.BookRequest(e.id,day().minusDays(1),day()),
            new Dto.BookRequest(e.id,day().plusDays(2),day()),new Dto.BookRequest(e.id,day(),day().plusDays(90)))) {
            mvc.perform(post("/api/bookings").header("Authorization","Bearer "+session).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(request))).andExpect(status().isBadRequest());
        }
        Dto.BookingView single=rentals.book(demoUser(),new Dto.BookRequest(e.id,day(),day()));
        assertEquals(1,single.days()); assertEquals(0,new BigDecimal("500.00").compareTo(single.rentalAmount()));
    }
    @Test void rateSnapshotSurvivesEquipmentEdit() {
        Equipment e=item(); Dto.BookingView booking=rentals.book(demoUser(),request(e));
        rentals.saveEquipment(e.id,new Dto.EquipmentRequest(e.name,"Cameras","Updated description",new BigDecimal("999.00")));
        Dto.BookingView loaded=rentals.mine(demoUser()).stream().filter(b->b.id().equals(booking.id())).findFirst().orElseThrow();
        assertEquals(0,new BigDecimal("1500.00").compareTo(loaded.rentalAmount()));
        assertEquals(0,new BigDecimal("500.00").compareTo(loaded.dailyRate()));
    }
    @Test void onlyOwnerCanCancelAndOnlyAdminCanApprove() throws Exception {
        Dto.BookingView b=rentals.book(demoUser(),request(item()));
        String email="other-"+suffix()+"@example.com";
        MvcResult registration=mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Other User\",\"email\":\""+email+"\",\"password\":\"Password@123\"}"))
            .andExpect(status().isCreated()).andReturn();
        String other=json.readTree(registration.getResponse().getContentAsString()).get("accessToken").asText();
        mvc.perform(patch("/api/bookings/"+b.id()+"/cancel").header("Authorization","Bearer "+other)).andExpect(status().isForbidden());
        mvc.perform(patch("/api/admin/bookings/"+b.id()+"/approve").header("Authorization","Bearer "+customer())).andExpect(status().isForbidden());
        mvc.perform(patch("/api/admin/bookings/"+b.id()+"/approve").header("Authorization","Bearer "+admin())).andExpect(status().isOk());
        mvc.perform(patch("/api/admin/bookings/"+b.id()+"/reject").header("Authorization","Bearer "+admin())).andExpect(status().isConflict());
    }
    @Test void actualReturnCalculatesLateFeeAndCannotBeRepeated() throws Exception {
        Equipment e=item(); Booking b=new Booking(); b.user=demoUser(); b.equipment=e;
        b.startDate=day().minusDays(4);b.endDate=day().minusDays(2);b.dailyRate=e.dailyRate;
        b.rentalAmount=e.dailyRate.multiply(BigDecimal.valueOf(3));b.status=Booking.Status.APPROVED;
        long id=bookings.save(b).id;
        String session=admin();
        mvc.perform(patch("/api/admin/bookings/"+id+"/return").header("Authorization","Bearer "+session).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(new Dto.ReturnRequest(day().plusDays(1))))).andExpect(status().isBadRequest());
        mvc.perform(patch("/api/admin/bookings/"+id+"/return").header("Authorization","Bearer "+session).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(new Dto.ReturnRequest(day())))).andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("RETURNED")).andExpect(jsonPath("$.lateFee").value(1000)).andExpect(jsonPath("$.total").value(2500));
        mvc.perform(patch("/api/admin/bookings/"+id+"/return").header("Authorization","Bearer "+session).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(new Dto.ReturnRequest(day())))).andExpect(status().isConflict());
    }
    @Test void inventoryMaintenanceCannotBreakReservations() throws Exception {
        String session=admin();
        MvcResult created=mvc.perform(post("/api/admin/equipment").header("Authorization","Bearer "+session).contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"New Drill\",\"category\":\"Tools\",\"description\":\"A useful drill\",\"dailyRate\":350}"))
            .andExpect(status().isCreated()).andReturn();
        long id=json.readTree(created.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(patch("/api/admin/equipment/"+id+"/active").header("Authorization","Bearer "+session).contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
            .andExpect(status().isOk());
        ResponseStatusException unavailable=assertThrows(ResponseStatusException.class,()->rentals.book(demoUser(),new Dto.BookRequest(id,day(),day())));
        assertEquals(409,unavailable.getStatusCode().value());
        rentals.setActive(id,true); rentals.book(demoUser(),new Dto.BookRequest(id,day(),day()));
        mvc.perform(patch("/api/admin/equipment/"+id+"/active").header("Authorization","Bearer "+session).contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
            .andExpect(status().isConflict());
    }
    @Test void concurrentRequestsCreateOnlyOneReservation() throws Exception {
        Equipment e=item(); UserAccount user=demoUser(); Dto.BookRequest body=request(e);
        ExecutorService executor=Executors.newFixedThreadPool(2);
        CountDownLatch ready=new CountDownLatch(2), start=new CountDownLatch(1);
        Callable<Integer> attempt=() -> { ready.countDown(); start.await(10,TimeUnit.SECONDS); try { rentals.book(user,body); return 201; }
            catch(ResponseStatusException ex) { return ex.getStatusCode().value(); } };
        try {
            Future<Integer> first=executor.submit(attempt), second=executor.submit(attempt);
            assertTrue(ready.await(10,TimeUnit.SECONDS)); start.countDown();
            List<Integer> codes=new java.util.ArrayList<>(List.of(first.get(15,TimeUnit.SECONDS),second.get(15,TimeUnit.SECONDS)));
            java.util.Collections.sort(codes); assertEquals(List.of(201,409),codes);
        } finally { executor.shutdownNow(); }
    }
}
