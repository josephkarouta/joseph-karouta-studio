import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

const PAGE_SIZE = 10;

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const url = new URL(request.url);
    const requestedPage = Number(url.searchParams.get("page") || 1);
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await admin
      .from("credit_usage_events")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const total = Number(count || 0);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return NextResponse.json({
      events: data || [],
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load credit history." },
      { status: error instanceof ApiAuthError ? error.status : 500 },
    );
  }
}
