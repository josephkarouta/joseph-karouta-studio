"use client";

import { useEffect } from "react";

type ApiPayload = Record<string, unknown>;

declare global {
  interface Window {
    __heyyApiResponseSafetyInstalled?: boolean;
  }
}

const TECHNICAL_ERROR_PATTERN = new RegExp(
  [
    "<!doctype",
    "<html",
    "unexpected\\s+token",
    "syntaxerror",
    "typeerror",
    "referenceerror",
    "json\\s*parse",
    "\\bjson\\b",
    "module_not_found",
    "cannot find module",
    "error(message|type)?\\s*[:=]",
    "\\bat\\s+[a-z0-9_$./<>-]+\\s*\\(",
    "stack\\s*trace",
    "supabase",
    "postgres",
    "postgrest",
    "pgrst",
    "schema\\s+cache",
    "service_role",
    "credit_operation_failed",
    "credit_system_unavailable",
    "heyy_(reserve|commit|refund)_credits",
    "openai",
    "gemini",
    "veo-?\\d",
    "topaz",
    "netlify",
    "stripe",
    "gpt-[a-z0-9.-]+",
    "models/",
    "api[_ -]?key",
    "process\\.env",
    "\\bselect\\b.+\\bfrom\\b",
    "relation .+ does not exist",
    "column .+ does not exist",
    "\\b22p02\\b|\\b23505\\b|\\b42501\\b",
  ].join("|"),
  "i",
);

const SAFE_USER_ERROR_PATTERN = new RegExp(
  [
    "sign in",
    "session expired",
    "authentication required",
    "verify your email",
    "need \\d+ credits",
    "insufficient credits",
    "add credits",
    "upload",
    "must be",
    "is required",
    "required\\.",
    "too large",
    "smaller",
    "unsupported",
    "not found",
    "credits were returned",
  ].join("|"),
  "i",
);

function fallbackFor(url = "", status = 0) {
  const lower = url.toLowerCase();

  if (lower.includes("powerpoint")) {
    return "We couldn’t prepare this presentation. If credits were reserved, they will be returned automatically. Please try again.";
  }
  if (lower.includes("digital-adapt")) {
    return "We couldn’t create these adaptations. If credits were reserved, they will be returned automatically. Please try again.";
  }
  if (lower.includes("image-to-video")) {
    return "We couldn’t complete this video request. If credits were reserved, they will be returned automatically. Please try again.";
  }
  if (lower.includes("upscal")) {
    return "We couldn’t complete this image enhancement. If credits were reserved, they will be returned automatically. Please try again.";
  }
  if (lower.includes("text-to-image") || lower.includes("generate-image")) {
    return "We couldn’t generate this image. If credits were reserved, they will be returned automatically. Please try again.";
  }
  if (lower.includes("brand-studio")) {
    return "Heyy Studio couldn’t complete this Brand Studio action. Please try again.";
  }
  if (lower.includes("marketing")) {
    return "Heyy Studio couldn’t complete this Marketing Studio action. Please try again.";
  }
  if (lower.includes("architecture")) {
    return "Heyy Studio couldn’t complete this Architecture Studio action. Please try again.";
  }
  if (lower.includes("interior")) {
    return "Heyy Studio couldn’t complete this Interior Studio action. Please try again.";
  }
  if (status === 401 || status === 403) {
    return "Your session has expired. Sign in again and retry.";
  }
  if (status === 429) {
    return "Heyy Studio is receiving a lot of requests right now. Please try again shortly.";
  }

  return "Something went wrong while Heyy Studio was processing this request. Please try again.";
}

function cleanMessage(value: unknown, url = "", status = 0) {
  const fallback = fallbackFor(url, status);
  const message = typeof value === "string" ? value.replace(/\\s+/g, " ").trim() : "";

  if (!message) return fallback;

  if (/already (?:in progress|being processed|processing)|generation is already/i.test(message)) {
    if (url.toLowerCase().includes("powerpoint")) {
      return "This presentation is already being prepared. Check its progress before starting another one.";
    }
    return "This generation is already being prepared. Check its progress before starting another one.";
  }

  if (/inactivity timeout|timed out|timeout|gateway timeout|function timed out/i.test(message)) {
    return "This request took longer than expected. If credits were reserved, they will be returned automatically. Please try again.";
  }

  if (TECHNICAL_ERROR_PATTERN.test(message)) return fallback;

  // Keep short, clearly customer-actionable validation/auth/credit messages.
  if (message.length <= 260 && SAFE_USER_ERROR_PATTERN.test(message)) return message;

  // A normal short sentence can remain visible. Reject code-shaped or payload-shaped text.
  if (
    message.length <= 220 &&
    !/[{}[\\]`]/.test(message) &&
    !/https?:\/\//i.test(message) &&
    !/\\b[A-Z_]{4,}\\b/.test(message)
  ) {
    return message;
  }

  return fallback;
}

function sanitizePayload(payload: unknown, url = "", status = 0): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;

  const source = payload as ApiPayload;
  const next: ApiPayload = { ...source };
  const hasError = Object.prototype.hasOwnProperty.call(source, "error");
  const failed = source.success === false || status >= 400 || hasError;

  if (!failed) return payload;

  if (hasError) {
    if (typeof source.error === "string") {
      next.error = cleanMessage(source.error, url, status);
    } else if (source.error && typeof source.error === "object") {
      const nested = source.error as ApiPayload;
      next.error = cleanMessage(nested.message, url, status);
    } else {
      next.error = fallbackFor(url, status);
    }
  } else {
    next.error = cleanMessage(source.message, url, status);
  }

  if (typeof source.message === "string" && TECHNICAL_ERROR_PATTERN.test(source.message)) {
    next.message = next.error;
  }

  if (typeof source.code === "string" && /^(?:CREDIT_|PGRST|[0-9]{5})/i.test(source.code)) {
    delete next.code;
  }

  return next;
}

function jsonResponse(payload: unknown, original: Response) {
  const headers = new Headers(original.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.delete("content-length");
  return new Response(JSON.stringify(payload), {
    status: original.status,
    statusText: original.statusText,
    headers,
  });
}

export default function ApiResponseSafety() {
  useEffect(() => {
    if (window.__heyyApiResponseSafetyInstalled) return;
    window.__heyyApiResponseSafetyInstalled = true;

    const originalFetch = window.fetch.bind(window);
    const originalJson = Response.prototype.json;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args);
      const requestUrl =
        typeof args[0] === "string"
          ? args[0]
          : args[0] instanceof URL
            ? args[0].toString()
            : args[0]?.url || response.url || "";

      // Do not touch ordinary successful responses. Their normal body/data remains exact.
      if (response.ok) return response;

      const isApiRequest = requestUrl.includes("/api/") || response.url.includes("/api/");
      if (!isApiRequest) return response;

      try {
        const text = await response.clone().text();
        if (!text) {
          return jsonResponse({ error: fallbackFor(requestUrl, response.status) }, response);
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { error: cleanMessage(text, requestUrl, response.status) };
        }

        return jsonResponse(sanitizePayload(parsed, requestUrl, response.status), response);
      } catch {
        return jsonResponse({ error: fallbackFor(requestUrl, response.status) }, response);
      }
    };

    // Last line of defense for any existing component that calls response.json()
    // against an HTML/empty/non-JSON response. Never expose parser text to users.
    Response.prototype.json = async function heyySafeResponseJson() {
      try {
        const payload = await originalJson.call(this);
        return sanitizePayload(payload, this.url || "", this.status);
      } catch {
        return { error: fallbackFor(this.url || "", this.status) };
      }
    };
  }, []);

  return null;
}
