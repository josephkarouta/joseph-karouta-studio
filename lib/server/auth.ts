import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type AuthenticatedRequest = {
  user: User;
  admin: SupabaseClient;
  token: string;
};

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
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) throw new ApiAuthError("Invalid or expired session.", 401);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { user: data.user, admin, token };
}

export class ApiAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}
