import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AuthPanel from "../components/AuthPanel";
import FormField from "../components/FormField";
import { resetPassword } from "../lib/api";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const query = useQuery();
  const token = query.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token.");
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token, password });
      setMessage("Password reset successful. Redirecting to login...");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPanel
      compact
      copy="Set a new password for your account."
      id="reset-password-title"
      title="Reset Password"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField
          id="new-password"
          label="New password"
          name="password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter new password"
          required
          type="password"
          value={password}
        />

        <FormField
          id="confirm-password"
          label="Confirm password"
          name="confirm"
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter new password"
          required
          type="password"
          value={confirm}
        />

        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-success">{message}</p> : null}

        <button
          type="submit"
          className="primary-button"
          disabled={loading || !token}
        >
          {loading ? "Saving..." : "Save new password"}
        </button>
      </form>

      <div className="panel-footer">
        <span>Need help?</span>
        <button
          type="button"
          className="link-button"
          onClick={() => navigate("/forgot-password")}
        >
          Request another link
        </button>
      </div>
    </AuthPanel>
  );
}
