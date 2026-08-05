import { useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Otp from "./pages/Otp";
import CandidateDetails from "./pages/CandidateDetails";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ScannerPage from "./pages/ScannerPage";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { useAuth } from "./hooks/useAuth";
import { Instructions } from "./pages/Instructions";
import { Quiz } from "./pages/Quiz";
import { Result } from "./pages/Result";
import { ExamProvider, useExam } from "./context/ExamContext";

function hasCompletedCandidateForm(profile) {
  return Boolean(profile?.application_number);
}

function buildExamCandidate(profile, authSession) {
  if (!profile) return null;

  const fullName = profile.full_name ?? profile.fullName ?? profile.name ?? "";
  const enrollmentNumber =
    profile.enrollment_number ??
    profile.enrollmentNumber ??
    profile.application_number ??
    profile.applicationId ??
    "";

  return {
    ...profile,
    fullName,
    name: fullName,
    enrollmentNumber,
    applicationId: enrollmentNumber,
    college: profile.college ?? profile.institution ?? "",
    email: profile.email ?? "",
    accessToken: authSession?.accessToken ?? profile.accessToken ?? "",
  };
}

function ExamAuthRoute({ authSession, candidateProfile, children }) {
  const { candidate, setCandidate } = useExam();
  const hydratedCandidate = useMemo(
    () => buildExamCandidate(candidateProfile, authSession),
    [candidateProfile, authSession],
  );
  const hasMatchingIdentity =
    candidate?.fullName === hydratedCandidate?.fullName &&
    candidate?.enrollmentNumber === hydratedCandidate?.enrollmentNumber &&
    candidate?.accessToken === hydratedCandidate?.accessToken;

  useEffect(() => {
    if (!authSession || !hydratedCandidate) return;

    if (!hasMatchingIdentity) {
      setCandidate(hydratedCandidate);
    }
  }, [authSession, hasMatchingIdentity, hydratedCandidate, setCandidate]);

  if (!authSession) {
    return <Navigate to="/login" replace />;
  }

  if (!hasCompletedCandidateForm(candidateProfile)) {
    return <Navigate to="/candidate-details" replace />;
  }

  if (
    !candidate?.fullName ||
    !candidate?.enrollmentNumber ||
    !hasMatchingIdentity
  ) {
    return null;
  }

  return children;
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
    logout,
  } = useAuth();

  if (!authReady) {
    return <main className="dashboard-page">Please Wait</main>;
  }

  return (
    <ExamProvider>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate to={authSession ? "/dashboard" : "/signup"} replace />
          }
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
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

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
                <Dashboard
                  candidateProfile={candidateProfile}
                  authSession={authSession}
                  saveProfile={saveProfile}
                  logout={logout}
                />
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

        <Route path="/scanner" element={<ScannerPage />} />
        <Route path="/result" element={<Result />} />
        <Route
          path="/instruction"
          element={
            <ExamAuthRoute
              authSession={authSession}
              candidateProfile={candidateProfile}
            >
              <Instructions />
            </ExamAuthRoute>
          }
        />
        <Route
          path="/instructions"
          element={
            <ExamAuthRoute
              authSession={authSession}
              candidateProfile={candidateProfile}
            >
              <Instructions />
            </ExamAuthRoute>
          }
        />
        <Route
          path="/quiz"
          element={
            <ExamAuthRoute
              authSession={authSession}
              candidateProfile={candidateProfile}
            >
              <Quiz />
            </ExamAuthRoute>
          }
        />
      </Routes>
    </ExamProvider>
  );
}
