import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasAdminRole } from "@/lib/auth/admin-role";

const PRELAUNCH_PUBLIC_ROUTES = [
  "/",
  "/expertsnetwork",
  "/privacy",
  "/terms",
  "/refunds",
  "/content-policy",
  "/responsible-ai",
  "/security",
] as const;

function publicMode() {
  return String(process.env.HEYY_PUBLIC_MODE || "beta")
    .trim()
    .toLowerCase();
}

function isPrelaunchPublicPath(pathname: string) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/api/public/expert-network")) return true;

  return PRELAUNCH_PUBLIC_ROUTES.some(
    (route) => route !== "/" && (pathname === route || pathname.startsWith(`${route}/`)),
  );
}

function copyAuthCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    const { name, value, ...options } = cookie;
    target.cookies.set(name, value, options);
  });
  return target;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminRoute = pathname.startsWith("/admin");

  // Production pre-launch: expose only the Coming Soon home, Expert Network,
  // its public API and the public legal/trust pages. Beta/live modes keep the
  // normal application routing.
  if (publicMode() === "prelaunch" && !isPrelaunchPublicPath(pathname)) {
    const homeUrl = new URL("/", request.url);
    return NextResponse.redirect(homeUrl);
  }

  // The broad matcher is only needed for the pre-launch gate. Outside Admin,
  // no Supabase session work is required here.
  if (!isAdminRoute && !isAdminApi) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Supabase authentication is not configured." },
      { status: 503 },
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
      },
    },
  });

  // Keep this call immediately after createServerClient so Supabase can safely
  // validate and refresh the cookie-backed session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isAdminApi) {
      return copyAuthCookies(
        NextResponse.json({ error: "Admin sign-in required." }, { status: 401 }),
        supabaseResponse,
      );
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return copyAuthCookies(NextResponse.redirect(loginUrl), supabaseResponse);
  }

  if (!hasAdminRole(user)) {
    if (isAdminApi) {
      return copyAuthCookies(
        NextResponse.json({ error: "Admin access required." }, { status: 403 }),
        supabaseResponse,
      );
    }

    const deniedUrl = new URL("/dashboard", request.url);
    deniedUrl.searchParams.set("adminAccess", "denied");
    return copyAuthCookies(NextResponse.redirect(deniedUrl), supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff|woff2|mp4|webm)$).*)",
  ],
};
