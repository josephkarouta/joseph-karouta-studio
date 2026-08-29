import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

type ErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === "object") {
    const value = error as ErrorLike;
    const parts = [value.message, value.details, value.hint]
      .filter(Boolean)
      .map(String);

    if (parts.length > 0) return parts.join(" ");
  }

  return fallback;
}

function getErrorStatus(error: unknown) {
  return error instanceof ApiAuthError ? error.status : 500;
}

function notificationSetupMessage(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("notifications") &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find"))
  ) {
    return "Notifications are temporarily unavailable. Refresh the page or contact support if the problem continues.";
  }

  return message;
}

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") || 100);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(100, Math.max(1, Math.trunc(requestedLimit)))
      : 100;

    const [notificationsResult, unreadResult] = await Promise.all([
      admin
        .from("notifications")
        .select("id,type,title,message,href,metadata,read_at,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit),
      admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null),
    ]);

    if (notificationsResult.error) throw notificationsResult.error;
    if (unreadResult.error) throw unreadResult.error;

    const notifications = notificationsResult.data || [];
    const unreadCount = unreadResult.count || 0;

    return NextResponse.json(
      {
        success: true,
        notifications,
        unreadCount,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    const rawMessage = getErrorMessage(error, "Unable to load notifications.");
    const message = notificationSetupMessage(rawMessage);

    console.error("Account notifications GET failed:", error);

    return NextResponse.json(
      { success: false, error: message },
      { status: getErrorStatus(error) },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = (await request.json().catch(() => ({}))) as {
      all?: boolean;
      id?: string;
    };

    if (!body.all && !body.id) {
      return NextResponse.json(
        { success: false, error: "A notification ID is required." },
        { status: 400 },
      );
    }

    let query = admin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (body.all) {
      query = query.is("read_at", null);
    } else {
      query = query.eq("id", String(body.id));
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const rawMessage = getErrorMessage(error, "Unable to update notifications.");
    const message = notificationSetupMessage(rawMessage);

    console.error("Account notifications PATCH failed:", error);

    return NextResponse.json(
      { success: false, error: message },
      { status: getErrorStatus(error) },
    );
  }
}
