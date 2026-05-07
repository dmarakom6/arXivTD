import Link from "next/link";
import Image from "next/image";

const primaryColor = "var(--primary)";

export function Footer() {
  return (
    <footer className="border-t bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative mt-2 w-16 h-16">
              {/* <Image
                src="/arxivtd-logo.png"
                alt="ArXivTD Logo"
                fill
                className="object-contain dark:invert"
              /> */}
            </div>
            <span className="text-lg font-bold font-serif" style={{ color: primaryColor }}>ArXivTD</span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Academic Paper Trust Analysis
            </span>
          </div>

          <nav className="flex gap-6 text-sm">
            <Link
              href="/terms"
              className="text-zinc-600 dark:text-zinc-400 hover:underline"
              style={{ color: primaryColor }}
            >
              Terms & Privacy
            </Link>
            <Link
              href="/documentation"
              className="text-zinc-600 dark:text-zinc-400 hover:underline"
              style={{ color: primaryColor }}
            >
              Documentation
            </Link>
            <Link
              href="/pricing"
              className="text-zinc-600 dark:text-zinc-400 hover:underline"
              style={{ color: primaryColor }}
            >
              Pricing
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}