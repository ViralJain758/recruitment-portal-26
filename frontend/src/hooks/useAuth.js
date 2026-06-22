import { useEffect, useState } from "react";
import { refreshSession } from "../lib/api";

const AUTH_STORAGE_KEY = "recruitmentPortalAuth";

function hasValidSession(session) {
  return Boolean(session?.accessToken);
}

function readStoredAuth() {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);

    if (!stored) {
      return {
        authSession: null,
        candidateProfile: null,
      };
    }

    const parsed = JSON.parse(stored);

    return {
      authSession: parsed.authSession || null,
      candidateProfile: parsed.candidateProfile || null,
    };
  } catch {
    return {
      authSession: null,
      candidateProfile: null,
    };
  }
}

function persistAuth(authSession, candidateProfile) {
  if (!hasValidSession(authSession)) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      authSession,
      candidateProfile,
    }),
  );
}

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
  const [authSession, setAuthSession] = useState(storedAuth.authSession);
  const [candidateProfile, setCandidateProfile] = useState(
    storedAuth.candidateProfile,
  );
  const [authReady, setAuthReady] = useState(
    !hasValidSession(storedAuth.authSession),
  );

  useEffect(() => {
    async function restoreSession() {
      if (!hasValidSession(storedAuth.authSession)) {
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
        localStorage.removeItem(AUTH_STORAGE_KEY);

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
    localStorage.removeItem(AUTH_STORAGE_KEY);

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
