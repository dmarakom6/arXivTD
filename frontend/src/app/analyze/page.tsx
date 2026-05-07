"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getToken, getPreferredApiKey, keysApi, trustApi } from "@/lib/api";
import { Loader2 } from "lucide-react";
import Link from "next/link";

interface KeyOption {
  id: string;
  label: string;
  credits_balance: number;
  key?: string;
}

export default function AnalyzePage() {
  const router = useRouter();
  const [arxivId, setArxivId] = useState("");
  const [scanMode, setScanMode] = useState<"basic" | "deep">("basic");
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keys, setKeys] = useState<KeyOption[]>([]);
  const [validation, setValidation] = useState<{ isValid: boolean; message: string | null }>({ isValid: false, message: null });

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

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKeyId || !validation.isValid || loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await trustApi.get(arxivId.trim().replace("arXiv:", ""), scanMode, apiKey);
      router.push(`/scans/${response.scan_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-24 px-6">
      <div className="max-w-md mx-auto">
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
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">ArXiv Identifier</label>
            <input
              type="text"
              value={arxivId}
              onChange={(e) => setArxivId(e.target.value)}
              placeholder="0000.00000"
              className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm outline-none focus:border-[var(--primary)] text-sm font-mono transition-colors"
            />
            {arxivId && (
              <p className={`text-[10px] font-bold uppercase tracking-widest ${validation.isValid ? 'text-zinc-400' : 'text-rose-500'}`}>
                {validation.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Authorization Profile</label>
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
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Analysis Depth</label>
            <div className="flex gap-2">
              {(['basic', 'deep'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setScanMode(mode)}
                  className={`flex-1 py-3 px-4 border rounded-sm text-xs font-black uppercase tracking-widest transition-all ${scanMode === mode
                    ? "bg-zinc-100 text-zinc-900 border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-600"
                    }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 text-xs font-bold border border-rose-100 dark:border-rose-900 rounded-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !selectedKeyId || !validation.isValid}
            className="w-full py-5 bg-[var(--primary)] text-white font-black text-xs uppercase tracking-[0.25em] rounded-sm disabled:opacity-50 transition-all hover:opacity-90 flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start Scan"}
          </button>
        </form>

        <footer className="mt-20 pt-10 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
          <Link href="/dashboard" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            ← Return to Dashboard
          </Link>
          {/* <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300 dark:text-zinc-700">
            arXivTD
          </span> */}
        </footer>
      </div>
    </div>
  );
}