import { useEffect, useRef, useState } from "react";
import { refreshSession } from "../lib/api";
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
  const [authReady, setAuthReady] = useState(
    !hasValidSession(storedAuth.authSession),
  );

  useEffect(() => {
    async function restoreSession() {
      if (restoreStarted.current) {
        return;
      }

      restoreStarted.current = true;

      if (!hasValidSession(storedAuth.authSession)) {
        setAuthReady(true);
        return;
      }

      try {
        const restored = await refreshSession({
          refreshToken: storedAuth.authSession.refreshToken,
        });

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
        persistAuth(null, null);

        setAuthSession(null);
        setCandidateProfile(null);
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
