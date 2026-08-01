import { useEffect, useRef, useState } from "react";
import { getCurrentUser, logoutSession, refreshSession } from "../lib/api";
import {
  hasValidSession,
  persistAuth,
  readStoredAuth,
} from "../utils/authStorage";

function buildProfile(profile, user, session, existing = {}) {
  return {
    ...existing,
    ...(profile || {}),
    email: user?.email ?? existing.email ?? "",
    userId: user?.id ?? existing.userId ?? null,
    accessToken: session?.accessToken ?? existing.accessToken ?? null,
  };
}

export function useAuth() {
  const [storedAuth] = useState(() => readStoredAuth());
  const restoreStarted = useRef(false);
  const [authSession, setAuthSession] = useState(storedAuth.authSession);
  const [candidateProfile, setCandidateProfile] = useState(
    storedAuth.candidateProfile,
  );
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    async function restoreSession() {
      if (restoreStarted.current) {
        return;
      }

      restoreStarted.current = true;

      if (hasValidSession(storedAuth.authSession)) {
        try {
          const restored = await getCurrentUser(
            storedAuth.authSession.accessToken,
          );
          const profile = buildProfile(
            restored.profile,
            restored.user,
            storedAuth.authSession,
            storedAuth.candidateProfile,
          );

          setAuthSession(storedAuth.authSession);
          setCandidateProfile(profile);
          persistAuth(storedAuth.authSession, profile);
        } catch {
          setAuthSession(storedAuth.authSession);
          setCandidateProfile(storedAuth.candidateProfile);
        }
        setAuthReady(true);
        return;
      }

      try {
        const restored = await refreshSession();

        const profile = buildProfile(
          restored.profile,
          restored.user,
          restored.session,
          storedAuth.candidateProfile,
        );

        setAuthSession(restored.session);
        setCandidateProfile(profile);

        persistAuth(restored.session, profile);
      } catch {
        if (!hasValidSession(storedAuth.authSession)) {
          persistAuth(null, null);

          setAuthSession(null);
          setCandidateProfile(null);
        }
      } finally {
        setAuthReady(true);
      }
    }

    restoreSession();
  }, [storedAuth]);

  useEffect(() => {
    persistAuth(authSession, candidateProfile);
  }, [authSession, candidateProfile]);

  const login = (payload) => {
    const profile = buildProfile(
      payload.profile,
      payload.user,
      payload.session,
    );

    persistAuth(payload.session, profile);
    setAuthSession(payload.session);
    setCandidateProfile(profile);
  };

  const register = (payload) => {
    const profile = buildProfile(
      payload.profile,
      payload.user,
      payload.session,
    );

    persistAuth(payload.session, profile);
    setAuthSession(payload.session);
    setCandidateProfile(profile);
  };

  const saveProfile = (savedProfile) => {
    setCandidateProfile((current) =>
      buildProfile(savedProfile, null, authSession, current),
    );
  };

  const logout = () => {
    logoutSession().catch(() => {});
    persistAuth(null, null);

    setAuthSession(null);
    setCandidateProfile(null);
  };

  return {
    authReady,
    authSession,
    candidateProfile,

    login,
    register,
    saveProfile,
    logout,
  };
}
