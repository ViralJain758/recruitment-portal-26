const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"
).replace(/\/$/, "");

async function request(path, options = {}) {
  const { headers, ...requestOptions } = options;

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...requestOptions,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

export function signup(payload) {
  return request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function refreshSession(payload) {
  return request("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveCandidateDetails(payload, token) {
  return request("/api/auth/candidate-details", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function getDashboard(signal) {
  const response = await fetch(`${apiBaseUrl}/dashboard`, { signal });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || "Failed to load dashboard.");
  }

  return text || "Dashboard";
}
