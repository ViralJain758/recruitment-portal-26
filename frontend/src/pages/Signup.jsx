import "../App.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import AuthForm from "../components/AuthForm";
import useFormFields from "../hooks/useFormFields";
import { signup } from "../lib/api";

export default function Signup() {
  const navigate = useNavigate();

  const [values, handleChange] = useFormFields({
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      await signup({
        email,
        password,
      });

      navigate("/candidate-details");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

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
