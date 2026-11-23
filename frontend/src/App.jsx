import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { Check, X, RefreshCw } from "lucide-react";
import { api, clearAuthSession, hasAuthToken, setAuthSession } from "./api";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";
import { PublicLayout, Workspace } from "./Shell";
import LandingPage from "./LandingPage";
import AuthPage from "./AuthPage";
import CataloguePage, { ProductDialog } from "./CataloguePage";
import DashboardPage from "./DashboardPage";
import {
  BookingsPage,
  InventoryPage,
  EquipmentEditor,
  ReturnEditor,
} from "./ManagementPages";
import ProfilePage from "./ProfilePage";
import { CustomerListingsPage, AdminListingsPage } from "./ListingPages";
import { AdminPhotoEditor } from "./ProductPhotos";

function Guard({ user, loading, role, children }) {
  const location = useLocation();
  if (loading)
    return (
      <div className="page-loading" role="status">
        <span className="loading-pulse" />
        Opening your workspace…
      </div>
    );
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />;
  return children;
}
export default function App() {
  const [user, setUser] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [authConfig, setAuthConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberLoading, setMemberLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [working, setWorking] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const go = useNavigate();
  const location = useLocation();
  const admin = user?.role === "ADMIN";
  const notify = useCallback((message, error = false) => {
    clearTimeout(timer.current);
    setToast({ message, error });
    timer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  const loadCatalogue = useCallback(async () => {
    const items = await api("/equipment", { skipAuth: true });
    setEquipment(items);
    setConnectionError(false);
  }, []);
  const loadBookings = useCallback(async () => {
    if (!user) {
      setBookings([]);
      return;
    }
    setMemberLoading(true);
    try {
      setBookings(await api(admin ? "/admin/bookings" : "/bookings/mine"));
    } finally {
      setMemberLoading(false);
    }
  }, [user?.id, admin]);
  useEffect(() => {
    let alive = true;
    async function init() {
      const results = await Promise.allSettled([
        api("/equipment", { skipAuth: true }),
        api("/auth/config", { skipAuth: true }),
        hasAuthToken() ? api("/auth/me") : Promise.resolve(null),
      ]);
      if (!alive) return;
      if (results[0].status === "fulfilled") setEquipment(results[0].value);
      else setConnectionError(true);
      if (results[1].status === "fulfilled") setAuthConfig(results[1].value);
      if (results[2].status === "fulfilled") setUser(results[2].value);
      setLoading(false);
    }
    init();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    loadBookings().catch((error) => notify(error.message, true));
  }, [loadBookings, notify]);
  useEffect(() => {
    const expired = () => {
      setUser(null);
      setBookings([]);
      setDialog(null);
      notify("Please log in again to continue.", true);
    };
    window.addEventListener("rentora:unauthorized", expired);
    return () => window.removeEventListener("rentora:unauthorized", expired);
  }, [notify]);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function mutate(
    path,
    method = "PATCH",
    body,
    message = "Changes saved.",
  ) {
    setWorking(true);
    try {
      await api(path, { method, ...(body === undefined ? {} : { body }) });
      await Promise.all([loadCatalogue(), loadBookings()]);
      notify(message);
      return true;
    } catch (error) {
      notify(error.message, true);
      return false;
    } finally {
      setWorking(false);
    }
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      clearAuthSession();
      setUser(null);
      setBookings([]);
      setDialog(null);
      go("/");
      notify("You have been logged out.");
    } catch (error) {
      notify(error.message, true);
    }
  }
  function authenticated(response) {
    const account = setAuthSession(response);
    setUser(account);
    const from = location.state?.from;
    if (location.state?.bookingItem && account.role === "CUSTOMER") {
      setDialog({ type: "product", item: location.state.bookingItem });
      go("/explore", { replace: true });
    } else {
      const allowed =
        account.role === "ADMIN"
          ? [
              "/dashboard",
              "/admin/bookings",
              "/admin/equipment",
              "/admin/profile",
              "/admin/listings",
            ]
          : ["/dashboard", "/rentals", "/profile", "/my-listings"];
      go(allowed.includes(from) ? from : "/dashboard", { replace: true });
    }
  }
  function requestLogin(item) {
    setDialog(null);
    go("/login", { state: { bookingItem: item } });
  }
  const workspace = (children, role) => (
    <Guard user={user} loading={loading} role={role}>
      <Workspace user={user} onLogout={logout}>
        {children}
      </Workspace>
    </Guard>
  );
  const refresh = () =>
    loadBookings().catch((error) => notify(error.message, true));
  const showProduct = (item) => setDialog({ type: "product", item });
  return (
    <MotionConfig reducedMotion="user">
      {connectionError && (
        <div className="connection-notice" role="alert">
          <span>Equipment is temporarily unavailable.</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              loadCatalogue().catch(() =>
                notify("Please try again in a moment.", true),
              )
            }
          >
            <RefreshCw size={14} />
            Retry
          </Button>
        </div>
      )}
      <Routes>
        <Route
          path="/"
          element={
            <PublicLayout user={user}>
              <LandingPage
                equipment={equipment}
                user={user}
                onView={showProduct}
              />
            </PublicLayout>
          }
        />
        <Route
          path="/explore"
          element={
            <PublicLayout user={user}>
              <CataloguePage
                equipment={equipment}
                loading={loading}
                onView={showProduct}
              />
            </PublicLayout>
          }
        />
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AuthPage config={authConfig} onSuccess={authenticated} />
            )
          }
        />
        <Route
          path="/register"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AuthPage
                key="register"
                register
                config={authConfig}
                onSuccess={authenticated}
              />
            )
          }
        />
        <Route
          path="/dashboard"
          element={workspace(
            user && (
              <DashboardPage
                user={user}
                bookings={bookings}
                loading={memberLoading}
              />
            ),
          )}
        />
        <Route
          path="/rentals"
          element={workspace(
            user && (
              <BookingsPage
                user={user}
                bookings={bookings}
                equipment={equipment}
                loading={memberLoading}
                working={working}
                onRefresh={refresh}
                onMutate={mutate}
                onDialog={setDialog}
              />
            ),
            "CUSTOMER",
          )}
        />
        <Route
          path="/admin/bookings"
          element={workspace(
            user && (
              <BookingsPage
                user={user}
                bookings={bookings}
                equipment={equipment}
                loading={memberLoading}
                working={working}
                onRefresh={refresh}
                onMutate={mutate}
                onDialog={setDialog}
              />
            ),
            "ADMIN",
          )}
        />
        <Route
          path="/admin/equipment"
          element={workspace(
            <InventoryPage
              equipment={equipment}
              working={working}
              onDialog={setDialog}
              onMutate={mutate}
            />,
            "ADMIN",
          )}
        />
        <Route
          path="/my-listings"
          element={workspace(
            user && <CustomerListingsPage user={user} notify={notify} />,
            "CUSTOMER",
          )}
        />
        <Route
          path="/admin/listings"
          element={workspace(
            <AdminListingsPage
              notify={notify}
              onCatalogueChange={loadCatalogue}
            />,
            "ADMIN",
          )}
        />
        <Route
          path="/profile"
          element={workspace(
            user && (
              <ProfilePage
                user={user}
                config={authConfig}
                onUserChange={setUser}
                notify={notify}
              />
            ),
            "CUSTOMER",
          )}
        />
        <Route
          path="/admin/profile"
          element={workspace(
            user && (
              <ProfilePage
                user={user}
                config={authConfig}
                onUserChange={setUser}
                notify={notify}
              />
            ),
            "ADMIN",
          )}
        />
        <Route
          path="*"
          element={
            <PublicLayout user={user}>
              <div className="not-found">
                <span>404</span>
                <h1>A little off the beaten path.</h1>
                <p>Let’s get you back to the right gear.</p>
                <Button asChild>
                  <Link to="/">Back to home</Link>
                </Button>
              </div>
            </PublicLayout>
          }
        />
      </Routes>
      <AnimatePresence>
        {toast && (
          <motion.div
            className={"notification " + (toast.error ? "is-error" : "")}
            role={toast.error ? "alert" : "status"}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <span>{toast.error ? <X size={18} /> : <Check size={18} />}</span>
            <p>{toast.message}</p>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Dismiss notification"
              onClick={() => setToast(null)}
            >
              <X size={15} />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      {dialog?.type === "product" && (
        <ProductDialog
          key={dialog.item.id}
          item={dialog.item}
          user={user}
          onClose={() => setDialog(null)}
          onLogin={requestLogin}
          onBooked={async () => {
            setDialog(null);
            go("/rentals");
            await loadBookings();
            notify("Booking requested. You can follow its status here.");
          }}
        />
      )}
      {dialog && dialog.type !== "product" && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
        >
          <DialogContent className="management-dialog sm:max-w-[510px]">
            <DialogTitle>
              {dialog.type === "equipment"
                ? dialog.item
                  ? "Edit equipment"
                  : "Add equipment"
                : dialog.type === "photos"
                  ? "Photos & condition"
                  : dialog.type === "return"
                    ? "Record return"
                    : dialog.title}
            </DialogTitle>
            <DialogDescription>
              {dialog.type === "equipment"
                ? "Update the listing details and daily rental rate."
                : dialog.type === "photos"
                  ? "Show renters the current condition of this item."
                  : dialog.type === "return"
                    ? dialog.booking.equipmentName
                    : dialog.description}
            </DialogDescription>
            {dialog.type === "equipment" && (
              <EquipmentEditor
                item={dialog.item}
                working={working}
                onSave={async (body) => {
                  if (
                    await mutate(
                      dialog.item
                        ? `/admin/equipment/${dialog.item.id}`
                        : "/admin/equipment",
                      dialog.item ? "PUT" : "POST",
                      body,
                      "Equipment saved.",
                    )
                  )
                    setDialog(null);
                }}
              />
            )}
            {dialog.type === "photos" && (
              <AdminPhotoEditor
                item={dialog.item}
                onSaved={async () => {
                  await loadCatalogue();
                  setDialog(null);
                  notify("Product photos updated.");
                }}
              />
            )}
            {dialog.type === "return" && (
              <ReturnEditor
                booking={dialog.booking}
                working={working}
                onSave={async (returnedDate) => {
                  if (
                    await mutate(
                      `/admin/bookings/${dialog.booking.id}/return`,
                      "PATCH",
                      { returnedDate },
                      "Return recorded.",
                    )
                  )
                    setDialog(null);
                }}
              />
            )}
            {dialog.type === "confirm" && (
              <div className="dialog-actions">
                <Button variant="outline" onClick={() => setDialog(null)}>
                  Go back
                </Button>
                <Button
                  disabled={working}
                  onClick={async () => {
                    if (
                      await mutate(
                        dialog.path,
                        "PATCH",
                        undefined,
                        dialog.success,
                      )
                    )
                      setDialog(null);
                  }}
                >
                  {working ? "Saving…" : "Confirm"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </MotionConfig>
  );
}
