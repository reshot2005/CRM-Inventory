import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { User, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  loginRequest,
  persistLogin,
  registerRequest,
  verify2FARequest,
} from "@/lib/auth-api";

function PreviewCard() {
  return (
    <div className="bg-navy rounded-2xl p-5 text-primary-foreground w-full max-w-lg shadow-hero">
      <div className="flex items-center justify-between mb-4">
        <span className="font-heading font-bold text-sm">StockOS Dashboard</span>
        <span className="font-mono text-xs text-cobalt">Live · 3 Warehouses</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total SKUs", value: "1,247" },
          { label: "Low stock", value: "18" },
          { label: "Move orders", value: "34" },
          { label: "POs open", value: "12" },
        ].map((s) => (
          <div key={s.label} className="bg-dark-lighter rounded-xl p-3">
            <p className="text-xs text-light-muted font-body">{s.label}</p>
            <p className="text-lg font-heading font-bold">{s.value}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-light-muted font-body leading-relaxed">
        Real-time inventory and approvals — the same experience you use after sign-in.
      </p>
    </div>
  );
}

const inputShell =
  "flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 transition focus-within:border-cobalt focus-within:ring-2 focus-within:ring-cobalt/20";

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

  useEffect(() => {
    setIsRegister(
      location.pathname === "/register" || searchParams.get("mode") === "register",
    );
  }, [location.pathname, searchParams]);

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
        await registerRequest({ email, password, name });
        toast.success("Account created", {
          description: "Pending admin approval. You can sign in once approved.",
        });
        setIsRegister(false);
        setPassword("");
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

  const title = twoFa ? "Two-factor verification" : isRegister ? "Create account" : "Sign in";
  const subtitle = twoFa
    ? "Enter the 6-digit code from your authenticator app."
    : isRegister
      ? "Use your work email. An administrator must approve new accounts."
      : "Sign in with your StockOS credentials.";

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background">
      <div className="flex w-full flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:w-1/2 lg:px-16 xl:px-20 bg-primary-section">
        <div className="mx-auto w-full max-w-md">
          <Link
            to="/"
            className="mb-8 inline-block text-sm font-body font-medium text-cobalt hover:text-cobalt-deep transition-colors"
          >
            ← Back to home
          </Link>

          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-foreground tracking-tight">
            {title}
          </h1>
          <p className="mt-2 text-[15px] font-body text-muted-foreground leading-relaxed">
            {subtitle}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {isRegister && !twoFa && (
              <div className={inputShell}>
                <User className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-[15px] font-body font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
                  required={isRegister}
                />
              </div>
            )}

            {!twoFa && (
              <>
                <div className={inputShell}>
                  <User className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[15px] font-body font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
                    required
                  />
                </div>
                <div className={inputShell}>
                  <Lock className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <input
                    type="password"
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[15px] font-body font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
                    required
                    minLength={isRegister ? 8 : undefined}
                  />
                </div>
              </>
            )}

            {twoFa && (
              <div className={inputShell}>
                <Lock className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="min-w-0 flex-1 bg-transparent text-[15px] font-body font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
                  maxLength={6}
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="shimmer-btn w-full rounded-full bg-cobalt py-3.5 text-[15px] font-body font-semibold text-primary-foreground shadow-lg transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
            >
              {loading
                ? "Please wait…"
                : twoFa
                  ? "Verify and continue"
                  : isRegister
                    ? "Create account"
                    : "Sign in"}
            </button>
          </form>

          {twoFa ? (
            <button
              type="button"
              className="mt-6 text-sm font-body font-medium text-cobalt hover:underline"
              onClick={() => {
                setTwoFa(null);
                setOtp("");
              }}
            >
              ← Back to login
            </button>
          ) : (
            <p className="mt-8 text-center text-sm font-body text-muted-foreground">
              {isRegister ? (
                <>
                  Already have an account?{" "}
                  <Link to="/login" className="font-semibold text-cobalt hover:underline">
                    Sign in
                  </Link>
                </>
              ) : (
                <>
                  New here?{" "}
                  <Link to="/register" className="font-semibold text-cobalt hover:underline">
                    Create an account
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="relative flex min-h-[280px] w-full flex-1 flex-col justify-center overflow-hidden gradient-dark noise-overlay px-8 py-12 sm:px-12 lg:min-h-screen lg:w-1/2">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-cobalt/10 blur-[100px] float-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-premium/10 blur-[90px] float-medium" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-xl">
          <p className="font-heading font-bold text-cobalt text-sm uppercase tracking-wider mb-4">
            StockOS
          </p>
          <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-primary-foreground leading-tight mb-6">
            Your inventory. Fully under control.
          </h2>
          <PreviewCard />
        </div>
      </div>
    </div>
  );
}
