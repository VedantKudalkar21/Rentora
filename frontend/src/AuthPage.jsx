import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Check,
} from "lucide-react";
import { api } from "./api";
import GoogleSignIn from "./GoogleSignIn";
import { Brand } from "./Shell";
import EquipmentArt from "./EquipmentArt";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";

export default function AuthPage({ register = false, config, onSuccess }) {
  const location = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const change = (event) =>
    setForm({ ...form, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSuccess(
        await api(register ? "/auth/register" : "/auth/login", {
          method: "POST",
          skipAuth: true,
          body: register
            ? form
            : { email: form.email, password: form.password },
        }),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-screen">
      <aside className="auth-story">
        <Brand light />
        <div className="auth-story-copy">
          <span className="kicker light-kicker">
            MORE POSSIBILITIES. LESS COMMITMENT.
          </span>
          <h1>
            Big plans.
            <br />
            Just the gear
            <br />
            <em>you need.</em>
          </h1>
          <p>From everyday projects to extraordinary weekends.</p>
        </div>
        <div className="auth-art">
          <div className="auth-art-orbit" />
          <EquipmentArt category={register ? "Outdoor" : "Cameras"} />
          <span className="auth-art-sticker">
            <ArrowUpRight />
            Make room
            <br />
            for more.
          </span>
        </div>
        <div className="auth-story-bottom">
          <span>RENTORA</span>
          <span>OWN THE MOMENT.</span>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-top">
          <Link to="/" className="back-link">
            <ArrowLeft size={16} />
            Back to home
          </Link>
          <span>
            {register ? "Already a member?" : "New around here?"}
            <Link to={register ? "/login" : "/register"} state={location.state}>
              {register ? "Log in" : "Sign up"}
              <ArrowUpRight size={14} />
            </Link>
          </span>
        </div>
        <motion.div
          key={register ? "register" : "login"}
          className="auth-form-wrap"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <span className="kicker">
            {register ? "LET’S GET YOU STARTED" : "YOUR NEXT PLAN STARTS HERE"}
          </span>
          <h2>{register ? "Create your account." : "Welcome back."}</h2>
          <p className="auth-subtitle">
            {register
              ? "Join Rentora to rent equipment and list your own."
              : "Log in to manage your rentals and listings."}
          </p>
          <form onSubmit={submit} className="auth-form">
            {register && (
              <label htmlFor="auth-name">
                Full name
                <Input
                  id="auth-name"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  name="name"
                  value={form.name}
                  onChange={change}
                  placeholder="Your full name"
                />
              </label>
            )}
            <label htmlFor="auth-email">
              Email address
              <Input
                id="auth-email"
                required
                type="email"
                autoComplete="email"
                name="email"
                maxLength={120}
                value={form.email}
                onChange={change}
                placeholder="you@example.com"
              />
            </label>
            <label htmlFor="auth-password">
              Password
              <div className="password-control">
                <Input
                  id="auth-password"
                  required
                  type={visible ? "text" : "password"}
                  minLength={8}
                  maxLength={72}
                  autoComplete={register ? "new-password" : "current-password"}
                  name="password"
                  value={form.password}
                  onChange={change}
                  placeholder={
                    register ? "At least 8 characters" : "Enter your password"
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setVisible(!visible)}
                  aria-label={visible ? "Hide password" : "Show password"}
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </Button>
              </div>
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <Button
              type="submit"
              size="lg"
              className="auth-submit"
              disabled={busy}
            >
              {busy ? (
                <>
                  <LoaderCircle className="animate-spin" size={17} />
                  Please wait
                </>
              ) : (
                <>
                  {register ? "Create account" : "Log in"}
                  <ArrowUpRight size={18} />
                </>
              )}
            </Button>
          </form>
          {config?.googleEnabled && (
            <>
              <div className="auth-divider">
                <span>or continue with</span>
              </div>
              <GoogleSignIn config={config} onSuccess={onSuccess} />
            </>
          )}
          <p className="auth-switch">
            {register ? "Have an account?" : "Don’t have an account?"}{" "}
            <Link to={register ? "/login" : "/register"} state={location.state}>
              {register ? "Log in" : "Create an account"}
            </Link>
          </p>
        </motion.div>
        <div className="auth-bottom-note">
          <span className="small-dot" /> A little less owning. A little more
          doing.
        </div>
      </main>
    </div>
  );
}
