"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, Zap, Code, Network, Shield, Heart, X } from "lucide-react";

const BACKEND_PRICING = {
  gemini_flash: 12,
  claude_sonnet: 20,
  claude_opus: 36,
};

const CREDIT_TIERS = [
  { value: 100, label: "100", discount: 1.0 },
  { value: 500, label: "500", discount: 0.9 },
  { value: 1000, label: "1,000", discount: 0.85 },
];

const MODELS = [
  {
    id: "gemini_flash",
    name: "Gemini Flash",
    strength: "Optimized for speed and bulk verification. Ideal for high-throughput screening where latency is the primary constraint.",
    basePrice: BACKEND_PRICING.gemini_flash,
  },
  {
    id: "claude_sonnet",
    name: "Claude 4.6 Sonnet",
    strength: "The industry standard for academic reasoning. Delivers balanced, high-fidelity analysis for comprehensive paper reviews.",
    basePrice: BACKEND_PRICING.claude_sonnet,
  },
  {
    id: "claude_opus",
    name: "Claude 4.7 Opus",
    strength: "Peak intelligence for critical evaluation. Exhaustive reasoning capabilities for the most complex institutional research.",
    basePrice: BACKEND_PRICING.claude_opus,
  },
];

const primaryColor = "var(--primary)";

export default function PricingPage() {
  const [selectedCredits, setSelectedCredits] = useState(500);

  const getDiscount = (credits: number) => {
    if (credits === 1000) return 0.85;
    if (credits === 500) return 0.9;
    return 1.0;
  };

  const calculatePrice = (basePer100: number) => {
    const discount = getDiscount(selectedCredits);
    return ((basePer100 * (selectedCredits / 100)) * discount).toFixed(2);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-24">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-20"
      >
        <h1 className="text-5xl font-bold font-serif mb-6" style={{ color: primaryColor }}>Model Infrastructure</h1>
        <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-3xl mx-auto leading-relaxed">
          Select your required capacity and choose the underlying engine that powers your analysis.
          <span className="block mt-2 font-medium">30% of all infrastructure revenue is donated to the arXiv foundation.</span>
        </p>
      </motion.div>

      {/* Credit Picker */}
      <div className="mb-20 max-w-2xl mx-auto">
        <div className="flex flex-col items-center gap-8">
          <div className="text-xs uppercase tracking-[0.3em] font-black text-zinc-400">Fixed Credit Packages</div>
          <div className="flex flex-wrap justify-center gap-6 w-full">
            {CREDIT_TIERS.map((tier) => (
              <button
                key={tier.value}
                onClick={() => setSelectedCredits(tier.value)}
                className={`flex-1 min-w-[140px] relative px-8 py-6 rounded-2xl border transition-all duration-300 ${selectedCredits === tier.value
                  ? "border-[var(--primary)] bg-[var(--primary)]/5 ring-4 ring-[var(--primary)]/10"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/50"
                  }`}
              >
                <div className={`text-3xl font-bold font-serif ${selectedCredits === tier.value ? "text-[var(--primary)]" : "text-zinc-600 dark:text-zinc-400"}`}>
                  {tier.label}
                </div>
                <div className="text-[10px] uppercase font-black tracking-widest text-zinc-400 mt-1">Credits</div>
                {tier.discount < 1 && (
                  <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-black uppercase rounded shadow-lg">
                    -{Math.round((1 - tier.discount) * 100)}%
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="text-xs text-zinc-400 italic">
            Prices below are updated based on the selected package.
          </div>
        </div>
      </div>

      {/* Models Grid */}
      <div className="grid md:grid-cols-3 gap-8">
        {MODELS.map((model, i) => (
          <motion.div
            key={model.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group flex flex-col p-10 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:shadow-2xl hover:shadow-[var(--primary)]/5 transition-all duration-500"
          >
            <div className="mb-10 min-h-[5rem]">
              <h3 className="text-2xl font-bold mb-4">{model.name}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed italic">
                "{model.strength}"
              </p>
            </div>

            <div className="mt-auto pt-10 border-t border-zinc-100 dark:border-zinc-800">
              <div className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-2">Investment</div>
              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-4xl font-bold font-serif" style={{ color: primaryColor }}>
                  ${calculatePrice(model.basePrice)}
                </span>
                <span className="text-sm text-zinc-400">total</span>
              </div>

              <div className="space-y-3 mb-10">
                <div className="flex justify-between text-[11px] text-zinc-500">
                  <span>Unit Price</span>
                  <span className="font-mono">${(model.basePrice / 100).toFixed(2)} / credit</span>
                </div>
                <div className="flex justify-between text-[11px] text-zinc-600 dark:text-zinc-400 font-bold">
                  <span>Total Scans</span>
                  <span>{Math.floor(selectedCredits / 3)} Deep | {selectedCredits} Basic</span>
                </div>
              </div>

              <button
                className="w-full cursor-pointer flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 group-hover:bg-[var(--primary)] group-hover:text-white transition-all duration-300 shadow-lg shadow-zinc-200 dark:shadow-none"
              >
                Purchase Credits
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Comparison Table */}
      <section id="features" className="mt-32 pt-24 border-t border-zinc-100 dark:border-zinc-800">
        <div className="text-center mb-16">
          <h2 className="text-sm font-black uppercase tracking-[0.4em] text-zinc-400 mb-4">Features</h2>
          <p className="text-3xl font-bold font-serif text-zinc-900 dark:text-zinc-100">What You Get</p>
        </div>

        <div className="overflow-hidden border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900/50 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900">
                  <th className="p-6 text-xs font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">Audit Capability</th>
                  <th className="p-6 text-center text-xs font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-800/30">Basic Scan</th>
                  <th className="p-6 text-center text-xs font-black uppercase tracking-widest text-[var(--primary)] border-b border-zinc-200 dark:border-zinc-800 bg-[var(--primary)]/5">Deep Scan</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="p-6">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">Citation Validation</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-tight">Check if citations are real</div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex justify-center text-[var(--primary)] font-bold gap-2">
                      <Check className="h-4 w-4" />
                    </div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex justify-center text-[var(--primary)] font-bold gap-2">
                      <Check className="h-4 w-4" />
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="p-6">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">Stale References</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-tight">Flag papers if references are too old</div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex justify-center text-[var(--primary)] font-bold gap-2">
                      <Check className="h-4 w-4" />
                    </div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex justify-center text-[var(--primary)] font-bold gap-2">
                      <Check className="h-4 w-4" />
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="p-6">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">Citation Graph</div>
                    <div className="text-[10px] text-[var(--primary)] uppercase tracking-tight font-black">Sonnet / Opus Required*</div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex justify-center"><X className="h-4 w-4 text-zinc-300" /></div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex justify-center text-[var(--primary)] font-bold gap-2">
                      <Check className="h-4 w-4" />
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="p-6">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">Code Provenance</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-tight">Repository structural matching</div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex justify-center"><X className="h-4 w-4 text-zinc-300" /></div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex justify-center text-[var(--primary)] font-bold gap-2">
                      <Check className="h-4 w-4" />
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="p-6">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">AI Detection</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-tight">Detect AI-generated content</div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex justify-center"><X className="h-4 w-4 text-zinc-300" /></div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex justify-center text-[var(--primary)] font-bold gap-2">
                      <Check className="h-4 w-4" />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="p-6">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">Data Retention</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-tight">Privacy and security tier</div>
                  </td>
                  <td className="p-6 text-center text-zinc-600 dark:text-zinc-400 font-bold">30-Day Retention</td>
                  <td className="p-6 text-center text-zinc-900 dark:text-zinc-100 font-bold">30-Day Retention</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        {/* 
        <div className="mt-8 p-6 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="flex gap-4 items-start">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded text-amber-600 dark:text-amber-400">
              <Shield className="h-4 w-4" />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed italic">
              * <span className="font-bold text-zinc-900 dark:text-zinc-100">Model Limitation Note:</span> Citation Integrity validation requires high-fidelity reasoning. This module is automatically bypassed when using Gemini Flash. For full citation audits, please ensure you have selected Claude 3.5 Sonnet or Claude 3 Opus.
            </p>
          </div>
        </div> */}
      </section>
    </div>
  );
}