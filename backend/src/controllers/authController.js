import { cleanText } from "../utils/text.js";
import {
  bearerToken,
  fetchCandidateProfile,
  loginUser,
  registerUser,
  refreshUserSession,
  saveCandidate,
  userFromToken,
} from "../services/authService.js";

export async function signup(req, res) {
  const email = cleanText(req.body.email);
  const password = cleanText(req.body.password);

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  const { data, error } = await registerUser(email, password);

  if (error) {
    return res.status(400).json({ message: error.message });
  }

  return res.status(201).json(data);
}

export async function login(req, res) {
  const email = cleanText(req.body.email);
  const password = cleanText(req.body.password);

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  const { data, error } = await loginUser(email, password);

  return error
    ? res.status(401).json({ message: error.message })
    : res.json(data);
}

export async function refresh(req, res) {
  const refreshToken = cleanText(req.body.refreshToken);

  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token is required." });
  }

  const { data, error } = await refreshUserSession(refreshToken);

  return error
    ? res.status(401).json({ message: error.message })
    : res.json(data);
}

export async function saveCandidateDetails(req, res) {
  if (!req.body || typeof req.body !== "object") {
    return res
      .status(400)
      .json({ message: "Candidate details payload is required." });
  }

  const token = bearerToken(req);

  if (!token) {
    return res.status(401).json({ message: "Missing access token." });
  }

  const user = await userFromToken(token);

  if (!user) {
    return res.status(401).json({ message: "Invalid or expired session." });
  }

  const { data, error, status } = await saveCandidate(req.body, user);
  if (error) {
    return res.status(status).json({ message: error });
  }

  return res.status(200).json({
    message: "Candidate details saved.",
    profile: data,
    redirectTo: "/dashboard",
  });
}

export async function me(req, res) {
  const token = bearerToken(req);
  const user = token ? await userFromToken(token) : null;

  if (!user) {
    return res.status(401).json({ message: "Invalid or expired session." });
  }

  const profile = await fetchCandidateProfile(user.id);

  return res.json({
    user: {
      id: user.id,
      email: user.email,
    },
    profile,
  });
}
