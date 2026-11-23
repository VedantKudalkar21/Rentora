import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  Camera,
  Wrench,
  Tent,
  Monitor,
  Speaker,
  CalendarDays,
  LoaderCircle,
} from "lucide-react";
import { api } from "./api";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";
import ProductPhotos, { ProductImage, conditionLabel } from "./ProductPhotos";
import EquipmentArt from "./EquipmentArt";
import { CATEGORIES, money, today } from "./uiHelpers";

const CATEGORY_ICONS = {
  Cameras: Camera,
  Tools: Wrench,
  Outdoor: Tent,
  Electronics: Monitor,
  Events: Speaker,
};
export function EquipmentCard({ item, onView }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ duration: 0.2 }}
      className="equipment-card-motion"
    >
      <Card className="gear-card gap-0 overflow-hidden border-0 p-0 shadow-none">
        <button
          className={"gear-visual art-" + item.category.toLowerCase()}
          aria-label={"View " + item.name}
          onClick={() => onView(item)}
        >
          {item.photos?.length ? (
            <ProductImage
              photo={item.photos[0]}
              alt={item.name}
              className="gear-cover"
            />
          ) : (
            <EquipmentArt category={item.category} />
          )}
          <span className="gear-category">{item.category}</span>
          <span className="gear-open-icon">
            <ArrowUpRight size={20} />
          </span>
          {!item.active && (
            <span className="gear-maintenance">Maintenance</span>
          )}
        </button>
        <CardContent className="gear-card-content p-0">
          <div className="gear-title-row">
            <h3>
              <button onClick={() => onView(item)}>{item.name}</button>
            </h3>
          </div>
          <p className="gear-description">{item.description}</p>
          <div className="gear-condition">
            <span className="small-dot" />
            {item.conditionNotes
              ? conditionLabel(item.itemCondition)
              : "See photos & details"}
          </div>
          <div className="gear-price-row">
            <span>
              <strong>{money(item.dailyRate)}</strong>
              <small>/ day</small>
            </span>
            <Button variant="outline" size="sm" onClick={() => onView(item)}>
              View item
              <ArrowUpRight size={15} />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
export default function CataloguePage({ equipment, loading, onView }) {
  const [params, setParams] = useSearchParams();
  const category = CATEGORIES.includes(params.get("category"))
    ? params.get("category")
    : "All";
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const items = useMemo(() => {
    const filtered = equipment.filter(
      (item) =>
        (category === "All" || category === item.category) &&
        `${item.name} ${item.description}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
    return [...filtered].sort((a, b) =>
      sort === "low"
        ? Number(a.dailyRate) - Number(b.dailyRate)
        : sort === "high"
          ? Number(b.dailyRate) - Number(a.dailyRate)
          : b.id - a.id,
    );
  }, [equipment, category, search, sort]);
  return (
    <div className="catalogue-page page-container">
      <section className="catalogue-heading">
        <div>
          <span className="kicker">THE RIGHT GEAR, RIGHT HERE</span>
          <h1>
            A little gear.
            <br />
            <em>A lot of possibility.</em>
          </h1>
          <p>Find what you need. Rent it for the time you need it.</p>
        </div>
        <div className="catalogue-search">
          <Search size={20} />
          <Input
            aria-label="Search equipment"
            placeholder="Search cameras, tools, and more"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </section>
      <div className="catalogue-filters">
        <div className="category-buttons">
          <button
            className={category === "All" ? "is-selected" : ""}
            onClick={() => setParams({})}
          >
            All equipment
          </button>
          {CATEGORIES.map((name) => {
            const Icon = CATEGORY_ICONS[name];
            return (
              <button
                key={name}
                className={category === name ? "is-selected" : ""}
                onClick={() => setParams({ category: name })}
              >
                <Icon size={16} />
                {name}
              </button>
            );
          })}
        </div>
        <label className="catalogue-sort">
          <SlidersHorizontal size={16} />
          <select
            aria-label="Sort equipment"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
          </select>
        </label>
      </div>
      <div className="catalogue-result-count">
        {loading
          ? "Finding your gear…"
          : `${items.length} ${items.length === 1 ? "item" : "items"} to make it happen`}
      </div>
      {loading ? (
        <div className="gear-grid">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div className="gear-skeleton" key={index} />
          ))}
        </div>
      ) : (
        <motion.div
          className="gear-grid"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.045 } },
          }}
        >
          {items.map((item) => (
            <motion.div
              key={item.id}
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0 },
              }}
            >
              <EquipmentCard item={item} onView={onView} />
            </motion.div>
          ))}
        </motion.div>
      )}
      {!loading && !items.length && (
        <div className="empty">
          <Search size={30} />
          <h3>No equipment found.</h3>
          <p>Try another search or category.</p>
        </div>
      )}
    </div>
  );
}
export function ProductDialog({ item, user, onClose, onLogin, onBooked }) {
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(today());
  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    setChecking(true);
    setError("");
    setAvailability(null);
    api(`/equipment/${item.id}/availability?start=${start}&end=${end}`, {
      skipAuth: true,
    })
      .then((data) => {
        if (alive) setAvailability(data);
      })
      .catch((err) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, [start, end, item.id]);
  async function book(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/bookings", {
        method: "POST",
        body: { equipmentId: item.id, startDate: start, endDate: end },
      });
      await onBooked();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const own = item.ownerId === user?.id;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="product-dialog sm:max-w-[920px]">
        <div className="product-dialog-heading">
          <Badge variant="secondary">{item.category}</Badge>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>{item.description}</DialogDescription>
        </div>
        <div className="product-dialog-grid">
          <ProductPhotos item={item} />
          <form onSubmit={book} className="product-booking">
            <div className="product-dialog-price">
              {money(item.dailyRate)}
              <span>/ day</span>
            </div>
            <div className="booking-date-fields">
              <label htmlFor="rental-start">
                Start date
                <Input
                  id="rental-start"
                  type="date"
                  required
                  min={today()}
                  value={start}
                  onChange={(event) => {
                    setStart(event.target.value);
                    if (event.target.value > end) setEnd(event.target.value);
                  }}
                />
              </label>
              <label htmlFor="rental-end">
                End date
                <Input
                  id="rental-end"
                  type="date"
                  required
                  min={start || today()}
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </label>
            </div>
            <div className="booking-quote">
              <span>
                {availability
                  ? `${availability.days} ${availability.days === 1 ? "day" : "days"} × ${money(item.dailyRate)}`
                  : "Rental estimate"}
              </span>
              <strong>{availability ? money(availability.total) : "—"}</strong>
            </div>
            <p className="booking-fine-print">
              Start and end dates are included.
            </p>
            {checking ? (
              <p className="availability-note">
                <LoaderCircle size={14} className="animate-spin" />
                Checking your dates
              </p>
            ) : (
              availability && (
                <p
                  className={
                    availability.available
                      ? "availability-note available"
                      : "availability-note unavailable"
                  }
                >
                  {availability.available
                    ? "Available for these dates"
                    : "Unavailable for these dates"}
                </p>
              )
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {!user ? (
              <Button
                type="button"
                className="w-full"
                size="lg"
                onClick={() => onLogin(item)}
              >
                Log in to book
                <ArrowUpRight size={17} />
              </Button>
            ) : user.role === "ADMIN" ? (
              <Button asChild variant="outline" className="w-full">
                <Link to="/admin/equipment" onClick={onClose}>
                  Manage equipment
                </Link>
              </Button>
            ) : own ? (
              <Button type="button" disabled className="w-full">
                Your listing
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={busy || checking || !availability?.available}
              >
                {busy ? "Sending request…" : "Request booking"}
                <ArrowUpRight size={17} />
              </Button>
            )}
            <div className="booking-policy">
              <CalendarDays size={17} />
              <p>
                Admin approval confirms your rental. Late returns add{" "}
                {money(item.dailyRate)} per overdue day.
              </p>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
