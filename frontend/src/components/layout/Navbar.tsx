"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, ChevronDown, LogOut, User, BookOpen, CreditCard, Terminal } from "lucide-react";
import { getToken, clearToken, getUserEmail } from "@/lib/api";

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

  useEffect(() => {
    const token = getToken();
    setIsLoggedIn(!!token);
    const email = getUserEmail();
    if (email) setUserEmail(email);
  }, [pathname]);

  const handleLogout = () => {
    clearToken();
    setIsLoggedIn(false);
    window.location.href = "/";
  };

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const primaryColor = "var(--primary)";
  const username = userEmail ? getUsernameFromEmail(userEmail) : "";

  return (
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
                  <div className="absolute right-0 mt-1 w-40 rounded-md border bg-white dark:bg-zinc-900 shadow-xl">
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
  );
}