import "../App.css";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import AuthPanel from "../components/AuthPanel";
import FormField from "../components/FormField";
import useFormFields from "../hooks/useFormFields";
import { verifySignupOtp } from "../lib/api";
import {
  clearPendingSignup,
  persistPendingSignup,
  readPendingSignup,
} from "../utils/authStorage";

export default function Otp({ onSignupSuccess }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [values, handleChange] = useFormFields({ otp: "" });
  const [pendingSignup, setPendingSignup] = useState(null);
  const [checkingPending, setCheckingPending] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const locationState = location.state;
    const storedSignup = readPendingSignup();
    const nextPendingSignup =
      locationState?.email
        ? locationState
        : storedSignup;

    if (!nextPendingSignup?.email) {
      navigate("/signup", { replace: true });
      return;
    }

    persistPendingSignup(nextPendingSignup);
    setPendingSignup(nextPendingSignup);
    setCheckingPending(false);
  }, [location.state, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const otp = values.otp.trim();

    if (!otp) {
      setError("Enter the OTP sent to your email.");
      return;
    }

    if (!pendingSignup?.email) {
      setError("Missing signup details. Please start again.");
      navigate("/signup", { replace: true });
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await verifySignupOtp({
        email: pendingSignup.email,
        otp,
      });

      clearPendingSignup();
      onSignupSuccess?.(response);
      navigate(response.redirectTo || "/candidate-details", {
        replace: true,
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingPending) {
    return null;
  }

  return (
    <AuthPanel
      compact
      copy={`We sent a verification code to ${pendingSignup?.email || "your email"}.`}
      id="otp-title"
      title="Verify OTP"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField
          id="otp"
          label="OTP"
          name="otp"
          onChange={handleChange}
          placeholder="Enter the 6-digit code"
          required
          type="text"
          value={values.otp}
        />

        {error ? <p className="form-error">{error}</p> : null}

        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? "Verifying..." : "Verify and continue"}
        </button>
      </form>

      <div className="panel-footer">
        <span>Wrong email?</span>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            clearPendingSignup();
            navigate("/signup", { replace: true });
          }}
        >
          Back to signup
        </button>
      </div>
    </AuthPanel>
  );
}
