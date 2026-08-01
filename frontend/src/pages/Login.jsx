import "../App.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import AuthForm from "../components/AuthForm";
import AuthPanel from "../components/AuthPanel";
import FormField from "../components/FormField";
import useFormFields from "../hooks/useFormFields";
import { login, verifyAdminOtp } from "../lib/api";
import { persistAuth } from "../utils/authStorage";

export default function Login({ onAdminLoginSuccess, onLoginSuccess }) {
  const navigate = useNavigate();

  const [values, handleChange] = useFormFields({
    email: "",
    otp: "",
    password: "",
  });

  const [adminOtpRequired, setAdminOtpRequired] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      if (adminOtpRequired) {
        const data = await verifyAdminOtp({
          email: values.email.trim(),
          password: values.password.trim(),
          otp: values.otp.trim(),
        });

        localStorage.setItem("isAdmin", "true");
        onAdminLoginSuccess?.();
        navigate(data.redirectTo || "/admin-dashboard", { replace: true });
        return;
      }

      const data = await login({
        email: values.email.trim(),
        password: values.password.trim(),
      });

      if (data.requiresAdminOtp) {
        localStorage.removeItem("isAdmin");
        setAdminOtpRequired(true);
        return;
      }

      if (data.isAdmin) {
        localStorage.setItem("isAdmin", "true");
        onAdminLoginSuccess?.();
        navigate("/admin-dashboard", { replace: true });
        return;
      }

      localStorage.removeItem("isAdmin");
      persistAuth(data.session, data.profile ?? data.user ?? null);

      onLoginSuccess?.(data);
      navigate(data.redirectTo || "/dashboard", { replace: true });
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  if (adminOtpRequired) {
    return (
      <AuthPanel
        compact
        copy="Enter the OTP sent to the configured admin receiver email."
        id="admin-otp-title"
        title="Admin OTP"
      >
        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField
            id="admin-otp"
            inputMode="numeric"
            label="OTP"
            maxLength="6"
            name="otp"
            onChange={handleChange}
            placeholder="Enter admin OTP"
            required
            type="text"
            value={values.otp}
          />

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
        </form>

        <div className="panel-footer">
          <span>Wrong credentials?</span>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setAdminOtpRequired(false);
              setError("");
            }}
          >
            Back to login
          </button>
        </div>
      </AuthPanel>
    );
  }

  return (
    <AuthForm
      mode="login"
      values={values}
      error={error}
      loading={loading}
      onChange={handleChange}
      onSubmit={handleSubmit}
      footerText="Need an account?"
      footerAction={() => navigate("/signup")}
    />
  );
}
