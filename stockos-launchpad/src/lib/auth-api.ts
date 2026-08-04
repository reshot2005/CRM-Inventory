import { setSession, type StoredUser } from "./auth-storage";

export const getApiBase = (): string =>
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  "http://localhost:3001/api/v1";

type Envelope<T> = {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  timestamp?: string;
};

export type LoginSuccess = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: StoredUser;
};

export type TwoFactorRequired = {
  requires2FA: true;
  tempToken: string;
};

function parseJson<T>(json: Envelope<T>): T {
  if (json.success && json.data !== undefined) {
    return json.data;
  }
  const msg = json.error?.message ?? "Request failed";
  throw new Error(msg);
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginSuccess | TwoFactorRequired> {
  const res = await fetch(`${getApiBase()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const json = (await res.json()) as Envelope<LoginSuccess | TwoFactorRequired>;

  if (!json.success) {
    throw new Error(json.error?.message ?? "Login failed");
  }

  const data = json.data;
  if (!data) {
    throw new Error("Invalid login response");
  }

  if ("requires2FA" in data && data.requires2FA) {
    return data;
  }

  return data as LoginSuccess;
}

export async function verify2FARequest(
  tempToken: string,
  code: string,
): Promise<LoginSuccess> {
  const res = await fetch(`${getApiBase()}/auth/verify-2fa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ tempToken, code }),
  });
  const json = (await res.json()) as Envelope<LoginSuccess>;
  if (!res.ok) {
    throw new Error(json.error?.message ?? "Verification failed");
  }
  return parseJson(json);
}

export async function registerRequest(body: {
  email: string;
  password: string;
  name: string;
}): Promise<{ id: string; email: string; name: string; status: string }> {
  const res = await fetch(`${getApiBase()}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Envelope<{
    id: string;
    email: string;
    name: string;
    status: string;
  }>;
  if (!res.ok) {
    throw new Error(json.error?.message ?? "Registration failed");
  }
  return parseJson(json);
}

export function persistLogin(data: LoginSuccess): void {
  setSession(data.accessToken, data.user);
}
