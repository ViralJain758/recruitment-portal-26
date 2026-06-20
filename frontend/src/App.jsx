import { Routes, Route, Navigate } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import CandidateDetails from "./pages/CandidateDetails";
import Dashboard from "./pages/Dashboard";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  const { authReady, authSession, login } = useAuth();

  if (!authReady) {
    return <main className="dashboard-page">Please Wait</main>;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/signup" replace />} />

      <Route path="/signup" element={<Signup />} />

      <Route path="/login" element={<Login onLoginSuccess={login} />} />

      <Route
        path="/candidate-details"
        element={
          authSession ? <CandidateDetails /> : <Navigate to="/login" replace />
        }
      />

      <Route
        path="/dashboard"
        element={authSession ? <Dashboard /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}
