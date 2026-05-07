"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { authApi, setToken, setUserEmail, getToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [requireTotp, setRequireTotp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const primaryColor = "var(--primary)";

  useEffect(() => {
    if (getToken()) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authApi.login(email, password);

      if (response.require_totp) {
        if (response.access_token) {
          setToken(response.access_token);
        }
        setRequireTotp(true);
        setLoading(false);
        return;
      }

      if (response.access_token) {
        setToken(response.access_token);
        setUserEmail(email);
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authApi.verifyTOTP(totpCode);
      setToken(response.access_token);
      setUserEmail(email);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] py-12 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated checkered background */}
      <div className="absolute inset-0 checkered-bg opacity-30 dark:opacity-10" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-lg border shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold font-serif" style={{ color: primaryColor }}>Login</h1>
            <p className="text-sm text-zinc-500 mt-2">Sign in to your ArXivTD account</p>
          </div>

          {!requireTotp ? (
            <form onSubmit={handleLogin}>
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
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm mb-4">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white py-2 rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: primaryColor }}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyTOTP}>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                Enter the 6-digit code from your authenticator app
              </p>

              <div className="mb-6">
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full px-4 py-2 border rounded-md text-center text-2xl tracking-widest bg-white/50 dark:bg-zinc-800/50 backdrop-blur"
                  maxLength={6}
                  placeholder="000000"
                  required
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm mb-4">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || totpCode.length !== 6}
                className="w-full text-white py-2 rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: primaryColor }}
              >
                {loading ? "Verifying..." : "Verify"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-zinc-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="hover:underline" style={{ color: primaryColor }}>
              Register
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}