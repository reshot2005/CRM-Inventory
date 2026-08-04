const ACCESS_KEY = "stockos_access_token";
const USER_KEY = "stockos_user";

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export function setSession(accessToken: string, user: StoredUser): void {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}
