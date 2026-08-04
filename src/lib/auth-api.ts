import type { Session } from "@supabase/supabase-js";
import { setSession, type StoredUser } from "./auth-storage";
import {
  getAppOrigin,
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "./supabase-client";

export { isSupabaseConfigured };

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

function backendStartHint(): string {
  const base = getApiBase();
  return (
    `StockOS API expected at ${base}. From the project root run npm run dev:stack (Vite + API together), ` +
    `or npm run dev:api in a second terminal. If the API console shows Prisma P1001 to db.*.supabase.co, ` +
    `fix DATABASE_URL / DIRECT_DATABASE_URL using Supabase Dashboard → Connect (pooler URIs). Ensure Redis is running if the API needs it.`
  );
}

function apiUnreachableMessage(
  kind: "nest_login" | "nest_register" | "supabase_sync",
): string {
  if (kind === "supabase_sync") {
    return (
      "Signed in with Supabase, but the StockOS backend did not respond. " +
      backendStartHint()
    );
  }
  if (kind === "nest_register" && isSupabaseConfigured()) {
    return (
      "Cannot reach the Nest registration endpoint. Supabase is configured — use email sign-up above, or " +
      backendStartHint()
    );
  }
  return "Cannot reach the StockOS API. " + backendStartHint();
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginSuccess | TwoFactorRequired> {
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error(apiUnreachableMessage("nest_login"));
  }
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
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(apiUnreachableMessage("nest_register"));
  }
  let json: Envelope<{
    id: string;
    email: string;
    name: string;
    status: string;
  }>;
  try {
    json = (await res.json()) as Envelope<{
      id: string;
      email: string;
      name: string;
      status: string;
    }>;
  } catch {
    throw new Error(
      res.ok
        ? "Invalid response from server."
        : `Registration failed (HTTP ${res.status}). Is stockos-api running on port 3001?`,
    );
  }
  if (!res.ok) {
    throw new Error(json.error?.message ?? "Registration failed");
  }
  return parseJson(json);
}

export function persistLogin(data: LoginSuccess): void {
  setSession(data.accessToken, data.user);
}

/** Sign up via Supabase Auth — sends confirmation email when enabled in Supabase project. */
export async function supabaseSignUpRegister(body: {
  name: string;
  email: string;
  password: string;
}): Promise<{
  needsEmailConfirmation: boolean;
  session: Session | null;
}> {
  const supabase = getSupabaseBrowserClient();
  const redirectTo = `${getAppOrigin()}/auth/callback`;
  const { data, error } = await supabase.auth.signUp({
    email: body.email.trim(),
    password: body.password,
    options: {
      data: { name: body.name.trim() },
      emailRedirectTo: redirectTo,
    },
  });
  if (error) {
    throw new Error(error.message);
  }
  return {
    needsEmailConfirmation: !data.session,
    session: data.session,
  };
}

/** After Supabase session exists, sync Nest user row and return tokens shape for localStorage. */
export async function loginDataFromSupabaseSession(
  session: Session,
): Promise<LoginSuccess> {
  const token = session.access_token;
  let syncRes: Response;
  try {
    syncRes = await fetch(`${getApiBase()}/auth/sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  } catch {
    throw new Error(apiUnreachableMessage("supabase_sync"));
  }
  const syncJson = (await syncRes.json()) as Envelope<{
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    allowedLocations: string[];
    permissions: string[];
  }>;
  if (!syncRes.ok || !syncJson.success || !syncJson.data) {
    if (syncRes.status === 401) {
      throw new Error(
        "The API could not verify your Supabase access token. Ensure stockos-api/.env has the correct SUPABASE_URL (same project as VITE_SUPABASE_URL). ES256 projects are verified via JWKS automatically; HS256/legacy projects need SUPABASE_JWT_SECRET from Project Settings → API → JWT Settings. Restart stockos-api after changes.",
      );
    }
    const msg = syncJson.error?.message ?? "Could not sync account with server";
    throw new Error(msg);
  }
  const profile = syncJson.data;
  if (profile.status === "PENDING") {
    await supabaseSignOut();
    throw new Error(
      "Your account is pending admin approval. You will be able to sign in after an administrator activates it.",
    );
  }
  if (profile.status === "REJECTED") {
    await supabaseSignOut();
    throw new Error(
      "Your registration was not approved. Contact your administrator.",
    );
  }
  return {
    accessToken: token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in ?? 3600,
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
    },
  };
}

async function supabaseSignOut(): Promise<void> {
  try {
    await getSupabaseBrowserClient().auth.signOut();
  } catch {
    /* ignore */
  }
}

/** Email + password login using Supabase, then Nest /auth/sync (same as Next.js app). */
export async function loginWithSupabase(
  email: string,
  password: string,
): Promise<LoginSuccess> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    throw new Error(error.message);
  }
  const session = data.session;
  if (!session) {
    throw new Error(
      "No active session. Confirm your email from the link we sent you, then try again.",
    );
  }
  return loginDataFromSupabaseSession(session);
}
