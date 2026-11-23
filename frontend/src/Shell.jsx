import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  ArrowRight,
  LayoutDashboard,
  Package,
  CalendarDays,
  ListPlus,
  ClipboardCheck,
  UserRound,
  LogOut,
  Menu,
  PanelLeftClose,
} from "lucide-react";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";
import { profileUrl } from "./uiHelpers";

export function Brand({ light = false }) {
  return (
    <Link
      to="/"
      className={"brand " + (light ? "brand-light" : "")}
      aria-label="Rentora home"
    >
      <span className="brand-symbol">
        <ArrowUpRight size={23} strokeWidth={2.5} />
      </span>
      <span>
        rentora<span className="brand-period">.</span>
      </span>
    </Link>
  );
}
export function PublicHeader({ user }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  const links = (
    <>
      <NavLink to="/explore">Explore equipment</NavLink>
      <Link to="/#how-it-works">How it works</Link>
      <Link to={user?.role === "ADMIN" ? "/admin/equipment" : "/my-listings"}>
        List your gear
      </Link>
    </>
  );
  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Brand />
        <nav className="public-links" aria-label="Main navigation">
          {links}
        </nav>
        <div className="public-header-actions">
          {user ? (
            <Button asChild size="sm">
              <Link to="/dashboard">
                Dashboard
                <ArrowUpRight size={16} />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline" size="sm" className="login-link">
                <Link to="/login">
                  Sign in
                  <ArrowUpRight size={15} />
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/register">
                  Sign up
                  <ArrowUpRight size={15} />
                </Link>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="mobile-menu-button"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu size={21} />
          </Button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="mobile-navigation">
          <DialogTitle>Explore Rentora</DialogTitle>
          <DialogDescription>Where would you like to go?</DialogDescription>
          <nav>{links}</nav>
        </DialogContent>
      </Dialog>
    </header>
  );
}
export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer-top">
        <Brand />
        <p>Good gear. For the time you need it.</p>
        <div>
          <Link to="/explore">Explore</Link>
          <Link to="/my-listings">List equipment</Link>
          <Link to="/login">Log in</Link>
        </div>
      </div>
      <div className="public-footer-bottom">
        <span>© {new Date().getFullYear()} Rentora</span>
        <span>Rent. Make it happen. Repeat.</span>
      </div>
    </footer>
  );
}
export function PublicLayout({ user, children, footer = true }) {
  const location = useLocation();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (location.hash)
        document
          .getElementById(location.hash.slice(1))
          ?.scrollIntoView({ behavior: "smooth" });
      else window.scrollTo({ top: 0, behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.hash]);
  return (
    <div className="public-site">
      <PublicHeader user={user} />
      <main>{children}</main>
      {footer && <PublicFooter />}
    </div>
  );
}
export function Workspace({ user, onLogout, children }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const admin = user.role === "ADMIN";
  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  const routes = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    {
      to: admin ? "/admin/bookings" : "/rentals",
      label: admin ? "Bookings" : "My rentals",
      icon: CalendarDays,
    },
    {
      to: admin ? "/admin/equipment" : "/explore",
      label: admin ? "Equipment" : "Explore equipment",
      icon: Package,
    },
    {
      to: admin ? "/admin/listings" : "/my-listings",
      label: admin ? "Listing reviews" : "My listings",
      icon: admin ? ClipboardCheck : ListPlus,
    },
    { to: profileUrl(user), label: "My profile", icon: UserRound },
  ];
  const current =
    routes.find((route) => route.to === location.pathname)?.label ||
    "Workspace";
  const nav = (
    <nav className="workspace-nav" aria-label="Workspace navigation">
      {routes.map((route) => (
        <NavLink
          key={route.to}
          to={route.to}
          className={({ isActive }) =>
            isActive ? "workspace-nav-link is-active" : "workspace-nav-link"
          }
        >
          <route.icon size={19} />
          {route.label}
          <ArrowUpRight className="nav-active-arrow" size={15} />
        </NavLink>
      ))}
    </nav>
  );
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Brand />
        <span className="workspace-section-label">YOUR WORKSPACE</span>
        {nav}
        <div className="workspace-sidebar-bottom">
          <Link to="/explore">
            <ArrowUpRight size={17} />
            Browse the marketplace
          </Link>
          <Button variant="ghost" onClick={onLogout}>
            <LogOut size={17} />
            Log out
          </Button>
        </div>
      </aside>
      <div className="workspace-column">
        <header className="workspace-header">
          <div className="workspace-breadcrumb">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu-button"
              aria-label="Open workspace navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </Button>
            <span>{admin ? "Administration" : "Workspace"}</span>
            <span>/</span>
            <strong>{current}</strong>
          </div>
          <div className="workspace-account">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="workspace-browse"
            >
              <Link to="/explore">
                Explore
                <ArrowUpRight size={15} />
              </Link>
            </Button>
            <Link
              to={profileUrl(user)}
              className="workspace-user"
              aria-label="Open my profile"
            >
              <span className="user-initial">{user.name[0].toUpperCase()}</span>
              <span>
                <strong>{user.name}</strong>
                <small>{admin ? "Administrator" : "Customer"}</small>
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Log out"
              onClick={onLogout}
            >
              <LogOut size={17} />
            </Button>
          </div>
        </header>
        <motion.main
          key={location.pathname}
          className="workspace-content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          {children}
        </motion.main>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="mobile-navigation">
          <DialogTitle>Your workspace</DialogTitle>
          <DialogDescription>
            Manage your account and equipment.
          </DialogDescription>
          {nav}
          <Button variant="outline" onClick={onLogout}>
            <LogOut size={16} />
            Log out
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
