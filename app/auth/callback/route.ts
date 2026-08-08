import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

function loginErrorResponse(
  request: NextRequest,
  next: string,
  message: string,
): NextResponse {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", next);
  loginUrl.searchParams.set("authError", message);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const next = safeNext(requestUrl.searchParams.get("next"));
  const code = requestUrl.searchParams.get("code");
  const providerError =
    requestUrl.searchParams.get("error_description") ||
    requestUrl.searchParams.get("error");

  if (providerError) {
    return loginErrorResponse(request, next, providerError);
  }

  if (!code) {
    return loginErrorResponse(
      request,
      next,
      "Google sign-in did not return an authorization code.",
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return loginErrorResponse(
      request,
      next,
      "Supabase authentication is not configured.",
    );
  }

  const destination = new URL(next, request.url);
  const response = NextResponse.redirect(destination);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return loginErrorResponse(request, next, error.message);
  }

  return response;
}
