import "../App.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import AuthForm from "../components/AuthForm";
import useFormFields from "../hooks/useFormFields";
import { signup, getGlobalLock } from "../lib/api";
import { persistPendingSignup } from "../utils/authStorage";

export default function Signup({ onSignupSuccess }) {
  const navigate = useNavigate();

  const [values, handleChange] = useFormFields({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationsClosed, setRegistrationsClosed] = useState(false);
  const [checkingLock, setCheckingLock] = useState(true);

  // Check global lock status on mount
  useEffect(() => {
    getGlobalLock()
      .then((res) => setRegistrationsClosed(res.locked))
      .catch(() => {
        // If we can't check, allow signup (server will block anyway)
      })
      .finally(() => setCheckingLock(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const email = values.email.trim();
    const password = values.password.trim();
    const confirmPassword = values.confirmPassword.trim();

    if (!email || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await signup({
        email,
        password,
      });

      if (response.requiresVerification) {
        persistPendingSignup({ email, password });
        navigate("/otp", {
          replace: true,
          state: { email, password },
        });
        return;
      }

      if (!response.session?.accessToken) {
        throw new Error("Account created, but sign in could not be completed.");
      }

      onSignupSuccess?.(response);
      navigate(response.redirectTo || "/candidate-details", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingLock) {
    return null; // or a small spinner
  }

  if (registrationsClosed) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface-1, #f8faff)",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            background: "#fff",
            borderRadius: 16,
            padding: "40px 32px",
            boxShadow: "0 4px 32px rgba(0,0,0,0.09)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ margin: "0 0 12px", color: "#1e293b" }}>
            Registrations Closed
          </h2>
          <p style={{ color: "#64748b", margin: "0 0 24px", lineHeight: 1.6 }}>
            New sign-ups are currently not being accepted. If you already have
            an account, you can still log in below.
          </p>
          <button
            onClick={() => navigate("/login")}
            style={{
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 15,
            }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthForm
      mode="signup"
      values={values}
      error={error}
      loading={loading}
      onChange={handleChange}
      onSubmit={handleSubmit}
      footerText="Already registered?"
      footerAction={() => navigate("/login")}
    />
  );
}
