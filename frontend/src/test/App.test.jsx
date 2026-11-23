import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import App from "../App";
import { api, hasAuthToken, setAuthSession } from "../api";
vi.mock("../api", () => ({
  api: vi.fn(),
  hasAuthToken: vi.fn(),
  setAuthSession: vi.fn(),
  clearAuthSession: vi.fn(),
}));
const customer = {
  id: 2,
  name: "Test Customer",
  email: "user@example.com",
  role: "CUSTOMER",
};
const admin = {
  id: 1,
  name: "Test Admin",
  email: "admin@example.com",
  role: "ADMIN",
};
let account;
let catalogue;
let reservations;
function Location() {
  return <output aria-label="Current URL">{useLocation().pathname}</output>;
}
function mount(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Location />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  account = null;
  catalogue = [];
  reservations = [];
  hasAuthToken.mockReturnValue(false);
  setAuthSession.mockImplementation((response) => response.user);
  api.mockImplementation(async (path, options = {}) => {
    if (path === "/equipment") return catalogue;
    if (path === "/auth/config")
      return { googleEnabled: false, googleClientId: "" };
    if (path === "/auth/me") return account;
    if (path === "/bookings/mine" || path === "/admin/bookings")
      return reservations;
    if (path.includes("/availability?"))
      return { available: true, days: 1, total: 700 };
    if (path === "/auth/register")
      return {
        accessToken: "signed-token",
        user: { ...customer, name: options.body.name },
      };
    if (path === "/profile")
      return {
        ...account,
        phone: "",
        city: options.body?.city || "Mumbai",
        bio: "",
        googleLinked: false,
        passwordLoginEnabled: true,
        ...options.body,
      };
    if (path === "/auth/login")
      return { accessToken: "signed-token", user: customer };
    return {};
  });
});
describe("Rentora URL routes and account flows", () => {
  it("redirects guests from an admin URL to the login page", async () => {
    mount("/admin/equipment");
    await screen.findByRole("heading", { name: "Welcome back." });
    expect(screen.getByLabelText("Current URL").textContent).toBe("/login");
    expect(screen.queryByRole("button", { name: "Add equipment" })).toBeNull();
  });
  it("keeps customers out of admin pages", async () => {
    account = customer;
    hasAuthToken.mockReturnValue(true);
    mount("/admin/equipment");
    await screen.findByRole("heading", { name: "Welcome back." });
    expect(screen.getByLabelText("Current URL").textContent).toBe("/dashboard");
  });
  it("opens a customer profile directly and saves changes using the API", async () => {
    account = customer;
    hasAuthToken.mockReturnValue(true);
    mount("/profile");
    const city = await screen.findByLabelText("City");
    const events = userEvent.setup();
    await events.clear(city);
    await events.type(city, "Pune");
    await events.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/profile", {
        method: "PUT",
        body: expect.objectContaining({ city: "Pune" }),
      }),
    );
    await screen.findByText("Your profile has been updated.");
  });
  it("supports the separate admin profile URL", async () => {
    account = admin;
    hasAuthToken.mockReturnValue(true);
    mount("/admin/profile");
    await screen.findByRole("heading", { name: "Admin profile." });
    expect(screen.getByLabelText("Current URL").textContent).toBe(
      "/admin/profile",
    );
    expect((await screen.findByLabelText("Email address")).readOnly).toBe(true);
  });
  it("signs in from the login URL and navigates to the customer dashboard", async () => {
    mount("/login");
    const events = userEvent.setup();
    await events.type(
      await screen.findByLabelText("Email address"),
      customer.email,
    );
    await events.type(screen.getByLabelText("Password"), "Password@123");
    await events.click(
      screen.getByRole("button", { name: "Log in", exact: true }),
    );
    await screen.findByRole("heading", { name: "Welcome back." });
    expect(api).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      skipAuth: true,
      body: { email: customer.email, password: "Password@123" },
    });
    expect(setAuthSession).toHaveBeenCalled();
    expect(screen.getByLabelText("Current URL").textContent).toBe("/dashboard");
  });
  it("returns an expired protected session to the login page", async () => {
    account = customer;
    hasAuthToken.mockReturnValue(true);
    mount("/profile");
    await screen.findByLabelText("City");
    window.dispatchEvent(new Event("rentora:unauthorized"));
    await screen.findByRole("heading", { name: "Welcome back." });
    expect(screen.getByLabelText("Current URL").textContent).toBe("/login");
  });
});

describe("Public landing and redesigned booking journey", () => {
  const camera = {
    id: 10,
    name: "Camera kit",
    category: "Cameras",
    description: "Camera and lens for your next shoot.",
    dailyRate: 700,
    active: true,
    photos: [],
    itemCondition: "GOOD",
    ownerId: null,
  };
  it("starts on the public landing with login and signup links", async () => {
    mount("/");
    await screen.findByRole("heading", { name: /Make more.*Own less/ });
    expect(screen.getByLabelText("Current URL").textContent).toBe("/");
    expect(
      screen.getByRole("link", { name: "Sign up" }).getAttribute("href"),
    ).toBe("/register");
    expect(
      screen.getAllByRole("link", { name: "Log in" })[0].getAttribute("href"),
    ).toBe("/login");
  });
  it("removes demo shortcuts and hides unavailable Google login", async () => {
    mount("/login");
    await screen.findByRole("heading", { name: "Welcome back." });
    expect(
      screen.queryByText(
        /demo|fill customer|fill admin|currently unavailable/i,
      ),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: /google|customer login|admin login/i,
      }),
    ).toBeNull();
  });
  it("creates a customer from the separate signup page", async () => {
    mount("/register");
    const events = userEvent.setup();
    await events.type(
      await screen.findByLabelText("Full name"),
      "New Customer",
    );
    await events.type(
      screen.getByLabelText("Email address"),
      "new@example.com",
    );
    await events.type(screen.getByLabelText("Password"), "Password@123");
    await events.click(
      screen.getByRole("button", { name: "Create account", exact: true }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Current URL").textContent).toBe(
        "/dashboard",
      ),
    );
    expect(api).toHaveBeenCalledWith("/auth/register", {
      method: "POST",
      skipAuth: true,
      body: {
        name: "New Customer",
        email: "new@example.com",
        password: "Password@123",
      },
    });
  });
  it("keeps the selected product through guest login and sends a booking request", async () => {
    catalogue = [camera];
    mount("/explore");
    const events = userEvent.setup();
    await events.click(
      await screen.findByRole("button", { name: "View item" }),
    );
    await screen.findByRole("dialog");
    await events.click(screen.getByRole("button", { name: "Log in to book" }));
    await events.type(
      await screen.findByLabelText("Email address"),
      customer.email,
    );
    await events.type(screen.getByLabelText("Password"), "Password@123");
    await events.click(
      screen.getByRole("button", { name: "Log in", exact: true }),
    );
    const bookingButton = await screen.findByRole("button", {
      name: "Request booking",
    });
    await waitFor(() => expect(bookingButton.disabled).toBe(false));
    await events.click(bookingButton);
    await waitFor(() =>
      expect(screen.getByLabelText("Current URL").textContent).toBe("/rentals"),
    );
    expect(api).toHaveBeenCalledWith("/bookings", {
      method: "POST",
      body: expect.objectContaining({ equipmentId: camera.id }),
    });
  });
  it("preserves the admin booking approval action", async () => {
    account = admin;
    hasAuthToken.mockReturnValue(true);
    catalogue = [camera];
    reservations = [
      {
        id: 8,
        equipmentId: 10,
        equipmentName: "Camera kit",
        category: "Cameras",
        customerName: "Test Customer",
        customerEmail: customer.email,
        startDate: "2026-12-01",
        endDate: "2026-12-01",
        days: 1,
        dailyRate: 700,
        rentalAmount: 700,
        lateFee: 0,
        total: 700,
        status: "PENDING",
      },
    ];
    mount("/admin/bookings");
    const events = userEvent.setup();
    await events.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/admin/bookings/8/approve", {
        method: "PATCH",
      }),
    );
  });
});
