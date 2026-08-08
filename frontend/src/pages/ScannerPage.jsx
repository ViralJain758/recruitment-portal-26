import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import "../App.css";
import "./AdminDashboard.css";

import AttendanceScanner from "../components/AttendanceScanner";
import AuthPanel from "../components/AuthPanel";
import FormField from "../components/FormField";
import { verifyScannerPassword } from "../lib/api";

export default function ScannerPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(
    () => localStorage.getItem("isAdmin") === "true",
  );
  const [password, setPassword] = useState("");
  const [verified, setVerified] = useState(isAdmin);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // The scanner reuses the admin design tokens (--admin-*), which are only
  // defined under body.admin-light-mode, and it's built to be viewed against
  // a light surface. Force that theme while this page is mounted so the
  // scanner renders correctly even if the visitor has the public site's
  // dark mode enabled, restoring whatever theme was active on unmount.
  useEffect(() => {
    const hadDarkTheme = document.documentElement.classList.contains("dark");
    document.documentElement.classList.remove("dark");
    document.body.classList.add("admin-light-mode");

    return () => {
      document.body.classList.remove("admin-light-mode");
      if (hadDarkTheme) {
        document.documentElement.classList.add("dark");
      }
    };
  }, []);

  // Called when the scanner backend rejects our session (e.g. an expired or
  // stale "admin" cookie behind a locally-remembered isAdmin flag, or an
  // expired scanner password session). Trusting a client-only flag forever
  // is what let the scanner silently fail — drop it and ask for the
  // password again instead of pretending everything is fine.
  function handleAuthExpired() {
    localStorage.removeItem("isAdmin");
    setIsAdmin(false);
    setVerified(false);
    setError(
      "Your scanner session has expired. Please re-enter the scanner password.",
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const trimmedPassword = password.trim();

      await verifyScannerPassword(trimmedPassword);
      setPassword("");
      setVerified(true);
    } catch (requestError) {
      setVerified(false);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  if (verified) {
    return (
      <AttendanceScanner
        adminBypass={isAdmin}
        onAuthExpired={handleAuthExpired}
        onClose={isAdmin ? () => navigate("/admin-dashboard") : undefined}
      />
    );
  }

  return (
    <AuthPanel
      compact
      copy="Enter the scanner password to open attendance scanning."
      id="scanner-password-title"
      title="Scanner Access"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField
          id="scanner-password"
          label="Password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter scanner password"
          required
          type="password"
          value={password}
        />

        {error ? <p className="form-error">{error}</p> : null}

        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? "Checking..." : "Open Scanner"}
        </button>
      </form>

      <div className="panel-footer">
        <span>Back to admin dashboard?</span>
        <button
          type="button"
          className="link-button"
          onClick={() => navigate("/admin-dashboard")}
        >
          Go back
        </button>
      </div>
    </AuthPanel>
  );
}
