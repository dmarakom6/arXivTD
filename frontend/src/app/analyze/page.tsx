"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getToken, getPreferredApiKey, keysApi, trustApi, similarApi, scanStatusApi } from "@/lib/api";
import { Loader2, ExternalLink, XCircle } from "lucide-react";
import Link from "next/link";

interface KeyOption {
  id: string;
  label: string;
  credits_balance: number;
  key?: string;
}

interface SimilarPaper {
  title: string;
  arxiv_id: string;
  authors: string[];
}

type PageState = "form" | "scanning";

export default function AnalyzePage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("form");
  const [arxivId, setArxivId] = useState("");
  const [scanMode, setScanMode] = useState<"basic" | "deep">("basic");
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keys, setKeys] = useState<KeyOption[]>([]);
  const [validation, setValidation] = useState<{ isValid: boolean; message: string | null }>({ isValid: false, message: null });

  // Scanning state
  const [scanId, setScanId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [similarPapers, setSimilarPapers] = useState<SimilarPaper[]>([]);
  const [similarLoaded, setSimilarLoaded] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    loadKeys();
  }, [router]);

  const loadKeys = async () => {
    try {
      const keysData = await keysApi.list();
      const keysWithRevealed: KeyOption[] = [];
      for (const k of keysData) {
        try {
          const revealed = await keysApi.reveal(k.id);
          keysWithRevealed.push({ ...k, key: revealed.key });
        } catch {
          keysWithRevealed.push(k);
        }
      }
      setKeys(keysWithRevealed);
      const preferred = getPreferredApiKey();
      if (preferred) {
        const selected = keysWithRevealed.find(k => k.id === preferred);
        if (selected) {
          setSelectedKeyId(preferred);
          setApiKey(selected.key || "");
        }
      } else if (keysWithRevealed.length > 0) {
        setSelectedKeyId(keysWithRevealed[0].id);
        setApiKey(keysWithRevealed[0].key || "");
      }
    } catch (err) {
      console.error("Failed to load keys:", err);
    }
  };

  const validateArxivId = useCallback((id: string) => {
    if (!id.trim()) return { isValid: false, message: null };
    let normalized = id.trim().replace("arXiv:", "");
    const isValid = /^\d{4}\.\d{4,5}$/.test(normalized) || /^hep-TH\/\d{7}$/.test(normalized);
    return isValid
      ? { isValid: true, message: "" }
      : { isValid: false, message: "Invalid Format (e.g. 2310.12345)" };
  }, []);

  useEffect(() => {
    setValidation(validateArxivId(arxivId));
  }, [arxivId, validateArxivId]);

  const handleKeyChange = (keyId: string) => {
    const key = keys.find(k => k.id === keyId);
    setSelectedKeyId(keyId);
    setApiKey(key?.key || "");
  };

  const resetToForm = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    setPageState("form");
    setScanId(null);
    setElapsed(0);
    setSimilarPapers([]);
    setSimilarLoaded(false);
    setError("");
    setLoading(false);
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKeyId || !validation.isValid || loading || pageState === "scanning") return;

    setLoading(true);
    setError("");
    setPageState("scanning");
    setElapsed(0);
    setSimilarPapers([]);
    setSimilarLoaded(false);

    const startTime = Date.now();

    // Start elapsed timer
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const cleanId = arxivId.trim().replace("arXiv:", "");
      const response = await trustApi.getAsync(cleanId, scanMode, apiKey);
      setScanId(response.scan_id);

      // Fetch similar papers after 3 seconds
      setTimeout(async () => {
        try {
          const similar = await similarApi.get(cleanId, apiKey);
          setSimilarPapers(similar.papers || []);
        } catch {
          // Ignore - similar papers are optional
        } finally {
          setSimilarLoaded(true);
        }
      }, 3000);

      // Start polling for completion
      pollRef.current = setInterval(async () => {
        try {
          const status = await scanStatusApi.get(response.scan_id, apiKey);
          if (status.status === "completed") {
            // Cleanup timers
            if (timerRef.current) clearInterval(timerRef.current);
            if (pollRef.current) clearInterval(pollRef.current);

            // Redirect to the scan detail page
            router.push(`/scans/${response.scan_id}`);
          } else if (status.status === "failed") {
            if (timerRef.current) clearInterval(timerRef.current);
            if (pollRef.current) clearInterval(pollRef.current);
            setError(status.error || "Scan failed");
            setPageState("form");
            setLoading(false);
          }
        } catch {
          // Poll error - continue trying
        }
      }, 2000);
    } catch (err) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      setError(err instanceof Error ? err.message : "Analysis failed");
      setLoading(false);
      setPageState("form");
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-24 px-6">
      <div className="max-w-2xl mx-auto">
        {/* ======================== */}
        {/* FORM STATE               */}
        {/* ======================== */}
        {pageState === "form" && (
          <>
            <header className="mb-12">
              <h1 className="text-3xl font-bold font-serif mb-2 text-zinc-900 dark:text-zinc-100">
                Submit Analysis
              </h1>
              <p className="text-sm text-zinc-500 font-medium tracking-tight">
                Initiate a document integrity audit via ArXiv ID.
              </p>
            </header>

            <form onSubmit={handleScan} className="space-y-8">
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">ArXiv Identifier</label>
                <input
                  type="text"
                  value={arxivId}
                  onChange={(e) => setArxivId(e.target.value)}
                  placeholder="0000.00000"
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm outline-none focus:border-[var(--primary)] text-sm font-mono transition-colors"
                />
                {arxivId && (
                  <p className={`text-[11px] font-bold uppercase tracking-widest ${validation.isValid ? 'text-zinc-500' : 'text-rose-500'}`}>
                    {validation.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Authorization Profile</label>
                <select
                  value={selectedKeyId}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm outline-none text-sm font-medium transition-colors"
                >
                  <option value="">Select Profile</option>
                  {keys.map(k => (
                    <option key={k.id} value={k.id}>{k.label} ({k.credits_balance} Credits)</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Analysis Depth</label>
                <div className="flex gap-2">
                  {(['basic', 'deep'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setScanMode(mode)}
                      className={`flex-1 py-3 px-4 border rounded-sm text-xs font-black uppercase tracking-widest transition-all ${scanMode === mode
                        ? "bg-zinc-100 text-zinc-900 border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-700"
                        }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 text-xs font-bold border border-rose-100 dark:border-rose-900 rounded-sm flex items-start gap-3">
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !selectedKeyId || !validation.isValid}
                className="w-full py-5 bg-[var(--primary)] text-white font-black text-xs uppercase tracking-[0.25em] rounded-sm disabled:opacity-50 transition-all hover:opacity-90 flex items-center justify-center gap-3"
              >
                Start Scan
              </button>
            </form>
          </>
        )}

        {/* ======================== */}
        {/* SCANNING STATE           */}
        {/* ======================== */}
        {pageState === "scanning" && (
          <div className="space-y-8">
            <header className="mb-8">
              <h1 className="text-3xl font-bold font-serif mb-2 text-zinc-900 dark:text-zinc-100">
                Analyzing Paper
              </h1>
              <p className="text-sm text-zinc-500 font-medium tracking-tight font-mono">
                {arxivId.trim()} &middot; {scanMode} scan
              </p>
            </header>

            {/* Pulsing indicator + timer */}
            <div className="flex items-center gap-4 p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--primary)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--primary)]"></span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Scanning paper...
                </div>
                <div className="text-[11px] font-mono text-zinc-500 mt-1">
                  {formatTime(elapsed)} elapsed
                </div>
              </div>
              {scanId && (
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">Scan ID</div>
                  <div className="text-[10px] font-mono text-zinc-500">{scanId.slice(0, 8)}...</div>
                </div>
              )}
            </div>

            {/* Similar Papers */}
            {similarPapers.length > 0 && (
              <div className="space-y-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">
                  While you wait &mdash; Related Papers
                </div>
                <div className="space-y-3">
                  {similarPapers.map((paper) => (
                    <a
                      key={paper.arxiv_id}
                      href={`https://arxiv.org/abs/${paper.arxiv_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-[var(--primary)] transition-colors line-clamp-2">
                            {paper.title}
                          </div>
                          <div className="text-xs text-zinc-500 mt-1">
                            {paper.authors?.join(", ")}
                          </div>
                          <div className="text-[11px] font-mono text-zinc-500 mt-1">
                            {paper.arxiv_id}
                          </div>
                        </div>
                        <ExternalLink className="h-3 w-3 text-zinc-500 group-hover:text-zinc-700 mt-1 shrink-0" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {!similarLoaded && (
              <div className="text-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400 mx-auto" />
                <p className="text-[11px] text-zinc-500 mt-2">Finding related papers...</p>
              </div>
            )}
          </div>
        )}

        {/* ======================== */}
        {/* RESULTS STATE            */}
        {/* ======================== */}
        <footer className="mt-20 pt-10 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
          <Link href="/dashboard" className="text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            ← Return to Dashboard
          </Link>
        </footer>
      </div>
    </div>
  );
}
