import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Search,
  Plus,
  ArrowUpRight,
  RefreshCw,
  Images,
  Pencil,
  CalendarDays,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { Card } from "./components/ui/card";
import EquipmentArt from "./EquipmentArt";
import { ProductImage } from "./ProductPhotos";
import { CATEGORIES, dateLabel, money, statusLabel, today } from "./uiHelpers";

export function BookingsPage({
  user,
  bookings,
  equipment,
  loading,
  working,
  onRefresh,
  onMutate,
  onDialog,
}) {
  const admin = user.role === "ADMIN";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const rows = bookings.filter(
    (booking) =>
      (status === "ALL" || booking.status === status) &&
      `${booking.equipmentName} ${booking.customerName} ${booking.customerEmail} ${booking.id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="kicker">
            {admin ? "RENTAL OPERATIONS" : "YOUR PLANS, ALL IN ONE PLACE"}
          </span>
          <h1>{admin ? "Manage bookings." : "My rentals."}</h1>
          <p>
            {admin
              ? "Review requests and keep track of returns."
              : "Follow your requests, active rentals, and history."}
          </p>
        </div>
        <Button variant="outline" onClick={onRefresh}>
          <RefreshCw size={16} />
          Refresh
        </Button>
      </div>
      <div className="bookings-toolbar">
        <div className="table-search">
          <Search size={17} />
          <Input
            aria-label="Search bookings"
            placeholder="Search bookings"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          aria-label="Filter bookings by status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="ALL">All statuses</option>
          {["PENDING", "APPROVED", "REJECTED", "CANCELLED", "RETURNED"].map(
            (value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ),
          )}
        </select>
        <span>{rows.length} bookings</span>
      </div>
      {loading ? (
        <div className="empty" role="status">
          Loading bookings…
        </div>
      ) : (
        <div className="booking-list">
          {rows.map((booking) => {
            const item = equipment.find(
              (item) => item.id === booking.equipmentId,
            );
            return (
              <motion.article layout className="rental-row" key={booking.id}>
                <div
                  className={
                    "rental-row-image art-" + booking.category.toLowerCase()
                  }
                >
                  {item?.photos?.length ? (
                    <ProductImage
                      photo={item.photos[0]}
                      alt={booking.equipmentName}
                    />
                  ) : (
                    <EquipmentArt category={booking.category} small />
                  )}
                </div>
                <div className="rental-row-main">
                  <div className="rental-row-top">
                    <span className="record-number">
                      BOOKING #{String(booking.id).padStart(4, "0")}
                    </span>
                    <span
                      className={
                        "status status-" + booking.status.toLowerCase()
                      }
                    >
                      {statusLabel(booking.status)}
                    </span>
                  </div>
                  <h3>{booking.equipmentName}</h3>
                  <p>
                    {dateLabel(booking.startDate)} <span>→</span>{" "}
                    {dateLabel(booking.endDate)} <span>·</span> {booking.days}{" "}
                    {booking.days === 1 ? "day" : "days"}
                  </p>
                  {admin && (
                    <p className="rental-customer">
                      {booking.customerName} · {booking.customerEmail}
                    </p>
                  )}
                  <div className="rental-amounts">
                    <span>
                      Rental <strong>{money(booking.rentalAmount)}</strong>
                    </span>
                    {Number(booking.lateFee) > 0 && (
                      <span className="late-fee">
                        {booking.status === "RETURNED"
                          ? "Late fee"
                          : "Estimated late fee"}{" "}
                        <strong>{money(booking.lateFee)}</strong>
                      </span>
                    )}
                    <span>
                      Total <strong>{money(booking.total)}</strong>
                    </span>
                  </div>
                  {booking.returnedDate && (
                    <p className="helper">
                      Returned {dateLabel(booking.returnedDate)}
                    </p>
                  )}
                </div>
                <div className="rental-actions">
                  {admin && booking.status === "PENDING" && (
                    <>
                      <Button
                        size="sm"
                        disabled={working}
                        onClick={() =>
                          onMutate(
                            `/admin/bookings/${booking.id}/approve`,
                            "PATCH",
                            undefined,
                            "Booking approved.",
                          )
                        }
                      >
                        Approve
                        <ArrowUpRight size={14} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={working}
                        onClick={() =>
                          onDialog({
                            type: "confirm",
                            title: "Reject this booking?",
                            description:
                              "The reserved dates will become available again.",
                            path: `/admin/bookings/${booking.id}/reject`,
                            success: "Booking rejected.",
                          })
                        }
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {admin && booking.status === "APPROVED" && (
                    <Button
                      size="sm"
                      onClick={() => onDialog({ type: "return", booking })}
                    >
                      Record return
                    </Button>
                  )}
                  {!admin &&
                    ["PENDING", "APPROVED"].includes(booking.status) &&
                    booking.startDate >= today() && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={working}
                        onClick={() =>
                          onDialog({
                            type: "confirm",
                            title: "Cancel this booking?",
                            description: "The reserved dates will be released.",
                            path: `/bookings/${booking.id}/cancel`,
                            success: "Booking cancelled.",
                          })
                        }
                      >
                        Cancel booking
                      </Button>
                    )}
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
      {!loading && !rows.length && (
        <div className="empty">
          <CalendarDays size={30} />
          <h3>No bookings in this view.</h3>
          <p>
            {admin
              ? "New requests will appear here."
              : "Your next rental will appear here after you book."}
          </p>
        </div>
      )}
    </section>
  );
}
export function InventoryPage({ equipment, working, onDialog, onMutate }) {
  const [search, setSearch] = useState("");
  const items = equipment.filter((item) =>
    `${item.name} ${item.category}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="kicker">KEEP GOOD GEAR MOVING</span>
          <h1>Your equipment.</h1>
          <p>Manage listings, photos, pricing, and maintenance.</p>
        </div>
        <Button onClick={() => onDialog({ type: "equipment" })}>
          <Plus size={17} />
          Add equipment
        </Button>
      </div>
      <div className="table-search inventory-search">
        <Search size={17} />
        <Input
          aria-label="Search inventory"
          placeholder="Search equipment"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="inventory-list">
        {items.map((item) => (
          <article className="inventory-row" key={item.id}>
            <div
              className={
                "inventory-row-image art-" + item.category.toLowerCase()
              }
            >
              {item.photos?.length ? (
                <ProductImage photo={item.photos[0]} alt={item.name} />
              ) : (
                <EquipmentArt category={item.category} small />
              )}
            </div>
            <div className="inventory-row-info">
              <h3>{item.name}</h3>
              <p>
                {item.category} · {money(item.dailyRate)} / day
              </p>
            </div>
            <span
              className={
                item.active ? "status status-approved" : "status status-pending"
              }
            >
              {item.active ? "Listed" : "Maintenance"}
            </span>
            <div className="inventory-row-actions">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDialog({ type: "equipment", item })}
              >
                <Pencil size={14} />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDialog({ type: "photos", item })}
              >
                <Images size={14} />
                Photos
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={working}
                onClick={() =>
                  onMutate(
                    `/admin/equipment/${item.id}/active`,
                    "PATCH",
                    { active: !item.active },
                    item.active
                      ? "Equipment marked under maintenance."
                      : "Equipment listed again.",
                  )
                }
              >
                {item.active ? "Maintenance" : "List again"}
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <div className="empty">
          <h3>No equipment found.</h3>
          <p>Add an item or try another search.</p>
        </div>
      )}
    </section>
  );
}
export function EquipmentEditor({ item, working, onSave }) {
  const [form, setForm] = useState(
    item
      ? {
          name: item.name,
          category: item.category,
          description: item.description,
          dailyRate: item.dailyRate,
        }
      : { name: "", category: "Cameras", description: "", dailyRate: "" },
  );
  const change = (event) =>
    setForm({ ...form, [event.target.name]: event.target.value });
  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ ...form, dailyRate: Number(form.dailyRate) });
      }}
    >
      <label>
        Equipment name
        <Input
          name="name"
          required
          minLength={2}
          maxLength={100}
          value={form.name}
          onChange={change}
        />
      </label>
      <div className="two-fields">
        <label>
          Category
          <select name="category" value={form.category} onChange={change}>
            {CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          Daily rate (₹)
          <Input
            name="dailyRate"
            type="number"
            required
            min="1"
            max="1000000"
            step=".01"
            value={form.dailyRate}
            onChange={change}
          />
        </label>
      </div>
      <label>
        Description
        <Textarea
          name="description"
          required
          maxLength={1500}
          rows={4}
          value={form.description}
          onChange={change}
        />
      </label>
      <Button className="w-full" disabled={working}>
        {working ? "Saving…" : "Save equipment"}
      </Button>
    </form>
  );
}
export function ReturnEditor({ booking, working, onSave }) {
  const [returnedDate, setReturnedDate] = useState(today());
  const days =
    Math.max(
      0,
      Math.round(
        (new Date(returnedDate + "T00:00:00Z") -
          new Date(booking.endDate + "T00:00:00Z")) /
          86400000,
      ),
    ) || 0;
  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(returnedDate);
      }}
    >
      <label>
        Actual return date
        <Input
          type="date"
          required
          min={booking.startDate}
          max={today()}
          value={returnedDate}
          onChange={(event) => setReturnedDate(event.target.value)}
        />
      </label>
      <div className="return-quote">
        <span>
          Original rental<strong>{money(booking.rentalAmount)}</strong>
        </span>
        <span>
          Late fee · {days} days
          <strong>{money(days * Number(booking.dailyRate))}</strong>
        </span>
        <span>
          Total
          <strong>
            {money(
              Number(booking.rentalAmount) + days * Number(booking.dailyRate),
            )}
          </strong>
        </span>
      </div>
      <Button
        className="w-full"
        disabled={working || booking.startDate > today()}
      >
        {working ? "Saving…" : "Confirm return"}
      </Button>
      {booking.startDate > today() && (
        <p className="form-error">This rental has not started yet.</p>
      )}
    </form>
  );
}
