import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase-client";
import { loginDataFromSupabaseSession } from "@/lib/auth-api";

/**
 * Supabase redirects here after email confirmation (implicit `#access_token=…`, or `token_hash` / `code` query).
 * Add `…/auth/callback` in Supabase → Authentication → URL configuration → Redirect URLs.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [message, setMessage] = useState("Confirming your email…");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      navigate("/login?error=missing_supabase_env", { replace: true });
      return;
    }

    const supabase = getSupabaseBrowserClient();

    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const tokenHash = url.searchParams.get("token_hash");
        const otpType = url.searchParams.get("type");

        if (tokenHash && otpType) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType as
              | "signup"
              | "email"
              | "recovery"
              | "invite"
              | "magiclink"
              | "email_change",
          });
          if (error) {
            throw new Error(error.message);
          }
          window.history.replaceState({}, "", `${url.pathname}${url.hash}`);
        } else {
          const code = url.searchParams.get("code");
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(
              window.location.href,
            );
            if (error) {
              const low = error.message.toLowerCase();
              if (
                low.includes("code verifier") ||
                low.includes("pkce")
              ) {
                navigate("/login?error=pkce_cross_browser", { replace: true });
                return;
              }
              throw new Error(error.message);
            }
            window.history.replaceState({}, "", `${url.pathname}${url.hash}`);
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          navigate("/login?confirmed=1", { replace: true });
          return;
        }

        try {
          await loginDataFromSupabaseSession(session);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Could not complete sign-in";
          if (
            msg.toLowerCase().includes("pending") ||
            msg.toLowerCase().includes("approval")
          ) {
            navigate("/login?pending=1", { replace: true });
            return;
          }
          setStatus("error");
          setMessage(msg);
          return;
        }

        await supabase.auth.signOut();
        navigate("/login?confirmed=1", { replace: true });
      } catch (e) {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "Confirmation failed");
      }
    };

    void run();
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      {status === "working" ? (
        <p className="text-neutral-600">{message}</p>
      ) : (
        <>
          <p className="text-red-600">{message}</p>
          <Link
            to="/login"
            className="mt-6 text-sm font-medium text-[#6366f1] hover:underline"
          >
            Back to sign in
          </Link>
        </>
      )}
    </div>
  );
}
