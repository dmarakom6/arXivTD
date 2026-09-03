"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { authApi, setToken, setUserEmail, getToken, setApiKey } from "@/lib/api";

declare global {
  interface Window {
    turnstile?: {
      ready: (cb: () => void) => void;
      render: (
        el: string,
        options: Record<string, unknown>
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// Load the Turnstile script once (explicit rendering, SPA-correct) and poll
// until window.turnstile is available. Polling is more reliable than relying on
// the onload timing of a dynamically-injected script.
function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("window is undefined"));
      return;
    }
    if (window.turnstile) {
      resolve();
      return;
    }
    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SCRIPT_SRC}"]`
    );
    if (!script) {
      script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    const started = Date.now();
    const timer = setInterval(() => {
      if (window.turnstile) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > 10000) {
        clearInterval(timer);
        reject(new Error("Timed out waiting for Turnstile to load"));
      }
    }, 100);
  });
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"register" | "verify">("register");
  const [qrCode, setQrCode] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const primaryColor = "var(--primary)";

  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (getToken()) {
      // Check if token is full access (we could decode it here, but simpler to just push if we are on dashboard)
      // For now, if we have a token, we check if we were redirected back to register, which shouldn't happen unless token is problematic or user wants another account.
    }
  }, [router]);

  // Render the Turnstile widget explicitly. Implicit rendering does not work
  // reliably inside a Next.js SPA (the api.js scans for .cf-turnstile divs
  // before React mounts them), so we control rendering via the JS API.
  useEffect(() => {
    if (step !== "register") return;
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!sitekey || !turnstileRef.current) return;

    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile || !turnstileRef.current) return;
        // Remove any prior widget to avoid duplicate renders on re-run.
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            /* ignore */
          }
        }
        widgetIdRef.current = window.turnstile.render("#turnstile-widget", {
          sitekey,
          callback: (token: string) => setTurnstileToken(token),
          "error-callback": () => setTurnstileToken(""),
          "expired-callback": () => setTurnstileToken(""),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setError("Unable to load verification. Please refresh and try again.");
        }
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && typeof window !== "undefined" && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
  }, [step]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authApi.register(email, password, turnstileToken);
      if (response.access_token) {
        setToken(response.access_token);
      }
      setUserEmail(email);

      if (response.totp_setup_qr) {
        setQrCode(response.totp_setup_qr);
        setStep("verify");
      } else {
        if (response.api_key) {
          setApiKey(response.api_key);
        }
        setSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEnableTOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authApi.enableTOTP(totpCode);
      // Replace the pending token with the full token
      if (response.access_token) {
        setToken(response.access_token);
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[calc(100vh-200px)] py-12 flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 checkered-bg opacity-30 dark:opacity-10" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-lg border shadow-2xl p-8 text-center">
            <h1 className="text-2xl font-bold font-serif mb-4" style={{ color: primaryColor }}>Welcome to ArXivTD!</h1>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">Your account has been created successfully.</p>

            {apiKey && (
              <div className="mb-6 p-4 bg-zinc-50/50 dark:bg-zinc-800/50 backdrop-blur rounded text-left">
                <p className="text-sm font-medium mb-2">Your API Key (save this!):</p>
                <code className="text-xs break-all text-zinc-600 dark:text-zinc-300">{apiKey}</code>
              </div>
            )}

            <p className="text-sm text-zinc-500 mb-4">You received 5 free credits to get started.</p>

            <Link
              href="/dashboard"
              className="inline-block text-white px-6 py-2 rounded-md hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              Go to Dashboard
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <div className="min-h-[calc(100vh-200px)] py-20 flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 checkered-bg opacity-30 dark:opacity-10" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-lg border shadow-2xl p-8">
            <h1 className="text-2xl font-bold font-serif mb-2 text-center" style={{ color: primaryColor }}>Set Up Authenticator</h1>
            <p className="text-sm text-zinc-500 mb-6 text-center">
              Scan this QR code with your authenticator app
            </p>

            {qrCode && (
              <div className="flex justify-center mb-6">
                <img src={qrCode} alt="TOTP QR Code" className="border rounded-lg shadow-sm" />
              </div>
            )}

            <p className="text-sm text-zinc-600 mb-4 text-center">
              Enter the 6-digit code from your app:
            </p>

            <form onSubmit={handleEnableTOTP}>
              <div className="mb-6">
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full px-4 py-2 border rounded-md text-center text-2xl tracking-widest bg-white/50 dark:bg-zinc-800/50 backdrop-blur"
                  maxLength={6}
                  placeholder="000000"
                />
              </div>

              {error && <p className="text-red-600 text-sm mb-4 text-center font-medium">{error}</p>}

              <button
                type="submit"
                disabled={loading || totpCode.length !== 6}
                className="w-full text-white py-2 rounded-md hover:opacity-90 disabled:opacity-50 shadow-lg transition-all active:scale-[0.98]"
                style={{ backgroundColor: primaryColor }}
              >
                {loading ? "Verifying..." : "Confirm & Access Dashboard"}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-200px)] py-12 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 checkered-bg opacity-30 dark:opacity-10" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-lg border shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold font-serif" style={{ color: primaryColor }}>Register</h1>
            <p className="text-sm text-zinc-500 mt-2">Create your ArXivTD account</p>
          </div>

          <form onSubmit={handleRegister}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border rounded-md bg-white/50 dark:bg-zinc-800/50 backdrop-blur"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-md bg-white/50 dark:bg-zinc-800/50 backdrop-blur"
                required
                minLength={8}
              />
            </div>

            {/* Turnstile Widget (explicit rendering) */}
            <div className="mb-6 flex justify-center" suppressHydrationWarning>
              <div id="turnstile-widget" ref={turnstileRef} suppressHydrationWarning />
            </div>

            {error && (
              <p className="text-red-600 text-sm mb-4">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || (!turnstileToken && process.env.NODE_ENV === 'production')}
              className="w-full text-white py-2 rounded-md hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link href="/login" className="hover:underline" style={{ color: primaryColor }}>
              Sign In
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}