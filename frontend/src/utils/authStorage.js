export const AUTH_STORAGE_KEY = "recruitmentPortalAuth";

export function hasValidSession(session) {
  return Boolean(session?.accessToken);
}

export function readStoredAuth() {
  if (typeof window === "undefined") {
    return { authSession: null, candidateProfile: null };
  }

  try {
    const storedAuth = window.localStorage.getItem(AUTH_STORAGE_KEY);

    if (!storedAuth) {
      return { authSession: null, candidateProfile: null };
    }

    const parsedAuth = JSON.parse(storedAuth);

    return {
      authSession: parsedAuth.authSession || null,
      candidateProfile: parsedAuth.candidateProfile || null,
    };
  } catch {
    return { authSession: null, candidateProfile: null };
  }
}

export function persistAuth(authSession, candidateProfile) {
  if (typeof window === "undefined") {
    return;
  }

  if (!hasValidSession(authSession)) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({ authSession, candidateProfile }),
  );
}
