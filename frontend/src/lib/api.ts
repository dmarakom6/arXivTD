export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function getAuthHeaders(includeAuth = true) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (includeAuth) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return headers;
}

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  includeAuth = true
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      ...getAuthHeaders(includeAuth),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "An error occurred");
  }

  return response.json();
}

// Types
export interface User {
  id: string;
  email: string;
  stripe_customer_id?: string;
  created_at: string;
}

export interface APIKey {
  id: string;
  key?: string;
  label: string;
  is_active: boolean;
  credits_balance: number;
  model_tier: string;
  credit_package: number;
  last_used_at?: string;
  created_at: string;
}

export interface Scan {
  id: string;
  api_key_id: string;
  url: string;
  source_url?: string;
  model_used: string;
  credits_spent: number;
  trust_score?: number;
  result_json?: Record<string, unknown>;
  created_at: string;
}

export interface TrustScoreResponse {
  arxiv_id: string;
  title: string;
  authors: string[];
  published: string;
  trust_score: number;
  scan_mode: string;
  cached_at?: string;
  citations_validated?: {
    total: number;
    found: number;
    missing: number;
    hallucination_rate: number;
    api_calls: number;
  };
  code_provenance?: {
    total_snippets: number;
    matches: number;
    issues: number;
    license_issues: string[];
    repositories: Array<{
      repo: string;
      path: string;
      url: string;
      license: string;
      stars: number;
    }>;
  };
  ai_detection?: {
    probability: number;
    suspicious_segments: string[];
  };
  flags: Array<{
    type: string;
    severity: string;
    message: string;
    details?: Record<string, unknown>;
  }>;
  credits_spent: number;
  processing_time_ms: number;
  scan_id: string;
}

export interface GraphResponse {
  source: {
    id: string;
    title: string;
    year: number;
    citation_count: number;
  };
  nodes: Array<{
    id: string;
    title: string;
    year: number;
    citation_count: number;
    is_source: boolean;
    node_type?: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
  }>;
}

export interface CreditPurchaseResponse {
  api_key_id: string;
  credits: number;
  model_tier: string;
  amount: number;
  checkout_url: string;
}

// Auth API
export const authApi = {
  register: (email: string, password: string, turnstileToken?: string) =>
    fetchApi<{
      access_token: string | null;
      token_type: string;
      api_key: string | null;
      credits: number;
      totp_secret: string | null;
      totp_setup_qr: string | null;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, turnstile_token: turnstileToken }),
    }, false),

  login: (email: string, password: string) =>
    fetchApi<{
      access_token: string | null;
      token_type: string;
      require_totp: boolean;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }, false),

  verifyTOTP: (code: string) =>
    fetchApi<{ access_token: string; token_type: string }>("/auth/totp/verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  enableTOTP: (code: string) =>
    fetchApi<{ access_token: string; token_type: string }>("/auth/totp/enable", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
};

// User API
export const userApi = {
  getMe: () => fetchApi<User>("/user/me"),
};

// API Keys API
export const keysApi = {
  list: () => fetchApi<APIKey[]>("/keys"),
  create: (label: string, credits: number, model_tier: string) =>
    fetchApi<APIKey>("/keys", {
      method: "POST",
      body: JSON.stringify({ label, credit_package: credits, model_tier }),
    }),
  reveal: (keyId: string) =>
    fetchApi<APIKey>(`/keys/${keyId}/reveal`, { method: "GET" }),
  rotate: (keyId: string) =>
    fetchApi<APIKey>(`/keys/${keyId}/rotate`, { method: "POST" }),
  delete: async (keyId: string) => {
    const response = await fetch(`${API_URL}/keys/${keyId}`, {
      method: "DELETE",
      credentials: "include",
      headers: getAuthHeaders(true),
    });
    if (response.status === 204) {
      return;
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to delete key");
    }
    return response.json();
  },
};

// Credits API
export const creditsApi = {
  buy: (apiKeyId: string, packageSize: number, modelTier: string) =>
    fetchApi<CreditPurchaseResponse>("/credits/buy", {
      method: "POST",
      body: JSON.stringify({
        api_key_id: apiKeyId,
        package: packageSize.toString(),
        model_tier: modelTier,
      }),
    }),
};

// Scans API
export const scansApi = {
  list: () =>
    fetchApi<{ items: Scan[]; total: number }>("/scans"),
  get: (scanId: string) =>
    fetchApi<Scan>(`/scans/${scanId}`),
};

// Trust Score API
export const trustApi = {
  get: (arxivId: string, mode: string, apiKey: string = "") =>
    fetchApi<TrustScoreResponse>(`/trust/${arxivId}?mode=${mode}`, {
      method: "GET",
      headers: apiKey ? { "X-API-Key": apiKey } : {},
    }, true),
};

// Graph API
export const graphApi = {
  getByArxivId: (arxivId: string, apiKey: string) =>
    fetchApi<GraphResponse>(`/graph/${arxivId}`, {
      method: "GET",
      headers: { "X-API-Key": apiKey },
    }, false),
  getByPaperId: (paperId: string, apiKey: string) =>
    fetchApi<GraphResponse>(`/graph/id/${paperId}`, {
      method: "GET",
      headers: { "X-API-Key": apiKey },
    }, false),
};

// Local storage helpers
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function setUserEmail(email: string) {
  localStorage.setItem("userEmail", email);
}

export function getUserEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("userEmail");
}

export function clearToken() {
  localStorage.removeItem("token");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("apiKey");
}

export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("apiKey");
}

export function setApiKey(key: string) {
  localStorage.setItem("apiKey", key);
}

export function getPreferredApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("preferredApiKey");
}

export function setPreferredApiKey(key: string) {
  localStorage.setItem("preferredApiKey", key);
}