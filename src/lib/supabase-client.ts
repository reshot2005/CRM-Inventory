import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return Boolean(url && key);
}

/** Single browser client — avoids multiple GoTrueClient instances on the same storage key. */
export function getSupabaseBrowserClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in your .env file.",
    );
  }
  if (!browserClient) {
    browserClient = createClient(url, key, {
      auth: {
        flowType: "implicit",
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}

export function getAppOrigin(): string {
  const fromEnv = import.meta.env.VITE_APP_URL?.replace(/\/$/, "");
  if (fromEnv) {
    return fromEnv;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:8080";
}
