import "../App.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import AuthForm from "../components/AuthForm";
import useFormFields from "../hooks/useFormFields";
import { login } from "../lib/api";

export default function Login({ onLoginSuccess }) {
  const navigate = useNavigate();

  const [values, handleChange] = useFormFields({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await login({
        email: values.email.trim(),
        password: values.password.trim(),
      });

      onLoginSuccess?.(response);
      navigate(response.redirectTo || "/dashboard", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

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
