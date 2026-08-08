import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

import { requireAdminApiAccess } from "@/lib/server/admin-api";
const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Cookie refresh may be unavailable in some route contexts.
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function POST(request: NextRequest) {
  const adminAccessError = await requireAdminApiAccess();
  if (adminAccessError) return adminAccessError;

  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Sign in before sending a question." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const quoteId = String(body.quoteId || "").trim();
    const message = String(body.message || "").trim();

    if (!quoteId || !message) {
      return NextResponse.json(
        { success: false, error: "Add your question before sending it." },
        { status: 400 },
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { success: false, error: "Keep the question under 2,000 characters." },
        { status: 400 },
      );
    }

    const { data: quote, error: quoteError } = await serviceSupabase
      .from("workspace_quotes")
      .select("id,studio_request_id,project_id,service")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote?.studio_request_id) {
      return NextResponse.json(
        { success: false, error: "Quote request not found." },
        { status: 404 },
      );
    }

    const { data: studioRequest, error: requestError } = await serviceSupabase
      .from("studio_requests")
      .select("id,user_id,metadata")
      .eq("id", quote.studio_request_id)
      .single();

    if (requestError || !studioRequest) {
      throw requestError || new Error("Studio request not found.");
    }

    if (studioRequest.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "This quote does not belong to your account." },
        { status: 403 },
      );
    }

    const metadata =
      studioRequest.metadata && typeof studioRequest.metadata === "object"
        ? studioRequest.metadata
        : {};
    const previousQuestions = Array.isArray(metadata.quote_questions)
      ? metadata.quote_questions
      : [];

    const question = {
      id: randomUUID(),
      quote_id: quote.id,
      sender_type: "client",
      sender_name:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email ||
        "Client",
      sender_email: user.email || null,
      message,
      created_at: new Date().toISOString(),
      status: "open",
    };

    const { error: updateError } = await serviceSupabase
      .from("studio_requests")
      .update({
        metadata: {
          ...metadata,
          quote_questions: [...previousQuestions, question],
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", studioRequest.id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, question });
  } catch (error) {
    console.error("Quote question error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Question could not be sent.",
      },
      { status: 500 },
    );
  }
}
