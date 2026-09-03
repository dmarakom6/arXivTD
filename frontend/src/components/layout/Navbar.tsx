"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, ChevronDown, LogOut, User, BookOpen, CreditCard, Terminal, Key, Eye, EyeOff } from "lucide-react";
import { getToken, clearToken, getUserEmail, fetchApi } from "@/lib/api";

const navLinks = [
  { href: "/analyze", label: "Analyze" },
  { href: "/dashboard", label: "Dashboard" },
];

const apiLinks = [
  {
    href: "/documentation",
    label: "Docs",
    description: "API reference & examples",
    icon: BookOpen
  },
  {
    href: "/pricing",
    label: "Pricing",
    description: "Plans & credit packages",
    icon: CreditCard
  },
  {
    href: "/cli",
    label: "CLI",
    description: "Command-line tool",
    icon: Terminal
  },
];

function getUsernameFromEmail(email: string): string {
  return email.split('@')[0];
}

export function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [apiMenuOpen, setApiMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [s2Key, setS2Key] = useState("");
  const [s2KeyPreview, setS2KeyPreview] = useState<string | null>(null);
  const [hasS2Key, setHasS2Key] = useState(false);
  const [showS2Key, setShowS2Key] = useState(false);
  const [s2KeyLoading, setS2KeyLoading] = useState(false);
  const [s2KeyError, setS2KeyError] = useState("");
  const [s2KeySuccess, setS2KeySuccess] = useState("");

  useEffect(() => {
    const token = getToken();
    setIsLoggedIn(!!token);
    const email = getUserEmail();
    if (email) setUserEmail(email);
    if (token) {
      fetchS2KeyStatus();
    }
  }, [pathname]);

  const fetchS2KeyStatus = async () => {
    try {
      const data = await fetchApi<{ has_s2_key: boolean; s2_key_preview: string | null }>("/user/s2-key");
      setHasS2Key(data.has_s2_key);
      setS2KeyPreview(data.s2_key_preview);
    } catch {
      // Silently fail
    }
  };

  const handleSaveS2Key = async () => {
    setS2KeyLoading(true);
    setS2KeyError("");
    setS2KeySuccess("");
    try {
      const data = await fetchApi<{ has_s2_key: boolean; s2_key_preview: string | null }>(
        "/user/s2-key",
        { method: "POST", body: JSON.stringify({ s2_key: s2Key }) }
      );
      setHasS2Key(true);
      setS2KeyPreview(data.s2_key_preview);
      setS2KeySuccess("S2 key saved successfully");
      setS2Key("");
      setShowS2Key(false);
    } catch (err: any) {
      setS2KeyError(err.message || "Failed to save S2 key");
    } finally {
      setS2KeyLoading(false);
    }
  };

  const handleDeleteS2Key = async () => {
    setS2KeyLoading(true);
    setS2KeyError("");
    setS2KeySuccess("");
    try {
      await fetchApi("/user/s2-key", { method: "DELETE" });
      setHasS2Key(false);
      setS2KeyPreview(null);
      setS2KeySuccess("S2 key removed");
    } catch (err: any) {
      setS2KeyError(err.message || "Failed to remove S2 key");
    } finally {
      setS2KeyLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setIsLoggedIn(false);
    window.location.href = "/";
  };

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const primaryColor = "var(--primary)";
  const username = userEmail ? getUsernameFromEmail(userEmail) : "";

  return (
    <>
    <header className="sticky top-0 z-50 w-full border-b bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-1">
              <div className="relative w-16 h-16 mt-2">
                <Image
                  src="/arxivtd-logo.png"
                  alt="ArXivTD Logo"
                  fill
                  className="object-contain dark:invert"
                />
              </div>
              <span className="text-2xl font-bold font-serif" style={{ color: primaryColor }}>ArXivTD</span>
            </Link>

            {!isAuthPage && (
              <nav className="hidden md:flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="px-3 py-2 text-sm font-medium transition-colors hover:text-black dark:hover:text-white"
                    style={pathname === link.href ? { color: primaryColor } : { color: 'inherit' }}
                  >
                    {link.label}
                  </Link>
                ))}

                <div
                  className="relative"
                  onMouseEnter={() => setApiMenuOpen(true)}
                  onMouseLeave={() => setApiMenuOpen(false)}
                >
                  <button
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors hover:text-black dark:hover:text-white"
                    style={apiLinks.some(l => pathname.startsWith(l.href)) ? { color: primaryColor } : { color: 'inherit' }}
                  >
                    API <ChevronDown className="h-4 w-4" />
                  </button>
                  {apiMenuOpen && (
                    <div className="absolute left-0 mt-1 w-64 rounded-md border bg-white dark:bg-zinc-900 shadow-xl p-2">
                      {apiLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="flex items-start gap-3 px-4 py-3 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <link.icon className="h-5 w-5 mt-0.5" style={{ color: primaryColor }} />
                          <div>
                            <div className="text-sm font-medium">{link.label}</div>
                            <div className="text-xs text-zinc-500">{link.description}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </nav>
            )}
          </div>

          <div className="hidden md:flex items-center gap-4">
            {isLoggedIn ? (
              <div
                className="relative"
                onMouseEnter={() => setUserMenuOpen(true)}
                onMouseLeave={() => setUserMenuOpen(false)}
              >
                <button
                  className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <User className="h-4 w-4" />
                  <span className="max-w-[150px] truncate">{username}</span>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full w-48 rounded-md border bg-white dark:bg-zinc-900 shadow-xl z-50">
                    <button
                      onClick={() => {
                        setShowCredentialsModal(true);
                        setUserMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Key className="h-4 w-4" /> Manage Credentials
                      {hasS2Key && (
                        <span className="ml-auto text-xs text-green-600">S2</span>
                      )}
                    </button>
                    <div className="border-t" />
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <LogOut className="h-4 w-4" /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-medium px-4 py-2 text-white rounded-md hover:opacity-90"
                  style={{ backgroundColor: primaryColor }}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button
            className="md:hidden p-2"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t md:hidden bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md">
          <nav className="flex flex-col p-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="py-2 text-sm font-medium"
                style={pathname === link.href ? { color: primaryColor } : {}}
              >
                {link.label}
              </Link>
            ))}
            <div className="py-2 text-sm font-medium text-zinc-500">API</div>
            {apiLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="py-2 pl-4 text-sm"
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t mt-2 pt-2">
              {isLoggedIn ? (
                <button
                  onClick={handleLogout}
                  className="block py-2 text-sm text-left"
                >
                  Logout
                </button>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-sm font-medium"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-sm font-medium"
                    style={{ color: primaryColor }}
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}

    </header>

      {/* Manage Credentials Modal - rendered outside header to avoid clipping */}
      {showCredentialsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowCredentialsModal(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md mx-4 p-6 relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Manage Credentials</h2>
              <button onClick={() => setShowCredentialsModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Semantic Scholar API Key</label>
                <p className="text-xs text-zinc-500 mb-2">
                  Your own S2 key gives you 0-credit basic scans and faster rate limits.
                  <a href="https://www.semanticscholar.org/product/api#api-key" target="_blank" rel="noopener noreferrer" className="ml-1 underline">Get a free key</a>
                </p>

                {hasS2Key ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                    <span className="text-sm text-green-700 dark:text-green-300">
                      S2 key configured: <code>{s2KeyPreview}</code>
                    </span>
                    <button
                      onClick={handleDeleteS2Key}
                      disabled={s2KeyLoading}
                      className="ml-auto text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type={showS2Key ? "text" : "password"}
                        value={s2Key}
                        onChange={(e) => setS2Key(e.target.value)}
                        placeholder="s2k-..."
                        className="w-full px-3 py-2 text-sm border rounded-md pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowS2Key(!showS2Key)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                      >
                        {showS2Key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <button
                      onClick={handleSaveS2Key}
                      disabled={s2KeyLoading || !s2Key}
                      className="w-full px-4 py-2 text-sm font-medium text-white bg-black dark:bg-white dark:text-black rounded-md hover:opacity-90 disabled:opacity-50"
                    >
                      {s2KeyLoading ? "Validating..." : "Save S2 Key"}
                    </button>
                  </div>
                )}

                {s2KeyError && (
                  <p className="mt-2 text-xs text-red-600">{s2KeyError}</p>
                )}
                {s2KeySuccess && (
                  <p className="mt-2 text-xs text-green-600">{s2KeySuccess}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}