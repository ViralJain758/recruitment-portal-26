import { createUser, getUserByToken, signIn } from "../models/authModel.js";
import { supabaseAuth } from "../config/supabase.js";
import {
  findCandidateByUserId,
  isMissingCandidateTableError,
  mapCandidatePayload,
  upsertCandidateProfile,
  validateCandidatePayload,
} from "../models/candidateModel.js";

export function buildSessionResponse(
  session,
  user,
  profile = null,
  redirectTo = null,
) {
  return {
    session: session
      ? {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at,
        }
      : null,
    user: {
      id: user.id,
      email: user.email,
    },
    profile,
    redirectTo,
  };
}

export function bearerToken(req) {
  const authorization = req.headers.authorization || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
}

export async function fetchCandidateProfile(userId) {
  const { data, error } = await findCandidateByUserId(userId);

  if (error) {
    if (isMissingCandidateTableError(error)) {
      return null;
    }

    throw error;
  }

  return data;
}

export async function registerUser(email, password) {
  const { data: createdUser, error: createError } = await createUser(
    email,
    password,
  );

  if (createError) {
    return { error: createError };
  }

  const { data, error } = await signIn(email, password);

  return {
    data: error
      ? buildSessionResponse(null, createdUser.user, null, "/candidate-details")
      : buildSessionResponse(
          data.session,
          data.user,
          null,
          "/candidate-details",
        ),
  };
}

export async function loginUser(email, password) {
  const { data, error } = await signIn(email, password);

  if (error) {
    return { error };
  }

  return {
    data: buildSessionResponse(
      data.session,
      data.user,
      await fetchCandidateProfile(data.user.id),
      "/dashboard",
    ),
  };
}

export async function refreshUserSession(refreshToken) {
  const { data, error } = await supabaseAuth.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error) {
    return { error };
  }

  return {
    data: buildSessionResponse(
      data.session,
      data.user,
      await fetchCandidateProfile(data.user.id),
      "/dashboard",
    ),
  };
}

export async function userFromToken(token) {
  const { data, error } = await getUserByToken(token);

  if (error || !data?.user) {
    return null;
  }

  return data.user;
}

export async function saveCandidate(body, user) {
  const missingFields = validateCandidatePayload(body);

  if (missingFields.length) {
    return {
      status: 400,
      error: `Missing required candidate details: ${missingFields.join(", ")}`,
    };
  }

  const { data, error } = await upsertCandidateProfile(
    mapCandidatePayload(body, user),
  );

  if (!error) {
    return { data };
  }

  return {
    status: isMissingCandidateTableError(error) ? 503 : 400,
    error: isMissingCandidateTableError(error)
      ? "Candidate profile table is missing in Supabase. Run backend/supabase/schema.sql and refresh the schema cache."
      : error.message,
  };
}
