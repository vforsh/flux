import { sleep } from "../util/time.ts";

export type AsyncTaskResponse = {
  id: string;
  polling_url: string;
  // Some endpoints include these fields (cost, mp, etc). Keep them optional.
  cost?: number;
  input_cost?: number;
  input_mp?: number;
  output_mp?: number;
};

export type GetResultResponse = {
  id: string;
  status: string;
  result?: {
    sample?: string; // signed delivery URL
    [k: string]: unknown;
  };
  progress?: number;
  details?: unknown;
  [k: string]: unknown;
};

export type CreditsResponse = {
  credits?: number;
  // Docs don't guarantee schema; keep loose.
  [k: string]: unknown;
};

export class HttpError extends Error {
  status: number;
  url: string;
  body?: unknown;

  constructor(message: string, opts: { status: number; url: string; body?: unknown }) {
    super(message);
    this.name = "HttpError";
    this.status = opts.status;
    this.url = opts.url;
    this.body = opts.body;
  }
}

export type BflClientOptions = {
  apiKey: string;
  endpointHost: string; // api.bfl.ai
  timeoutMs: number;
  retries: number;
  userAgent?: string;
};

export class BflClient {
  #apiKey: string;
  #endpointHost: string;
  #timeoutMs: number;
  #retries: number;
  #userAgent?: string;

  constructor(opts: BflClientOptions) {
    this.#apiKey = opts.apiKey;
    this.#endpointHost = opts.endpointHost;
    this.#timeoutMs = opts.timeoutMs;
    this.#retries = opts.retries;
    this.#userAgent = opts.userAgent;
  }

  async createTask(modelPath: string, body: unknown): Promise<AsyncTaskResponse> {
    const url = `https://${this.#endpointHost}/v1/${modelPath}`;
    return await this.#fetchJsonWithRetries(url, {
      method: "POST",
      headers: this.#jsonHeaders(),
      body: JSON.stringify(body),
    });
  }

  async getResultById(id: string): Promise<GetResultResponse> {
    const url = `https://${this.#endpointHost}/v1/get_result?id=${encodeURIComponent(id)}`;
    return await this.getResultByUrl(url);
  }

  async getResultByUrl(pollingUrl: string): Promise<GetResultResponse> {
    return await this.#fetchJsonWithRetries(pollingUrl, {
      method: "GET",
      headers: this.#authHeaders(),
    });
  }

  async getCredits(): Promise<CreditsResponse> {
    const url = `https://${this.#endpointHost}/v1/credits`;
    return await this.#fetchJsonWithRetries(url, {
      method: "GET",
      headers: this.#authHeaders(),
    });
  }

  async download(url: string): Promise<Uint8Array> {
    const res = await this.#fetchWithTimeout(url, { method: "GET" }, this.#timeoutMs);
    if (!res.ok) throw new HttpError(`Download failed: HTTP ${res.status}`, { status: res.status, url });
    const ab = await res.arrayBuffer();
    return new Uint8Array(ab);
  }

  #jsonHeaders(): Record<string, string> {
    return {
      ...this.#authHeaders(),
      "content-type": "application/json",
    };
  }

  #authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "x-key": this.#apiKey };
    if (this.#userAgent) headers["user-agent"] = this.#userAgent;
    return headers;
  }

  async #fetchJsonWithRetries<T>(url: string, init: RequestInit): Promise<T> {
    const retries = Math.max(0, this.#retries);
    let attempt = 0;

    while (true) {
      attempt++;
      try {
        const res = await this.#fetchWithTimeout(url, init, this.#timeoutMs);
        const contentType = res.headers.get("content-type") ?? "";
        const isJson = contentType.includes("application/json");
        const body = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined);

        if (!res.ok) {
          throw new HttpError(`HTTP ${res.status}`, { status: res.status, url, body });
        }
        return body as T;
      } catch (err) {
        const status = err instanceof HttpError ? err.status : null;
        const retryable = status === 429 || status === 503 || status === 502 || status === 504;
        if (!retryable || attempt > retries + 1) throw err;

        // Exponential backoff w/ small jitter.
        const base = 250 * 2 ** (attempt - 1);
        const jitter = Math.floor(Math.random() * 100);
        await sleep(Math.min(5_000, base + jitter));
      }
    }
  }

  async #fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(new Error("Request timeout")), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: ctl.signal });
    } finally {
      clearTimeout(t);
    }
  }
}

