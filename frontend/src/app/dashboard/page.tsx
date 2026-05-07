"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { keysApi, scansApi, creditsApi, getToken, getUserEmail, setPreferredApiKey } from "@/lib/api";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Copy,
  RefreshCw,
  Trash2,
  Plus,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  Key,
  CheckCircle,
  Loader2,
  MoreVertical,
  X
} from "lucide-react";
import Link from "next/link";

interface APIKey {
  id: string;
  key?: string;
  label: string;
  is_active: boolean;
  credits_balance: number;
  model_tier: string;
  created_at: string;
}

interface Scan {
  id: string;
  url: string;
  trust_score?: number;
  credits_spent: number;
  created_at: string;
}

const PRICING = {
  gemini_flash: { name: "Gemini Flash", basePrice: 12, perCredit: 0.12 },
  claude_sonnet: { name: "Claude Sonnet", basePrice: 20, perCredit: 0.20 },
  claude_opus: { name: "Claude Opus", basePrice: 36, perCredit: 0.36 },
};

const CREDIT_PACKAGES = [
  { credits: 100, label: "Starter", discount: 0 },
  { credits: 500, label: "Professional", discount: 0.10 },
  { credits: 1000, label: "Institutional", discount: 0.15 },
];

const calculatePrice = (credits: number, model: string) => {
  const pricing = PRICING[model as keyof typeof PRICING] || PRICING.gemini_flash;
  const basePrice = credits * pricing.perCredit;
  const pkg = CREDIT_PACKAGES.find(p => p.credits === credits);
  const discount = pkg?.discount || 0;
  return (basePrice * (1 - discount)).toFixed(2);
};

export default function DashboardPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [activeTab, setActiveTab] = useState<"keys" | "scans">("keys");
  const [loading, setLoading] = useState(true);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedKey, setSelectedKey] = useState<APIKey | null>(null);
  const [purchasePackage, setPurchasePackage] = useState(100);
  const [purchaseModel, setPurchaseModel] = useState("gemini_flash");
  const [keyLabel, setKeyLabel] = useState("");
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});
  const [showRevealed, setShowRevealed] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [keyToRotate, setKeyToRotate] = useState<APIKey | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    loadData();
  }, [router]);

  const loadData = async () => {
    try {
      const [keysData, scansData] = await Promise.all([
        keysApi.list(),
        scansApi.list(),
      ]);
      setKeys(keysData);
      setScans(scansData.items);
      if (keysData.length > 0) {
        setPreferredApiKey(keysData[0].id);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevealToggle = async (keyId: string) => {
    if (showRevealed[keyId]) {
      setShowRevealed(prev => ({ ...prev, [keyId]: false }));
      return;
    }

    if (revealedKeys[keyId]) {
      setShowRevealed(prev => ({ ...prev, [keyId]: true }));
      return;
    }

    try {
      const revealed = await keysApi.reveal(keyId);
      setRevealedKeys(prev => ({ ...prev, [keyId]: revealed.key || "" }));
      setShowRevealed(prev => ({ ...prev, [keyId]: true }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reveal key");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRotateKey = async () => {
    if (!keyToRotate) return;
    setRotatingId(keyToRotate.id);
    setShowRotateModal(false);
    try {
      const newKey = await keysApi.rotate(keyToRotate.id);
      // Show the new key immediately
      setRevealedKeys(prev => ({ ...prev, [keyToRotate.id]: newKey.key || "" }));
      setShowRevealed(prev => ({ ...prev, [keyToRotate.id]: true }));
      // Reload and move rotated key to top
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rotate key");
    } finally {
      setRotatingId(null);
      setKeyToRotate(null);
    }
  };

  const openRotateModal = (key: APIKey) => {
    setKeyToRotate(key);
    setShowRotateModal(true);
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("Permanently delete this API key and its associated credits?")) return;
    try {
      await keysApi.delete(keyId);
      loadData();
    } catch (err) {
      console.error("Failed to delete key:", err);
    }
  };

  const handlePurchase = async () => {
    try {
      if (!selectedKey) {
        // Creating a new key
        if (!keyLabel.trim()) {
          alert("Please enter a name for your API key");
          return;
        }
        const response = await keysApi.create(keyLabel.trim(), purchasePackage, purchaseModel) as any;
        if (response.checkout_url) {
          window.location.href = response.checkout_url;
        }
      } else {
        // Topping up existing key
        const response = await creditsApi.buy(selectedKey.id, purchasePackage, purchaseModel) as any;
        if (response.checkout_url) {
          window.location.href = response.checkout_url;
        }
      }
    } catch (err) {
      console.error("Failed to purchase credits:", err);
      alert(err instanceof Error ? err.message : "Failed to purchase credits");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-bold font-serif text-zinc-900 dark:text-zinc-100">User Dashboard</h1>
            <p className="text-sm font-medium text-zinc-500 mt-1">{getUserEmail()}</p>
          </div>
          <div className="flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 rounded-xl shadow-sm">
            <button
              onClick={() => setActiveTab("keys")}
              className={`flex items-center gap-2 px-6 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-lg ${activeTab === "keys"
                ? "bg-[var(--arxiv-burgundy)] dark:bg-[var(--arxiv-burgundy-dark)] text-white"
                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                }`}
            >
              <Key className="h-4 w-4 shrink-0" /> API Keys
            </button>
            <button
              onClick={() => setActiveTab("scans")}
              className={`flex items-center gap-2 px-6 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-lg ${activeTab === "scans"
                ? "bg-[var(--arxiv-burgundy)] dark:bg-[var(--arxiv-burgundy-dark)] text-white"
                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                }`}
            >
              <History className="h-4 w-4 shrink-0" /> Scan Log
            </button>
          </div>
        </header>

        {activeTab === "keys" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Authorization Keys</h2>
              <button
                onClick={() => {
                  setSelectedKey(null);
                  setPurchaseModel("gemini_flash");
                  setKeyLabel("");
                  setPurchasePackage(100);
                  setShowPurchaseModal(true);
                }}
                className="inline-flex items-center gap-2 bg-[var(--primary)] text-white px-5 py-2.5 rounded-sm text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" /> New Key
              </button>
            </div>

            {keys.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-20 text-center">
                <Key className="h-8 w-8 text-zinc-200 dark:text-zinc-800 mx-auto mb-4" />
                <p className="text-sm text-zinc-500 font-medium italic">No active access profiles found in registry.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {keys.map((key) => (
                  <div key={key.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm overflow-hidden group">
                    <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{key.label}</h3>
                          <span className="text-[9px] font-black uppercase tracking-tighter bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-zinc-500 rounded">
                            {key.model_tier}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded px-3 py-2 flex items-center justify-between gap-4 font-mono text-xs">
                            <span className="text-zinc-400 select-none">
                              {showRevealed[key.id] ? revealedKeys[key.id] || "••••••••••••••••" : "at-••••••••" + key.id.slice(-4)}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleRevealToggle(key.id)}
                                className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                              >
                                {showRevealed[key.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                              {showRevealed[key.id] && revealedKeys[key.id] && (
                                <button
                                  onClick={() => copyToClipboard(revealedKeys[key.id], key.id)}
                                  className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                                >
                                  {copiedId === key.id ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                          Created {new Date(key.created_at).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-10">
                        <div className="text-right">
                          <div className="text-3xl font-bold font-serif text-[var(--primary)]">{key.credits_balance}</div>
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Credits Available</div>
                        </div>

                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedKey(key);
                              setPurchaseModel(key.model_tier);
                              setShowPurchaseModal(true);
                            }}
                            className="p-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-sm transition-all shadow-sm"
                            title="Add Credits"
                          >
                            <CreditCard className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openRotateModal(key)}
                            className={`p-2.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-sm transition-all shadow-sm ${rotatingId === key.id ? 'animate-spin' : ''}`}
                            disabled={rotatingId === key.id}
                            title="Rotate Profile"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteKey(key.id)}
                            className="p-2.5 bg-zinc-50 dark:bg-zinc-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-sm transition-all shadow-sm"
                            title="Deactivate Profile"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "scans" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Scan Log</h2>
              <Link
                href="/analyze"
                className="text-[10px] font-black uppercase tracking-widest text-[var(--primary)] hover:opacity-70 transition-all border-b border-[var(--primary)] pb-0.5"
              >
                New Scan →
              </Link>
            </div>

            {scans.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-20 text-center">
                <History className="h-8 w-8 text-zinc-200 dark:text-zinc-800 mx-auto mb-4" />
                <p className="text-sm text-zinc-500 font-medium italic">Audit log is currently empty.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 dark:bg-black/20 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Identifier</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Timestamp</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-center">Trust Score (%)</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                    {scans.map((scan) => (
                      <tr key={scan.id} className="hover:bg-zinc-50/50 dark:hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4">
                          <code className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                            {scan.url.split('/').pop() || 'ID_UNKNOWN'}
                          </code>
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-500 font-mono">
                          {new Date(scan.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {scan.trust_score !== undefined ? (
                            <span className={`text-sm font-bold font-serif ${scan.trust_score >= 80 ? 'text-emerald- house' : scan.trust_score >= 60 ? 'text-amber-600' : 'text-rose-600'
                              }`.replace('emerald- house', 'emerald-600')}>
                              {scan.trust_score}
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase text-zinc-300 font-black tracking-tighter">In Progress</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => router.push(`/scans/${scan.id}`)}
                            className="p-2 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Purchase Modal */}
      {showPurchaseModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
          onClick={() => setShowPurchaseModal(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 w-full max-w-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8 space-y-8">
              <header>
                <h2 className="text-2xl font-bold font-serif text-zinc-900 dark:text-zinc-100">
                  {selectedKey ? "Replenish Credits" : "New Authorization"}
                </h2>
                <p className="text-sm text-zinc-500 mt-1 font-medium">
                  {selectedKey ? "Select credit amount to purchase." : "Configure your new API key."}
                </p>
              </header>

              {!selectedKey && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Key Name</label>
                    <input
                      type="text"
                      value={keyLabel}
                      onChange={(e) => setKeyLabel(e.target.value)}
                      placeholder="e.g., Production, Development"
                      className="w-full mt-2 px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-sm bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Model</label>
                    <div className="mt-2 grid grid-cols-3 gap-3">
                      {Object.entries(PRICING).map(([key, value]) => (
                        <button
                          key={key}
                          onClick={() => setPurchaseModel(key)}
                          className={`p-3 border rounded-sm text-left transition-all ${purchaseModel === key
                            ? "border-[var(--primary)] bg-[var(--primary)]/5"
                            : "border-zinc-100 dark:border-zinc-800 hover:border-zinc-300"
                            }`}
                        >
                          <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{value.name}</div>
                          <div className="text-[10px] text-zinc-400">${value.basePrice}/100</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Service Plan</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {CREDIT_PACKAGES.map((pkg) => (
                    <button
                      key={pkg.credits}
                      onClick={() => setPurchasePackage(pkg.credits)}
                      className={`p-4 border rounded-sm text-left transition-all ${purchasePackage === pkg.credits
                        ? "border-[var(--primary)] bg-[var(--primary)]/5"
                        : "border-zinc-100 dark:border-zinc-800 hover:border-zinc-300"
                        }`}
                    >
                      <div className="font-black text-[10px] uppercase tracking-widest text-zinc-400 mb-2">{pkg.discount * 100}% off</div>
                      <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">{pkg.credits}</div>
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Credits</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-zinc-900 rounded-sm flex items-center justify-between border border-zinc-800">
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">To pay</div>
                  <div className="text-zinc-100 font-bold text-sm">One-time provisioning</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-zinc-100 font-mono">${calculatePrice(purchasePackage, purchaseModel)}</div>

                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPurchaseModal(false)}
                  className="flex-1 px-4 py-3.5 border border-zinc-200 dark:border-zinc-800 rounded-sm text-xs font-black uppercase tracking-widest hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all font-medium"
                >
                  Discard
                </button>
                <button
                  onClick={handlePurchase}
                  className="flex-1 px-4 py-3.5 bg-[var(--primary)] text-white rounded-sm text-xs font-black uppercase tracking-[0.2em] hover:opacity-90 transition-all"
                >
                  Confirm & Pay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rotate Confirmation Modal */}
      <Dialog.Root open={showRotateModal} onOpenChange={setShowRotateModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl z-50">
            <div className="flex items-center justify-between mb-6">
              <Dialog.Title className="text-lg font-bold font-serif">Rotate API Key</Dialog.Title>
              <Dialog.Close className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-sm">
                <X className="h-5 w-5 text-zinc-500" />
              </Dialog.Close>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-sm">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Rotating this key will invalidate the current key immediately. Any integrations using the old key will stop working.
                </p>
              </div>

              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                A new key will be generated and shown to you after rotation. You can copy and update your integrations.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <Dialog.Close className="flex-1 px-4 py-3 border border-zinc-200 dark:border-zinc-700 rounded-sm text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all">
                Cancel
              </Dialog.Close>
              <button
                onClick={handleRotateKey}
                disabled={rotatingId !== null}
                className="flex-1 px-4 py-3 bg-[var(--primary)] text-white rounded-sm text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
              >
                {rotatingId ? "Rotating..." : "Rotate Key"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}