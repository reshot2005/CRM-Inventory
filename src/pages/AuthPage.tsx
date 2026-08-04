import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { User, Lock, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  isSupabaseConfigured,
  loginRequest,
  loginWithSupabase,
  loginDataFromSupabaseSession,
  persistLogin,
  registerRequest,
  supabaseSignUpRegister,
  verify2FARequest,
} from "@/lib/auth-api";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

const inputShell =
  "flex items-center gap-3 rounded-2xl bg-[#f0f2ff] px-4 py-3.5 ring-1 ring-transparent transition focus-within:ring-2 focus-within:ring-[#7b61ff]/40";

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const fromPath = location.pathname === "/register";
  const initialRegister = fromPath || searchParams.get("mode") === "register";

  const [isRegister, setIsRegister] = useState(initialRegister);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [twoFa, setTwoFa] = useState<{ tempToken: string } | null>(null);
  const [otp, setOtp] = useState("");
  const [awaitingEmailConfirmation, setAwaitingEmailConfirmation] = useState(false);

  useEffect(() => {
    setIsRegister(
      location.pathname === "/register" || searchParams.get("mode") === "register",
    );
  }, [location.pathname, searchParams]);

  useEffect(() => {
    if (!isRegister) {
      setAwaitingEmailConfirmation(false);
    }
  }, [isRegister]);

  useEffect(() => {
    if (location.pathname !== "/login") {
      return;
    }
    if (searchParams.get("confirmed") === "1") {
      toast.success("Email confirmed", {
        description: "Sign in with your email and password.",
      });
    }
    if (searchParams.get("pending") === "1") {
      toast.message("Awaiting administrator approval", {
        description:
          "Your email is verified. An admin must activate your account before you can use the dashboard.",
      });
    }
    const err = searchParams.get("error");
    if (err === "missing_supabase_env") {
      toast.error("Supabase is not configured on this app.");
    } else if (err === "callback") {
      toast.error("Could not complete email confirmation. Try signing in or register again.");
    } else if (err === "pkce_cross_browser") {
      toast.error("Confirmation link must open in the same browser you used to register.", {
        description:
          "Or register again and open the email link in that same browser. New signups use a link that works from any email app.",
      });
    }
  }, [location.pathname, searchParams]);

  const handleSocial = (provider: string) => {
    toast.message(`${provider} sign-in`, {
      description: "Coming soon — use email and password for now.",
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (twoFa) {
      if (otp.length !== 6) {
        toast.error("Enter the 6-digit code from your authenticator app.");
        return;
      }
      setLoading(true);
      try {
        const data = await verify2FARequest(twoFa.tempToken, otp);
        persistLogin(data);
        toast.success("Welcome back!");
        navigate("/dashboard", { replace: true });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Verification failed");
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        if (isSupabaseConfigured()) {
          const { needsEmailConfirmation, session } = await supabaseSignUpRegister({
            name,
            email,
            password,
          });
          if (session) {
            const login = await loginDataFromSupabaseSession(session);
            persistLogin(login);
            toast.success("Account created", {
              description: "You are signed in.",
            });
            navigate("/dashboard", { replace: true });
            return;
          }
          if (needsEmailConfirmation) {
            setAwaitingEmailConfirmation(true);
            toast.success("Check your email", {
              description: `We sent a confirmation link to ${email.trim()}. Open it to verify your account, then sign in here.`,
            });
            return;
          }
        } else {
          await registerRequest({ email, password, name });
          toast.success("Account created", {
            description:
              "Your account is pending approval. You can sign in once an admin approves it.",
          });
          setIsRegister(false);
          setPassword("");
        }
        return;
      }

      if (isSupabaseConfigured()) {
        const data = await loginWithSupabase(email, password);
        persistLogin(data);
        toast.success("Welcome back!");
        navigate("/dashboard", { replace: true });
        return;
      }

      const result = await loginRequest(email, password);
      if ("requires2FA" in result && result.requires2FA) {
        setTwoFa({ tempToken: result.tempToken });
        toast.message("Two-factor authentication", {
          description: "Enter the code from your authenticator app.",
        });
        return;
      }
      persistLogin(result);
      toast.success("Welcome back!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const title = twoFa
    ? "VERIFY"
    : awaitingEmailConfirmation
      ? "CHECK YOUR INBOX"
      : isRegister
        ? "REGISTER"
        : "LOGIN";
  const subtitle = twoFa
    ? "Enter the 6-digit code from your authenticator app."
    : awaitingEmailConfirmation
      ? `We sent a confirmation link to ${email.trim() || "your email"}. Click the link in that message to verify your account, then return here to sign in.`
      : isRegister
        ? isSupabaseConfigured()
          ? "Use your work email and a strong password. You must confirm your email before you can sign in."
          : "Create an account. An administrator will approve your access."
        : "Sign in with your email and password.";

  return (
    <div
      className="min-h-screen w-full bg-white antialiased"
      style={{ fontFamily: "'Poppins', system-ui, sans-serif" }}
    >
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* —— Form column —— */}
        <div className="flex w-full flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:w-1/2 lg:px-16 xl:px-24">
          <div className="mx-auto w-full max-w-md">
            <Link
              to="/"
              className="mb-10 inline-block text-sm font-medium text-[#6366f1] transition hover:text-[#5046e5]"
            >
              ← Back to home
            </Link>

            <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl">
              {title}
            </h1>
            <p className="mt-3 text-[15px] font-medium leading-relaxed text-neutral-500">{subtitle}</p>

            {awaitingEmailConfirmation ? (
              <div className="mt-10 space-y-5 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-6 text-center">
                <p className="text-sm font-medium text-neutral-800">
                  Didn&apos;t get the email? Check spam, or wait a minute and try registering again.
                </p>
                <Link
                  to="/login"
                  className="inline-block rounded-full bg-[#6366f1] px-6 py-3 text-sm font-semibold text-white"
                  onClick={() => setAwaitingEmailConfirmation(false)}
                >
                  Go to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="mt-10 space-y-5">
                {isRegister && !twoFa && (
                  <>
                    <div>
                      <span className="text-sm font-medium text-neutral-700">Full name</span>
                      <div className={`${inputShell} mt-1.5`}>
                        <User className="h-5 w-5 shrink-0 text-neutral-400" strokeWidth={1.75} />
                        <input
                          type="text"
                          autoComplete="name"
                          placeholder="Your name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
                          required={isRegister}
                        />
                      </div>
                    </div>
                  </>
                )}

                {!twoFa && (
                  <>
                    <div>
                      <span className="text-sm font-medium text-neutral-700">Email address</span>
                      <div className={`${inputShell} mt-1.5`}>
                        <User className="h-5 w-5 shrink-0 text-neutral-400" strokeWidth={1.75} />
                        <input
                          type="email"
                          autoComplete="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-neutral-700">Password</span>
                      <div className={`${inputShell} mt-1.5`}>
                        <Lock className="h-5 w-5 shrink-0 text-neutral-400" strokeWidth={1.75} />
                        <input
                          type="password"
                          autoComplete={isRegister ? "new-password" : "current-password"}
                          placeholder={isRegister ? "At least 8 characters" : "Password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
                          required
                          minLength={isRegister ? 8 : undefined}
                        />
                      </div>
                    </div>
                  </>
                )}

                {twoFa && (
                  <div className={inputShell}>
                    <Lock className="h-5 w-5 shrink-0 text-neutral-400" strokeWidth={1.75} />
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
                      maxLength={6}
                      required
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-gradient-to-b from-[#9b8cff] via-[#7b61ff] to-[#5046e5] py-4 text-[15px] font-semibold text-white shadow-[0_10px_28px_-6px_rgba(80,70,229,0.55)] transition hover:brightness-[1.03] active:scale-[0.99] disabled:opacity-60"
                >
                  {loading
                    ? "Please wait…"
                    : twoFa
                      ? "Verify & continue"
                      : isRegister
                        ? "Create account"
                        : "Sign in"}
                </button>
              </form>
            )}

            {!twoFa && !awaitingEmailConfirmation && (
              <>
                <div className="relative my-10">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-neutral-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-4 font-medium text-neutral-400">Login with Others</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => handleSocial("Google")}
                    className="flex w-full items-center justify-center gap-3 rounded-full border border-neutral-200 bg-white py-3.5 text-[15px] font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
                  >
                    <GoogleIcon />
                    Login with google
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSocial("Facebook")}
                    className="flex w-full items-center justify-center gap-3 rounded-full border border-neutral-200 bg-white py-3.5 text-[15px] font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
                  >
                    <FacebookIcon />
                    Login with Facebook
                  </button>
                </div>
              </>
            )}

            {twoFa ? (
              <button
                type="button"
                className="mt-8 text-sm font-medium text-[#6366f1] hover:underline"
                onClick={() => {
                  setTwoFa(null);
                  setOtp("");
                }}
              >
                ← Back to login
              </button>
            ) : awaitingEmailConfirmation ? null : (
              <p className="mt-10 text-center text-sm text-neutral-500">
                {isRegister ? (
                  <>
                    Already have an account?{" "}
                    <Link
                      to="/login"
                      className="font-semibold text-[#6366f1] hover:underline"
                      onClick={() => setIsRegister(false)}
                    >
                      Login Now
                    </Link>
                  </>
                ) : (
                  <>
                    New here?{" "}
                    <Link
                      to="/register"
                      className="font-semibold text-[#6366f1] hover:underline"
                      onClick={() => setIsRegister(true)}
                    >
                      Create an account
                    </Link>
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        {/* —— Visual column —— */}
        <div className="relative flex min-h-[320px] w-full flex-1 flex-col justify-between overflow-hidden bg-[#6366f1] lg:min-h-screen lg:w-1/2">
          {/* Wavy pattern */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 50 Q 25 30 50 50 T 100 50' fill='none' stroke='white' stroke-width='0.5'/%3E%3C/svg%3E")`,
              backgroundSize: "200px 200px",
            }}
          />
          <div className="pointer-events-none absolute -right-20 top-1/4 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 bottom-1/4 h-72 w-72 rounded-full bg-[#818cf8]/40 blur-3xl" />

          <div className="relative z-10 flex flex-1 flex-col justify-center p-8 sm:p-12 lg:p-16">
            <div className="relative mx-auto max-w-xl">
              {/* Lightning badge */}
              <div className="absolute -left-2 top-8 z-20 flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/90 bg-white shadow-lg lg:-left-4 lg:top-12">
                <Zap className="h-7 w-7 text-amber-500" fill="currentColor" strokeWidth={0} />
              </div>

              <div className="overflow-hidden rounded-[2rem] border border-white/25 bg-white/15 p-6 shadow-2xl backdrop-blur-md sm:rounded-[2.25rem] sm:p-8 lg:ml-6 lg:p-10">
                <h2 className="max-w-sm text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
                  Very good works are waiting for you Login Now!!!
                </h2>

                <div className="relative mt-8 flex justify-center lg:mt-10">
                  <div className="relative inline-block rounded-2xl border-2 border-white/50 bg-white/10 p-2 shadow-inner">
                    <img
                      src="/auth-hero.png"
                      alt="Professional using StockOS on a tablet"
                      className="max-h-[min(52vh,420px)] w-auto max-w-full rounded-xl object-cover object-top"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
