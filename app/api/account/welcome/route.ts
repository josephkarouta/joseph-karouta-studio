import "server-only";

import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { sendWelcomeEmail } from "@/lib/communications/welcome";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user } = await requireApiUser(request);
    const result = await sendWelcomeEmail(user);
    return NextResponse.json({ success: true, sent: result.sent, duplicate: result.duplicate });
  } catch (error) {
    const status = error instanceof ApiAuthError ? error.status : 500;
    console.error("Welcome email error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof ApiAuthError ? error.message : "Welcome email could not be sent." },
      { status },
    );
  }
}
