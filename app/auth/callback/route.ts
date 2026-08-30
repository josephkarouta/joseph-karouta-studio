import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sendWelcomeEmail } from "@/lib/communications/welcome";

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
      "Authentication is temporarily unavailable.",
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

  // Only brand-new Google accounts receive the welcome email here. Existing
  // customers signing in again must not suddenly receive a new-user message.
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (user) {
      const ageMs = Date.now() - new Date(user.created_at).getTime();
      if (ageMs >= 0 && ageMs <= 10 * 60 * 1000) {
        await sendWelcomeEmail(user);
      }
    }
  } catch (welcomeError) {
    console.error("Welcome email after Google signup failed:", welcomeError);
  }

  return response;
}
