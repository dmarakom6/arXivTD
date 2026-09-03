"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getToken, scansApi, GraphResponse, similarApi } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, GitBranch, Clock, AlertTriangle,
  CheckCircle, XCircle, Download, ExternalLink, Loader2, Network, Copy,
  Brain, Shield, User, Cpu, Code, MousePointerClick, GitCommit
} from "lucide-react";
import { CitationGraph } from "@/components/CitationGraph";

interface ScanResult {
  id: string;
  url: string;
  trust_score: number;
  credits_spent: number;
  model_used?: string;
  result_json?: {
    arxiv_id: string;
    title: string;
    authors: string[];
    published: string;
    scan_mode: string;
    citations_validated?: {
      total: number;
      found: number;
      missing: number;
      hallucination_rate: number;
    };
    code_provenance?: {
      total_snippets: number;
      matches: number;
      issues: number;
      repositories: Array<{
        repo: string;
        path: string;
        url: string;
        license: string;
        stars: number;
        details?: string;
      }>;
    };
    ai_detection?: {
      probability: number;
      suspicious_segments?: string[];
    };
    citation_patterns?: {
      total_citations: number;
      self_citation_rate: number;
      clustering_score: number;
      temporal_anomaly_score: number;
      top_citing_authors: Array<{
        author: string;
        count: number;
        rate: number;
      }>;
      reciprocal_pairs: Array<[string, string]>;
    };
    version_changes?: {
      total_versions: number;
      has_title_changes: boolean;
      has_author_changes: boolean;
      has_content_removal: boolean;
      changes: Array<{
        field: string;
        from_version: number;
        to_version: number;
        description: string;
        severity: string;
      }>;
    };
    flags: Array<{
      type: string;
      severity: string;
      message: string;
    }>;
    processing_time_ms: number;
  };
  created_at: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-700 dark:text-emerald-500";
  if (score >= 60) return "text-amber-700 dark:text-amber-500";
  return "text-rose-700 dark:text-rose-500";
}


function getAIDescription(probability: number): string {
  if (probability >= 0.7) return "Text is likely AI-generated";
  if (probability >= 0.4) return "Text may contain AI-generated content";
  if (probability >= 0.2) return "Text possibly contains AI assistance";
  return "Text appears to be human-written";
}

function isClaudeModel(model?: string): boolean | undefined {
  return model?.toLowerCase().includes("claude");
}

export default function ScanPage() {
  const router = useRouter();
  const params = useParams();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<any | null>(null);
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState("");
  const [graphAttempted, setGraphAttempted] = useState(false);
  const graphRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [relatedPapers, setRelatedPapers] = useState<Array<{ title: string; arxiv_id: string; authors: string[] }>>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  const loadGraph = useCallback(async () => {
    const arxivId = scan?.result_json?.arxiv_id;
    if (!arxivId) {
      setGraphError("No paper identifier available for this scan.");
      setGraphLoading(false);
      return;
    }
    setGraphLoading(true);
    setGraphError("");
    setGraphAttempted(true);
    try {
      const { keysApi, graphApi } = await import("@/lib/api");
      const keys = await keysApi.list();
      if (keys.length === 0) {
        setGraphError("No API keys available. Please add a key in your dashboard.");
        setGraphLoading(false);
        return;
      }
      const revealedKey = await keysApi.reveal(keys[0].id);
      if (!revealedKey.key) {
        setGraphError("Could not retrieve API key. Please try again.");
        setGraphLoading(false);
        return;
      }
      const data = await graphApi.getByArxivId(arxivId, revealedKey.key);
      if (!data || !data.nodes || data.nodes.length === 0) {
        setGraphError("No citation data found for this paper.");
        setGraphLoading(false);
        return;
      }
      setGraphData(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load citation graph";
      setGraphError(message.includes("429") ? "Rate limited by citation service. Please wait and retry." : message);
    } finally {
      setGraphLoading(false);
    }
  }, [scan?.result_json?.arxiv_id]);

  // Auto-retry once when the citation service rate-limits the graph request
  useEffect(() => {
    if (!graphError.toLowerCase().includes("rate limited")) return;
    const timer = setTimeout(() => {
      setGraphError("");
      loadGraph();
    }, 6000);
    return () => clearTimeout(timer);
  }, [graphError, loadGraph]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openRepoModal = (repo: any) => {
    setSelectedRepo(repo);
    setShowRepoModal(true);
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    const scanId = params.id as string;
    scansApi.get(scanId)
      .then((data) => {
        setScan({
          ...data,
          trust_score: data.trust_score ?? 0,
          result_json: data.result_json as ScanResult["result_json"]
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  // Fetch related papers after scan loads
  useEffect(() => {
    if (!scan?.result_json?.arxiv_id) return;
    const arxivId = scan.result_json.arxiv_id;
    setRelatedLoading(true);
    similarApi.get(arxivId)
      .then((data) => setRelatedPapers(data.papers || []))
      .catch(() => setRelatedPapers([]))
      .finally(() => setRelatedLoading(false));
  }, [scan?.result_json?.arxiv_id]);

  const handleExport = () => {
    if (!scan?.result_json) return;
    const blob = new Blob([JSON.stringify(scan.result_json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scan-${scan.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const primaryColor = "var(--primary)";

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Scan Not Found</h1>
        <p className="text-zinc-500 mb-4">{error || "This scan may have been deleted."}</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="hover:underline"
          style={{ color: primaryColor }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const result = scan.result_json;
  if (!result) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-zinc-500">Scan data not available.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="hover:underline mt-4"
          style={{ color: primaryColor }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <button
        onClick={() => router.push("/dashboard")}
        className="text-sm text-zinc-500 mb-8 hover:text-zinc-800 transition-colors"
      >
        ← Back to Dashboard
      </button>

      {/* Header Section */}
      <div className="mb-12 border-b pb-8">
        <div className="flex justify-between items-start gap-8">
          <div className="flex-1">
            <h1 className="text-3xl font-bold font-serif mb-2 text-zinc-900 dark:text-zinc-100">{result.title}</h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-4">
              {result.authors?.join(", ")}
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">
              {result.arxiv_id && <span className="flex items-center gap-1.5"><Search className="h-3 w-3" /> {result.arxiv_id}</span>}
              <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {result.published}</span>
              {scan.model_used && <span className="flex items-center gap-1.5"><Brain className="h-3 w-3" /> {scan.model_used}</span>}
              <span className="flex items-center gap-1.5 text-[var(--primary)]">{result.scan_mode} Scan</span>
            </div>
          </div>
          <div className="text-right border-l pl-8 shrink-0">
            <div className={`text-7xl font-bold font-serif leading-none ${getScoreColor(scan.trust_score)}`}>
              {scan.trust_score}
            </div>
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 mt-2">Trust Score</div>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap gap-3 mt-8">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 border border-zinc-200 dark:border-zinc-800 px-4 py-1.5 rounded-sm text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <Download className="h-4 w-4" /> Export Report
          </button>
          <a
            href={scan.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-zinc-200 dark:border-zinc-800 px-4 py-1.5 rounded-sm text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <ExternalLink className="h-4 w-4" /> View on arXiv
          </a>
        </div>
      </div>

      {/* Main Analysis Results */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Citations Card - Adapts to Mode */}
        <div className={`${result.scan_mode === 'deep' ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold font-serif text-zinc-900 dark:text-zinc-100">
              {result.scan_mode === 'deep' ? 'Citation Integrity' : 'Citation Validation'}
            </h3>
            {result.citations_validated && (
              <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
                {result.citations_validated.total} Total Citations Identified
              </div>
            )}
          </div>

          {result.citations_validated ? (
            <div className="space-y-8">
              <div className={`grid ${result.scan_mode === 'deep' ? 'grid-cols-3' : 'grid-cols-3 md:gap-8'} gap-4`}>
                <div className={`p-4 border border-zinc-100 dark:border-zinc-800 rounded-sm ${result.scan_mode === 'basic' ? 'bg-zinc-50/50 dark:bg-white/5' : ''}`}>
                  <div className={`${result.scan_mode === 'basic' ? 'text-3xl' : 'text-2xl'} font-bold text-emerald-600 mb-0.5`}>{result.citations_validated.found}</div>
                  <div className="text-[11px] uppercase font-black tracking-widest text-zinc-500 leading-none">Verified Assets</div>
                </div>
                <div className={`p-4 border border-zinc-100 dark:border-zinc-800 rounded-sm ${result.scan_mode === 'basic' ? 'bg-zinc-50/50 dark:bg-white/5' : ''}`}>
                  <div className={`${result.scan_mode === 'basic' ? 'text-3xl' : 'text-2xl'} font-bold text-rose-600 mb-0.5`}>{result.citations_validated.missing}</div>
                  <div className="text-[11px] uppercase font-black tracking-widest text-zinc-500 leading-none">Missing/Invalid</div>
                </div>
                <div className={`p-4 border border-zinc-100 dark:border-zinc-800 rounded-sm ${result.scan_mode === 'basic' ? 'bg-zinc-50/50 dark:bg-white/5' : ''}`}>
                  <div className={`${result.scan_mode === 'basic' ? 'text-3xl' : 'text-2xl'} font-bold ${result.citations_validated.hallucination_rate < 0.1 ? "text-emerald-600" : "text-amber-600"} mb-0.5`}>
                    {(result.citations_validated.hallucination_rate * 100).toFixed(1)}%
                  </div>
                  <div className="text-[11px] uppercase font-black tracking-widest text-zinc-500 leading-none">Anomaly Rate</div>
                </div>
              </div>

              <div className={`grid ${result.scan_mode === 'deep' ? 'grid-cols-1' : 'md:grid-cols-2'} gap-6 items-start pt-2`}>
                <div className="space-y-3">
                  <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Analysis Summary</h4>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium italic max-w-2xl">
                    {result.citations_validated.missing === 0
                      ? "A comprehensive audit confirms all cited references are verifiable within recognized scholarly repositories. No evidence of citation hallucination was found."
                      : `The audit identified ${result.citations_validated.missing} citations that could not be cross-referenced with external databases. This discrepancy indicates potential reference hallucination or reliance on non-indexed legacy materials.`
                    }
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-white/5">
              <AlertTriangle className="h-8 w-8 text-zinc-300 mb-3" />
              <p className="text-sm text-zinc-500 font-medium italic">Verification data unavailable for this profile tier.</p>
            </div>
          )}
        </div>

        {/* AI Detection Card - Deep Only */}
        {result.scan_mode === 'deep' && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold font-serif text-zinc-900 dark:text-zinc-100">AI Origin Probability</h3>
              <div className="text-[11px] font-black uppercase tracking-widest text-zinc-400 opacity-0 select-none">
                Control
              </div>
            </div>

            {result.ai_detection ? (
              <div className="flex flex-col items-center pt-4">
                {/* Circular Gauge */}
                <div className="relative h-28 w-28 mb-4">
                  <svg className="h-full w-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-zinc-100 dark:text-zinc-800"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={264}
                      strokeDashoffset={264 - (result.ai_detection.probability * 264)}
                      strokeLinecap="round"
                      className={`transition-all duration-1000 ease-out ${result.ai_detection.probability > 0.6 ? 'text-rose-500' :
                        result.ai_detection.probability > 0.3 ? 'text-amber-500' : 'text-emerald-500'
                        }`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold font-serif leading-none">
                      {(result.ai_detection.probability * 100).toFixed(0)}
                      <span className="text-xs ml-0.5">%</span>
                    </span>
                  </div>
                </div>

                <p className="text-sm text-zinc-500 font-medium italic">
                  {getAIDescription(result.ai_detection.probability)}
                </p>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-white/5 h-full">
                <Cpu className="h-8 w-8 text-zinc-300 mb-3" />
                <p className="text-sm text-zinc-500 font-medium italic text-center px-4">
                  Neural analysis requires an institutional profile.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Citation Patterns - Deep Only */}
      {result.scan_mode === 'deep' && result.citation_patterns && (
        <div className="mt-8 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold font-serif text-zinc-900 dark:text-zinc-100">Citation Patterns</h3>
            <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
              {result.citation_patterns.total_citations} Total Citations
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 border border-zinc-100 dark:border-zinc-800 rounded-sm">
              <div className={`text-2xl font-bold mb-0.5 ${result.citation_patterns.self_citation_rate < 0.15 ? "text-emerald-600" : result.citation_patterns.self_citation_rate < 0.3 ? "text-amber-600" : "text-rose-600"}`}>
                {(result.citation_patterns.self_citation_rate * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] uppercase font-black tracking-widest text-zinc-500 leading-none">Self-Citation Rate</div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5 leading-snug">How often authors cite their own work. Rates above 15% may indicate circular referencing or citation manipulation.</div>
            </div>
            <div className="p-4 border border-zinc-100 dark:border-zinc-800 rounded-sm">
              <div className={`text-2xl font-bold mb-0.5 ${result.citation_patterns.clustering_score < 0.3 ? "text-emerald-600" : result.citation_patterns.clustering_score < 0.6 ? "text-amber-600" : "text-rose-600"}`}>
                {result.citation_patterns.clustering_score.toFixed(2)}
              </div>
              <div className="text-[11px] uppercase font-black tracking-widest text-zinc-500 leading-none">Clustering Score</div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5 leading-snug">Herfindahl index measuring citation concentration. High scores mean citations come from a small, tight group — potential citation ring indicator.</div>
            </div>
            <div className="p-4 border border-zinc-100 dark:border-zinc-800 rounded-sm">
              <div className={`text-2xl font-bold mb-0.5 ${result.citation_patterns.temporal_anomaly_score < 0.3 ? "text-emerald-600" : result.citation_patterns.temporal_anomaly_score < 0.6 ? "text-amber-600" : "text-rose-600"}`}>
                {result.citation_patterns.temporal_anomaly_score.toFixed(2)}
              </div>
              <div className="text-[11px] uppercase font-black tracking-widest text-zinc-500 leading-none">Temporal Anomaly</div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5 leading-snug">Detects unusual bursts of citations in a short time window. Spikes may suggest coordinated or inauthentic citation activity.</div>
            </div>
          </div>

          {result.citation_patterns.top_citing_authors && result.citation_patterns.top_citing_authors.length > 0 && (
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-3">Top Citing Authors</h4>
              <div className="space-y-2">
                {result.citation_patterns.top_citing_authors.filter(a => a.rate > 0.05).slice(0, 5).map((author, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 border border-zinc-100 dark:border-zinc-800 rounded-sm">
                    <span className="text-sm text-zinc-800 dark:text-zinc-200 font-medium">{author.author}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-zinc-500">{author.count} citations</span>
                      <span className="text-xs font-mono text-zinc-500">{(author.rate * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.citation_patterns.reciprocal_pairs && result.citation_patterns.reciprocal_pairs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">Reciprocal Citation Pairs</h4>
              <div className="flex flex-wrap gap-2">
                {result.citation_patterns.reciprocal_pairs.slice(0, 5).map((pair, idx) => (
                  <span key={idx} className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded">
                    {pair[0]} ↔ {pair[1]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Version History - Deep Only */}
      {result.scan_mode === 'deep' && result.version_changes && (
        <div className="mt-8 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold font-serif text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <GitCommit className="h-5 w-5 text-zinc-400" />
              Version History
            </h3>
            <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
              {result.version_changes.total_versions} Versions
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {result.version_changes.has_title_changes && (
              <span className="text-[11px] font-bold px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">Title Changed</span>
            )}
            {result.version_changes.has_author_changes && (
              <span className="text-[11px] font-bold px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">Authors Changed</span>
            )}
            {result.version_changes.has_content_removal && (
              <span className="text-[11px] font-bold px-2.5 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded">Content Removed</span>
            )}
            {!result.version_changes.has_title_changes && !result.version_changes.has_author_changes && !result.version_changes.has_content_removal && (
              <span className="text-[11px] font-bold px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded">No Destructive Changes</span>
            )}
          </div>

          {result.version_changes.changes && result.version_changes.changes.length > 0 ? (
            <div className="space-y-2">
              {result.version_changes.changes.map((change, idx) => (
                <div key={idx} className="p-4 border border-zinc-100 dark:border-zinc-800 rounded flex items-start gap-3">
                  <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${change.severity === "high" ? "bg-rose-600" : change.severity === "medium" ? "bg-amber-600" : "bg-zinc-400"}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-black uppercase text-zinc-500 tracking-widest">{change.field}</div>
                      <div className="text-[11px] font-mono text-zinc-500">v{change.from_version} → v{change.to_version}</div>
                    </div>
                    <div className="text-sm text-zinc-700 dark:text-zinc-300 mt-1 leading-relaxed">{change.description}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-white/5">
              <CheckCircle className="h-8 w-8 text-emerald-400 mb-3" />
              <p className="text-sm text-zinc-500 font-medium italic">No tracked changes across versions.</p>
            </div>
          )}
        </div>
      )}

      {/* Code Provenance Section - Deep Only */}
      {result.scan_mode === 'deep' && (
        <div className="mt-8 bg-zinc-50/50 dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold font-serif text-zinc-900 dark:text-zinc-100">Code Provenance</h3>
            {result.code_provenance && result.code_provenance.repositories.length > 0 && (
              <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
                {result.code_provenance.repositories.length} Verified Repositories
              </div>
            )}
          </div>

          {result.code_provenance && result.code_provenance.repositories.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
              {result.code_provenance.repositories.map((repo, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-zinc-900 p-5 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer group shadow-sm"
                  onClick={() => openRepoModal(repo)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-bold text-sm truncate text-zinc-900 dark:text-zinc-100 group-hover:text-[var(--primary)] transition-colors">{repo.repo}</div>
                    <ExternalLink className="h-3 w-3 text-zinc-300 group-hover:text-zinc-900" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded uppercase">
                      {repo.license}
                    </span>
                    <span className="text-[11px] font-bold text-zinc-500">★ {repo.stars}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : result.code_provenance ? (
            <div className="py-12 flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-white/5">
              <Code className="h-10 w-10 text-zinc-300 mb-3" />
              <p className="text-sm text-zinc-500 font-medium italic">No snippets found.</p>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-white/5 text-center">
              <Shield className="h-10 w-10 text-zinc-300 mb-3" />
              <p className="text-sm text-zinc-500 font-medium italic max-w-xs">
                Repository matching is restricted to deeper institutional analysis profiles.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Flags & Metadata */}
      <div className="mt-8 grid md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold font-serif text-zinc-900 dark:text-zinc-100">System Alerts</h3>
            <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
              {result.flags?.length || 0} Alert{result.flags?.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="space-y-2">
            {result.flags && result.flags.length > 0 ? (
              result.flags.map((flag, idx) => (
                <div key={idx} className="p-4 border border-zinc-200 dark:border-zinc-800 rounded flex gap-4 bg-white dark:bg-zinc-900">
                  <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${flag.severity === "high" ? "bg-rose-600" : "bg-amber-600"}`} />
                  <div>
                    <div className="text-[11px] font-black uppercase text-zinc-500 tracking-widest mb-1">{flag.type}</div>
                    <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed">{flag.message}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-sm text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Comprehensive validation complete. No critical alerts.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-lg flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold font-serif text-zinc-900 dark:text-zinc-100">Audit Metadata</h3>
              <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
                System Registry
              </div>
            </div>
            <div className="space-y-4 text-xs font-bold font-mono">
              <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <span className="text-zinc-500 dark:text-zinc-400 uppercase">Process Time</span>
                <span className="text-zinc-900 dark:text-zinc-100">{(result.processing_time_ms / 1000).toFixed(2)}s</span>
              </div>
              <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <span className="text-zinc-500 dark:text-zinc-400 uppercase">Consumption</span>
                <span className="text-zinc-900 dark:text-zinc-100">{scan.credits_spent} credits</span>
              </div>
              <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 pb-0">
                <span className="text-zinc-500 dark:text-zinc-400 uppercase">Scan ID</span>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 dark:text-zinc-400 truncate max-w-[120px]">{scan.id}</span>
                  <button
                    onClick={() => copyToClipboard(scan.id)}
                    className="text-zinc-500 hover:text-[var(--primary)] transition-colors"
                    title="Copy ID"
                  >
                    {copied ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Citation Graph - Clean Toggle - Claude Only */}
      {isClaudeModel(scan.model_used) && result.scan_mode === 'deep' && (
        <div className="mt-16 border-t pt-12" ref={graphRef}>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">Structural Context</h3>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-[var(--primary)] text-white rounded uppercase tracking-widest">Interactive Graph</span>
            </div>
            {!graphData && !graphLoading && (
              <button
                onClick={loadGraph}
                className="text-xs font-bold uppercase tracking-widest border border-zinc-300 dark:border-zinc-700 px-4 py-1.5 rounded-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Load Citation Relations
              </button>
            )}
            {graphData && (
              <div className="hidden md:flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-500">
                <MousePointerClick className="h-3 w-3 text-[var(--primary)]" />
                <span>Click nodes to expand the graph</span>
              </div>
            )}
          </div>

          {graphLoading ? (
            <div className="h-[400px] flex items-center justify-center border rounded-lg bg-zinc-50 dark:bg-zinc-900 border-dashed">
              <div className="text-sm text-zinc-500 font-medium">Reconstructing Graph Topology...</div>
            </div>
          ) : graphError ? (
            <div className="p-6 border rounded-lg bg-rose-50 dark:bg-rose-950/20">
              <div className="text-rose-600 text-sm mb-3">{graphError}</div>
              <button
                onClick={() => {
                  setGraphError("");
                  loadGraph();
                }}
                className="text-xs font-bold uppercase tracking-widest border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 px-4 py-1.5 rounded-sm hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : graphData ? (
            <CitationGraph data={graphData} primaryColor={primaryColor} scannedPaperTitle={result.title} />
          ) : (
            <div className="h-32 flex items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-white/5">
              <p className="text-sm text-zinc-500 font-medium">Graph visualization available for deep research profiles.</p>
            </div>
          )}
        </div>
      )}

      {/* Related Papers Section */}
      {(relatedPapers.length > 0 || relatedLoading) && (
        <div className="mt-16 border-t pt-12">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold font-serif text-zinc-900 dark:text-zinc-100">Related Papers</h3>
            <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
              {relatedPapers.length} Found
            </div>
          </div>

          {relatedLoading ? (
            <div className="grid md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-lg animate-pulse">
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4 mb-3" />
                  <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {relatedPapers.map((paper) => (
                <a
                  key={paper.arxiv_id}
                  href={`https://arxiv.org/abs/${paper.arxiv_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-5 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group shadow-sm"
                >
                  <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-[var(--primary)] transition-colors line-clamp-2 mb-2">
                    {paper.title}
                  </div>
                  <div className="text-xs text-zinc-500 mb-2 line-clamp-1">
                    {paper.authors?.join(", ")}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-zinc-500">{paper.arxiv_id}</span>
                    <ExternalLink className="h-3 w-3 text-zinc-400 group-hover:text-zinc-600 shrink-0" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Repository Modal */}
      <AnimatePresence>
        {showRepoModal && selectedRepo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
            onClick={() => setShowRepoModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-8">
                <GitBranch className="h-5 w-5 text-zinc-400" />
                <h3 className="text-xl font-bold font-serif">Repository Asset</h3>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-1">Name</div>
                  <a
                    href={selectedRepo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg font-bold hover:underline break-all"
                    style={{ color: primaryColor }}
                  >
                    {selectedRepo.repo}
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-8 py-6 border-y border-zinc-100 dark:border-zinc-800">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-1">License</div>
                    <div className="font-bold text-sm">{selectedRepo.license}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-1">Stars</div>
                    <div className="font-bold text-sm">★ {selectedRepo.stars}</div>
                  </div>
                </div>

                {selectedRepo.path && (
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-1">Internal Path</div>
                    <div className="font-mono text-xs bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded border border-zinc-100 dark:border-zinc-800 break-all leading-relaxed">
                      {selectedRepo.path}
                    </div>
                  </div>
                )}

                {selectedRepo.details && (
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-1">Provenance Notes</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed italic">
                      "{selectedRepo.details}"
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowRepoModal(false)}
                className="mt-10 w-full py-3 border border-zinc-200 dark:border-zinc-800 rounded-sm text-sm font-bold uppercase tracking-widest hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Close Asset Details
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
