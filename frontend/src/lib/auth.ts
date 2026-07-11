const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export interface User {
  id: string;
  email: string;
  username: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("zoom_token");
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("zoom_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function saveAuth(token: string, user: User) {
  localStorage.setItem("zoom_token", token);
  localStorage.setItem("zoom_user", JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem("zoom_token");
  localStorage.removeItem("zoom_user");
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}
