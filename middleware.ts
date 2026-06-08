import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get("authorization");

  if (req.nextUrl.pathname.startsWith("/admin")) {
    if (basicAuth) {
      const authValue = basicAuth.split(" ")[1];
      const [user, password] = atob(authValue).split(":");

      if (
        user === process.env.ADMIN_USERNAME &&
        password === process.env.ADMIN_PASSWORD
      ) {
        return NextResponse.next();
      }
    }

    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Heyy Studio Admin"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};