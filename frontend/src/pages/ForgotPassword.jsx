import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthPanel from "../components/AuthPanel";
import FormField from "../components/FormField";
import { forgotPassword } from "../lib/api";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await forgotPassword({ email: email.trim() });
      setMessage(
        data.message || "If an account exists, a reset link was sent.",
      );
      // Optionally navigate to a confirmation route
    } catch (err) {
      setError(err.message || "Failed to request password reset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPanel
      compact
      copy="Enter your email to receive a password reset link."
      id="forgot-password-title"
      title="Forgot Password"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField
          id="forgot-email"
          label="Email"
          name="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your account email"
          required
          type="email"
          value={email}
        />

        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-success">{message}</p> : null}

        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <div className="panel-footer">
        <span>Remembered your password?</span>
        <button
          type="button"
          className="link-button"
          onClick={() => navigate("/login")}
        >
          Back to login
        </button>
      </div>
    </AuthPanel>
  );
}
