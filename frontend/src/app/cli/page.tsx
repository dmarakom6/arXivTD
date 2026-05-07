"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Terminal, Github, Package, Copy, Check, ChevronRight } from "lucide-react";

const COMMANDS = [
  {
    cmd: "init",
    usage: "arxivtd init",
    type: "Setup",
    description: "Configures your local environment with your API key.",
  },
  {
    cmd: "scan",
    usage: "arxivtd scan --id 2310.12345 --deep",
    type: "Audit",
    description: "Performs a deep scan on a specific arXiv identifier.",
  },
  {
    cmd: "pdf",
    usage: "arxivtd scan --pdf paper.pdf",
    type: "Local",
    description: "Analyzes a local PDF file using your local Grobid instance.",
  },
  {
    cmd: "batch",
    usage: "arxivtd batch ./papers/*.pdf",
    type: "Bulk",
    description: "Submits a directory of papers for concurrent batch processing.",
  },
  {
    cmd: "graph",
    usage: "arxivtd graph 2310.12345",
    type: "Visual",
    description: "Generates and returns the citation graph for a paper.",
  },
  {
    cmd: "status",
    usage: "arxivtd status",
    type: "System",
    description: "Retrieves current credit balance and consumption metrics.",
  },
];

const primaryColor = "var(--primary)";

export default function CLIPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopied(command);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-20"
      >
        {/* <div className="inline-block px-3 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-black uppercase tracking-[0.2em] mb-4">
          Terminal Interface
        </div> */}
        <h1 className="text-5xl font-bold font-serif mb-6" style={{ color: primaryColor }}>Command Line Utility</h1>
        <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          The ArXivTD CLI provides institutional-grade auditing tools directly in your terminal.
          Open source, lightweight, and built for bulk academic analysis.
        </p>
      </motion.div>

      {/* Primary Install */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-24"
      >
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/20">
          <div className="flex items-center gap-2 px-4 py-3 bg-zinc-800/50 border-b border-zinc-800">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            </div>
            {/* <div className="ml-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">zsh — pip3</div> */}
          </div>
          <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-zinc-800">
                <Terminal className="h-6 w-6 text-[var(--primary)]" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-black text-zinc-500 tracking-widest mb-1">Installation</div>
                <code className="text-xl font-mono text-white">pip install arxivtd</code>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleCopy("pip install arxivtd")}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold transition-all"
              >
                {copied === "pip install arxivtd" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy Command
              </button>
              <a
                href="https://github.com/dmarakom6/arxivTD"
                className="p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-all"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Command Reference */}
      <h2 className="text-2xl font-bold font-serif mb-10 border-b border-zinc-100 dark:border-zinc-800 pb-4 flex items-center gap-3">
        Reference Manual
        {/* <span className="text-xs font-normal text-zinc-400 font-sans tracking-normal">v1.4.2 — Institutional Build</span> */}
      </h2>

      <div className="grid grid-cols-1 gap-4 mb-24">
        {COMMANDS.map((item, i) => (
          <motion.div
            key={item.cmd}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="group flex flex-col md:flex-row md:items-center justify-between p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 hover:bg-white dark:hover:bg-zinc-900 hover:shadow-xl hover:shadow-[var(--primary)]/5 transition-all duration-300"
          >
            <div className="flex flex-col md:flex-row md:items-center gap-6 flex-1">
              <div className="flex items-center gap-3 md:w-48">
                {/* <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  {item.type}
                </span> */}
                <code className="text-sm font-bold text-[var(--primary)]">{item.cmd}</code>
              </div>

              <div className="space-y-1 pr-6 border-r-0 md:border-r border-zinc-100 dark:border-zinc-800">
                <div className="text-[10px] uppercase font-black text-zinc-400 tracking-tighter">Documentation</div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.description}</p>
              </div>

              <div className="flex-1 md:pl-6">
                <div className="text-[10px] uppercase font-black text-zinc-400 tracking-tighter mb-2">Usage Example</div>
                <code className="text-xs font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg block">
                  {item.usage}
                </code>
              </div>
            </div>

            <button
              onClick={() => handleCopy(item.usage)}
              className="mt-4 md:mt-0 md:ml-6 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:bg-[var(--primary)] transition-all group-hover:border-[var(--primary)]/20 text-zinc-400 hover:text-white"
            >
              {copied === item.usage ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4 transition-colors group-hover:text-[var(--primary)] group-hover:hover:text-white" />
              )}
            </button>
          </motion.div>
        ))}
      </div>

      {/* Integration Links */}
      <div className="grid md:grid-cols-2 gap-8">
        <a
          href="https://pypi.org/project/arxivtd/"
          className="flex items-center justify-between p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-[var(--primary)] transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 group-hover:bg-[var(--primary)]/10 transition-colors">
              <Package className="h-6 w-6 text-zinc-400 group-hover:text-[var(--primary)]" />
            </div>
            <div>
              <h4 className="font-bold">PyPI Registry</h4>
              <p className="text-xs text-zinc-500 mt-1">Package distribution and release notes.</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-300 group-hover:text-[var(--primary)] group-hover:translate-x-1 transition-all" />
        </a>

        <a
          href="https://github.com/dmarakom6/arxivTD"
          className="flex items-center justify-between p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-[var(--primary)] transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 group-hover:bg-[var(--primary)]/10 transition-colors">
              <Github className="h-6 w-6 text-zinc-400 group-hover:text-[var(--primary)]" />
            </div>
            <div>
              <h4 className="font-bold">Source Repository</h4>
              <p className="text-xs text-zinc-500 mt-1">Contribute to the open source core.</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-300 group-hover:text-[var(--primary)] group-hover:translate-x-1 transition-all" />
        </a>
      </div>

      <div className="mt-20 text-center">
        <p className="text-xs text-zinc-400 font-mono italic">
          ArXivTD CLI is licensed under GPL v3. System requirements: Python 3.11+, Internet connectivity for API verification.
        </p>
      </div>
    </div>
  );
}