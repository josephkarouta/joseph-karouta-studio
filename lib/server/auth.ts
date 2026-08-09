import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type AuthenticatedRequest = {
  user: User;
  admin: SupabaseClient;
  client: SupabaseClient;
  token: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function claimString(claims: Record<string, unknown>, key: string) {
  const value = claims[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function claimsToUser(claims: Record<string, unknown>): User {
  const id = claimString(claims, "sub");
  if (!id) throw new ApiAuthError("Invalid or expired session.", 401);

  const audience = claims.aud;
  const aud = Array.isArray(audience)
    ? String(audience[0] || "authenticated")
    : typeof audience === "string"
      ? audience
      : "authenticated";

  // getClaims() has already verified the JWT. Build the User shape from those
  // verified claims so normal API routes do not need a second Auth-server lookup.
  return {
    id,
    aud,
    role: claimString(claims, "role") || "authenticated",
    email: claimString(claims, "email"),
    phone: claimString(claims, "phone"),
    app_metadata: asRecord(claims.app_metadata),
    user_metadata: asRecord(claims.user_metadata),
    created_at: claimString(claims, "created_at") || "",
    last_sign_in_at: claimString(claims, "last_sign_in_at"),
    updated_at: claimString(claims, "updated_at"),
    identities: [],
    is_anonymous: claims.is_anonymous === true,
  } as User;
}

function looksLikeNetworkFailure(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message || "")
        : String(error || "");

  return /fetch failed|timeout|timed out|network|connect/i.test(message);
}

export async function requireApiUser(request: Request): Promise<AuthenticatedRequest> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) throw new ApiAuthError("Authentication required.", 401);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) throw new ApiAuthError("Supabase is not configured.", 503);

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Prefer verified JWT claims instead of auth.getUser(token). With Supabase's
  // modern asymmetric signing keys this verifies locally after the cached JWKS
  // is available and avoids putting the Auth server in the hot path of every API.
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    if (looksLikeNetworkFailure(claimsError)) {
      throw new ApiAuthError(
        "Authentication service is temporarily unreachable. Please try again.",
        503,
      );
    }
    throw new ApiAuthError("Invalid or expired session.", 401);
  }

  const user = claimsToUser(claimsData.claims as Record<string, unknown>);
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { user, admin, client, token };
}

export class ApiAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}
