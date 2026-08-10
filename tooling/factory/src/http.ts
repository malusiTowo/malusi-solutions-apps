/**
 * The one HTTP helper every driver uses.
 *
 * Providers disagree about almost everything except that a non-2xx means trouble, so
 * this normalises status handling, JSON decoding, and error messages. Drivers stay
 * short enough to read as "call this endpoint, map the response".
 */
import { FactoryError } from "./types";

export interface RequestOptions {
  readonly method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  readonly headers?: Record<string, string>;
  /** Serialised as JSON unless `form` is set. */
  readonly body?: unknown;
  /** Send as `application/x-www-form-urlencoded` (Stripe, OAuth token endpoints). */
  readonly form?: Record<string, string>;
  readonly query?: Record<string, string | number | boolean | undefined>;
  /** Driver id, for error attribution. */
  readonly driver: string;
  /** Treat these statuses as success and return `undefined`. Use for 404-on-lookup. */
  readonly allowStatus?: readonly number[];
}

function withQuery(url: string, query: RequestOptions["query"]): string {
  if (query === undefined) return url;
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) parsed.searchParams.set(key, String(value));
  }
  return parsed.toString();
}

/**
 * Perform a request and decode JSON. Returns `undefined` for a status listed in
 * `allowStatus`, which is how drivers express "look it up, absent is fine".
 */
export async function request<T>(url: string, options: RequestOptions): Promise<T | undefined> {
  const { driver, method = "GET", allowStatus = [] } = options;

  const headers: Record<string, string> = { accept: "application/json", ...options.headers };
  let body: string | undefined;

  if (options.form !== undefined) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(options.form).toString();
  } else if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const target = withQuery(url, options.query);

  let response: Response;
  try {
    response = await fetch(target, { method, headers, body });
  } catch (cause) {
    throw new FactoryError("provider", `${method} ${target} failed to connect`, { driver, cause });
  }

  if (allowStatus.includes(response.status)) return undefined;

  const text = await response.text();

  if (!response.ok) {
    throw new FactoryError(
      "provider",
      `${method} ${target} → ${response.status} ${response.statusText}: ${truncate(text)}`,
      { driver, detail: text },
    );
  }

  if (text.trim() === "") return undefined;

  try {
    return JSON.parse(text) as T;
  } catch (cause) {
    throw new FactoryError("provider", `${method} ${target} returned non-JSON`, {
      driver,
      detail: truncate(text),
      cause,
    });
  }
}

/** Same as {@link request} but rejects when the response body is absent. */
export async function requireJson<T>(url: string, options: RequestOptions): Promise<T> {
  const result = await request<T>(url, options);
  if (result === undefined) {
    throw new FactoryError("provider", `${options.method ?? "GET"} ${url} returned no body`, {
      driver: options.driver,
    });
  }
  return result;
}

function truncate(text: string, max = 400): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}
