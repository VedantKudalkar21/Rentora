export const CATEGORIES = [
  "Cameras",
  "Tools",
  "Outdoor",
  "Electronics",
  "Events",
];
export const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const dateLabel = (value) =>
  value
    ? new Date(value + "T12:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
export const statusLabel = (value) =>
  value ? value[0] + value.slice(1).toLowerCase() : "";
export const profileUrl = (user) =>
  user?.role === "ADMIN" ? "/admin/profile" : "/profile";
