import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Otp from "./pages/Otp";
import CandidateDetails from "./pages/CandidateDetails";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ScannerPage from "./pages/ScannerPage";
import { useAuth } from "./hooks/useAuth";

function hasCompletedCandidateForm(profile) {
  return Boolean(profile?.application_number);
}

export default function App() {
  const [isAdmin, setIsAdmin] = useState(
    () => localStorage.getItem("isAdmin") === "true",
  );
  const {
    authReady,
    authSession,
    candidateProfile,
    login,
    register,
    saveProfile,
  } = useAuth();

  if (!authReady) {
    return <main className="dashboard-page">Please Wait</main>;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={authSession ? "/dashboard" : "/signup"} replace />}
      />

      <Route path="/signup" element={<Signup onSignupSuccess={register} />} />

      <Route path="/otp" element={<Otp onSignupSuccess={register} />} />

      <Route
        path="/login"
        element={
          <Login
            onAdminLoginSuccess={() => setIsAdmin(true)}
            onLoginSuccess={login}
          />
        }
      />

      <Route
        path="/candidate-details"
        element={
          authSession ? (
            <CandidateDetails
              registrationData={candidateProfile}
              onSaved={(response) => saveProfile(response.profile)}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/dashboard"
        element={
          authSession ? (
            hasCompletedCandidateForm(candidateProfile) ? (
              <Dashboard />
            ) : (
              <Navigate to="/candidate-details" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/admin-dashboard"
        element={
          isAdmin ? <AdminDashboard /> : <Navigate to="/login" replace />
        }
      />

      <Route
        path="/scanner"
        element={<ScannerPage />}
      />
    </Routes>
  );
}
