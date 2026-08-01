export const AUTH_STORAGE_KEY = "recruitmentPortalAuth";
export const PENDING_SIGNUP_STORAGE_KEY = "recruitmentPortalPendingSignup";

export function hasValidSession(session) {
  if (!session?.accessToken) {
    return false;
  }

  if (typeof session.expiresAt === "number") {
    return session.expiresAt > Math.floor(Date.now() / 1000);
  }

  return true;
}

function readLegacyAuth() {
  return { authSession: null, candidateProfile: null };
}

export function readStoredAuth() {
  if (typeof window === "undefined") {
    return { authSession: null, candidateProfile: null };
  }

  try {
    const storedAuth = window.localStorage.getItem(AUTH_STORAGE_KEY);

    if (!storedAuth) {
      return readLegacyAuth();
    }

    const parsedAuth = JSON.parse(storedAuth);

    const legacySession = parsedAuth?.authSession || parsedAuth?.session;
    const legacyAccessToken =
      parsedAuth?.accessToken || legacySession?.accessToken;
    const legacyExpiresAt =
      legacySession?.expiresAt ??
      parsedAuth?.expiresAt ??
      parsedAuth?.expires_at ??
      null;

    const legacyCandidateProfile =
      parsedAuth?.candidateProfile ||
      parsedAuth?.profile ||
      parsedAuth?.user ||
      (parsedAuth?.application_number ? parsedAuth : null);

    return {
      authSession: legacyAccessToken
        ? {
            accessToken: legacyAccessToken,
            expiresAt:
              typeof legacyExpiresAt === "number"
                ? legacyExpiresAt
                : legacyExpiresAt
                  ? Math.floor(new Date(legacyExpiresAt).getTime() / 1000)
                  : null,
          }
        : null,
      candidateProfile: legacyCandidateProfile || null,
    };
  } catch {
    return readLegacyAuth();
  }
}

function sanitizeProfile(candidateProfile) {
  if (!candidateProfile || typeof candidateProfile !== "object") {
    return null;
  }

  const { accessToken: _accessToken, ...safeProfile } = candidateProfile;
  return safeProfile;
}

export function persistAuth(authSession, candidateProfile) {
  if (typeof window === "undefined") {
    return;
  }

  if (!hasValidSession(authSession)) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem("accessToken");
    window.localStorage.removeItem("refreshToken");
    window.localStorage.removeItem("user");
    window.sessionStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
    return;
  }

  window.localStorage.removeItem("accessToken");
  window.localStorage.removeItem("refreshToken");

  window.localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      authSession: {
        accessToken: authSession.accessToken,
        expiresAt: authSession.expiresAt ?? null,
      },
      candidateProfile: sanitizeProfile(candidateProfile),
    }),
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

  if (!pendingSignup?.email) {
    window.sessionStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(
    PENDING_SIGNUP_STORAGE_KEY,
    JSON.stringify({
      email: pendingSignup.email,
    }),
  );
}

export function clearPendingSignup() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
}
