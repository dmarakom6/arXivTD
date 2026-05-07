"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Code, Link2 } from "lucide-react";
import { API_URL } from "@/lib/api";

const CODE_EXAMPLES = {
  python: `import requests

api_key = "your_api_key_here"
arxiv_id = "2310.12345"

response = requests.get(
    "https://arxivtd.com/api/v1/trust/2310.12345",
    headers={"X-API-Key": api_key}
)

data = response.json()
print(f"Trust Score: {data['trust_score']}")`,

  javascript: `const axios = require('axios');

const apiKey = 'your_api_key_here';
const arxivId = '2310.12345';

const response = await axios.get(
  \`https://arxivtd.com/api/v1/trust/\${arxivId}\`,
  { headers: { 'X-API-Key': apiKey } }
);

console.log('Trust Score:', response.data.trust_score);`,

  curl: `curl -X GET "https://arxivtd.com/api/v1/trust/2310.12345" \\
  -H "X-API-Key: your_api_key_here"`,
};

interface Endpoint {
  method: string;
  path: string;
  description: string;
  cost: string;
  params?: {
    name: string;
    type: string;
    optional?: boolean;
    description: string;
  }[];
  requestBody?: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/trust/{arxiv_id}",
    description: "Retrieve a comprehensive trust report for a specific arXiv identifier.",
    cost: "1 - 3 Credits",
    params: [
      { name: "mode", type: "string", optional: true, description: "basic (fast) or deep (thorough scan)" },
      // { name: "force", type: "boolean", optional: true, description: "bypass cache and re-scan" },
    ],
  },
  {
    method: "POST",
    path: "/trust/batch",
    description: "Submit multiple arXiv IDs for concurrent processing and trust scoring.",
    cost: "Varies by count",
    // requestBody: "{ \"ids\": [\"2310.12345\", ...], \"mode\": \"basic\" }",
  },
  {
    method: "GET",
    path: "/graph/{arxiv_id}",
    description: "Generate a multi-level citation graph with Semantic Scholar integration.",
    cost: "Free",
    params: [
      // { name: "depth", type: "number", optional: true, description: "Graph traversal depth (1-3)" },
    ],
  },
  {
    method: "GET",
    path: "/scans",
    description: "Retrieve a paginated list of all scans performed under your API key.",
    cost: "Free",
    params: [
      // { name: "limit", type: "number", optional: true, description: "Results per page (max 100)" },
    ],
  },
  {
    method: "GET",
    path: "/scans/{scan_id}",
    description: "Fetch detailed JSON analysis and full metadata for a completed scan.",
    cost: "Free",
  },
];

const primaryColor = "var(--primary)";

export default function DocumentationPage() {
  const [selectedLang, setSelectedLang] = useState<keyof typeof CODE_EXAMPLES>("python");

  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16"
      >
        <h1 className="text-5xl font-bold font-serif mb-4" style={{ color: primaryColor }}>API Documentation</h1>
        <p className="text-lg text-zinc-500 dark:text-zinc-400">
          Integrate ArXivTD trust scores into your applications
        </p>
      </motion.div>

      {/* Endpoints */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="mb-24"
      >
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
              <BookOpen className="h-6 w-6" style={{ color: primaryColor }} />
            </div>
            <div>
              <h2 className="text-3xl font-bold font-serif">Core Endpoints</h2>
              <p className="text-sm text-zinc-500">RESTful access to our analysis engine</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {ENDPOINTS.map((endpoint, i) => (
            <motion.div
              key={endpoint.path}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="group bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 hover:shadow-xl hover:shadow-[var(--primary)]/5 transition-all duration-300"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-4 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`px-4 py-1.5 rounded-lg text-xs font-black tracking-widest ${endpoint.method === "GET" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border border-emerald-100 dark:border-emerald-500/20" :
                      endpoint.method === "POST" ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 border border-indigo-100 dark:border-indigo-500/20" :
                        "bg-amber-50 dark:bg-amber-500/10 text-amber-600 border border-amber-100 dark:border-amber-500/20"
                      }`}>
                      {endpoint.method}
                    </span>
                    <code className="text-lg font-mono font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-[var(--primary)] transition-colors">
                      {endpoint.path}
                    </code>
                  </div>
                  <p className="text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                    {endpoint.description}
                  </p>
                </div>

                <div className="flex items-center gap-4 lg:border-l lg:pl-10 border-zinc-100 dark:border-zinc-800">
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-1">Cost</div>
                    <div className="text-sm font-bold font-mono" style={{ color: primaryColor }}>{endpoint.cost}</div>
                  </div>
                </div>
              </div>

              {(endpoint.params || endpoint.requestBody) && endpoint.params && endpoint.params.length > 0 && (
                <div className="mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-800/50 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-xs uppercase tracking-widest text-zinc-600 dark:text-zinc-400 font-black">Query Parameters</h4>
                    <ul className="space-y-3">
                      {endpoint.params.map((param) => (
                        <li key={param.name} className="flex gap-3 text-sm">
                          <code className="h-fit bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[var(--primary)] font-bold">{param.name}</code>
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase font-bold text-zinc-400">{param.type}{param.optional && " · optional"}</div>
                            <div className="text-zinc-500 dark:text-zinc-400 leading-relaxed">{param.description}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {endpoint.requestBody && (
                    <div className="space-y-4">
                      <h4 className="text-xs uppercase tracking-widest text-zinc-600 dark:text-zinc-400 font-black">Request Body</h4>
                      <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-100 dark:border-zinc-900 overflow-x-auto">
                        <pre className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                          <code>{endpoint.requestBody}</code>
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Code Examples with tabs */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-16"
      >
        <div className="flex items-center gap-2 mb-8">
          <Code className="h-6 w-6" style={{ color: primaryColor }} />
          <h2 className="text-2xl font-bold font-serif">Code Examples</h2>
        </div>

        <div className="bg-zinc-900 rounded-lg overflow-hidden">
          {/* macOS-style window controls */}
          <div className="flex items-center gap-2 px-4 py-3 bg-zinc-800 border-b border-zinc-700">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <div className="ml-4 flex gap-1">
              {(Object.keys(CODE_EXAMPLES) as Array<keyof typeof CODE_EXAMPLES>).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLang(lang)}
                  className={`px-3 py-1 text-sm rounded ${selectedLang === lang
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-white"
                    }`}
                >
                  {lang === "python" ? "Python" : lang === "javascript" ? "JavaScript" : "cURL"}
                </button>
              ))}
            </div>
          </div>

          {/* Code display */}
          <div className="p-4 overflow-x-auto">
            <pre className="text-sm text-zinc-300 whitespace-pre">
              <code>{CODE_EXAMPLES[selectedLang]}</code>
            </pre>
          </div>
        </div>
      </motion.section>

      {/* Swagger */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-8">
          <Link2 className="h-6 w-6" style={{ color: primaryColor }} />
          <h2 className="text-2xl font-bold font-serif">Interactive API</h2>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-lg border p-8 text-center">
          <p className="text-zinc-500 dark:text-zinc-400 mb-4">
            Try the API interactively with our Swagger documentation
          </p>
          <a
            href={API_URL.replace("/api/v1", "/docs")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-white px-6 py-2 rounded-sm"
            style={{ backgroundColor: primaryColor }}
          >
            Open Swagger UI
          </a>
        </div>
      </motion.section>
    </div>
  );
}