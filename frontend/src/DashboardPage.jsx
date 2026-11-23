import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Clock3,
  PackageCheck,
  BadgeIndianRupee,
  Plus,
  Package,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import { money, dateLabel, statusLabel } from "./uiHelpers";
import EquipmentArt from "./EquipmentArt";

export default function DashboardPage({ user, bookings, loading }) {
  const admin = user.role === "ADMIN";
  const pending = bookings.filter((item) => item.status === "PENDING").length;
  const approved = bookings.filter((item) => item.status === "APPROVED").length;
  const returned = bookings.filter((item) => item.status === "RETURNED");
  const metrics = [
    { label: "Total bookings", value: bookings.length, icon: CalendarDays },
    { label: "Awaiting approval", value: pending, icon: Clock3 },
    { label: "Approved rentals", value: approved, icon: PackageCheck },
    {
      label: admin ? "Completed rental value" : "Completed rentals",
      value: admin
        ? money(returned.reduce((sum, item) => sum + Number(item.total), 0))
        : returned.length,
      icon: admin ? BadgeIndianRupee : Package,
    },
  ];
  return (
    <section className="dashboard-page">
      <div className="page-heading">
        <div>
          <span className="kicker">
            {admin
              ? "YOUR OPERATIONS, AT A GLANCE"
              : "A LITTLE LESS ADMIN. A LITTLE MORE DOING."}
          </span>
          <h1>{admin ? "Your rental overview." : "Welcome back."}</h1>
          <p>
            {admin
              ? "Keep bookings and equipment moving."
              : "Your rentals, plans, and equipment in one place."}
          </p>
        </div>
        <Button asChild>
          <Link to={admin ? "/admin/equipment" : "/explore"}>
            {admin ? "Manage equipment" : "Find your next rental"}
            <ArrowUpRight size={17} />
          </Link>
        </Button>
      </div>
      <div className="dashboard-metrics">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
          >
            <Card className="metric-card">
              <CardContent>
                <div>
                  <span>{metric.label}</span>
                  <metric.icon size={18} />
                </div>
                <strong>{loading ? "—" : metric.value}</strong>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      <div className="dashboard-main-grid">
        <Card className="recent-rentals">
          <CardContent>
            <div className="panel-heading">
              <h2>Recent bookings</h2>
              <Link to={admin ? "/admin/bookings" : "/rentals"}>
                View all
                <ArrowUpRight size={16} />
              </Link>
            </div>
            {loading ? (
              <p className="helper" role="status">
                Loading bookings…
              </p>
            ) : bookings.length ? (
              <div className="recent-rental-list">
                {bookings.slice(0, 4).map((booking) => (
                  <div className="recent-rental" key={booking.id}>
                    <div
                      className={
                        "recent-rental-art art-" +
                        booking.category.toLowerCase()
                      }
                    >
                      <EquipmentArt category={booking.category} small />
                    </div>
                    <div>
                      <h3>{booking.equipmentName}</h3>
                      <p>
                        {dateLabel(booking.startDate)} —{" "}
                        {dateLabel(booking.endDate)}
                      </p>
                    </div>
                    <span
                      className={
                        "status status-" + booking.status.toLowerCase()
                      }
                    >
                      {statusLabel(booking.status)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty">
                <CalendarDays size={30} />
                <h3>Your next plan belongs here.</h3>
                <p>
                  {admin
                    ? "New customer requests will appear here."
                    : "Browse equipment to make your first booking."}
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/explore">
                    Explore equipment
                    <ArrowUpRight size={15} />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <div className="dashboard-quick-card">
          <span className="kicker">
            {admin ? "REVIEW. APPROVE. KEEP IT MOVING." : "HAVE GEAR TO SHARE?"}
          </span>
          <h2>
            {admin
              ? "Good listings start with a closer look."
              : "Your equipment could be someone’s next great idea."}
          </h2>
          <EquipmentArt category={admin ? "Cameras" : "Tools"} />
          <Button asChild>
            <Link to={admin ? "/admin/listings" : "/my-listings"}>
              {admin ? "Review listings" : "List your equipment"}
              <ArrowUpRight size={17} />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
