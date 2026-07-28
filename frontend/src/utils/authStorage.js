export const AUTH_STORAGE_KEY = "recruitmentPortalAuth";
export const PENDING_SIGNUP_STORAGE_KEY = "recruitmentPortalPendingSignup";

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

export function readPendingSignup() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedSignup = window.sessionStorage.getItem(
      PENDING_SIGNUP_STORAGE_KEY,
    );

    return storedSignup ? JSON.parse(storedSignup) : null;
  } catch {
    return null;
  }
}

export function persistPendingSignup(pendingSignup) {
  if (typeof window === "undefined") {
    return;
  }

  if (!pendingSignup?.email || !pendingSignup?.password) {
    window.sessionStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(
    PENDING_SIGNUP_STORAGE_KEY,
    JSON.stringify({
      email: pendingSignup.email,
      password: pendingSignup.password,
    }),
  );
}

export function clearPendingSignup() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
}
