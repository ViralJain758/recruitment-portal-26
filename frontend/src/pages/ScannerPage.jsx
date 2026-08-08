import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "../App.css";
import "./AdminDashboard.css";

import AttendanceScanner from "../components/AttendanceScanner";
import AuthPanel from "../components/AuthPanel";
import FormField from "../components/FormField";
import { verifyScannerPassword } from "../lib/api";

export default function ScannerPage() {
  const navigate = useNavigate();
  const isAdmin = localStorage.getItem("isAdmin") === "true";
  const [password, setPassword] = useState("");
  const [verified, setVerified] = useState(isAdmin);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
