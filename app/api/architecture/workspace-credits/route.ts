import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  commitCredits,
  CreditError,
  refundCredits,
  reserveCredits,
} from "@/lib/credits/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

export const runtime = "nodejs";

type Operation = "reserve" | "commit" | "refund" | "status";

type WorkspaceCreditRequest = {
  operation?: Operation;
  reservationId?: string;
  projectId?: string;
  reason?: string;
};

async function ownedReservation(
  admin: SupabaseClient,
  userId: string,
  reservationId: string,
) {
  const { data, error } = await admin
    .from("credit_reservations")
    .select("id,user_id,action,amount,status")
    .eq("id", reservationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.action !== "architectureWorkspace") {
    throw new Error("Architecture workspace credit reservation not found.");
  }
  return data;
}

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = (await request.json()) as WorkspaceCreditRequest;
    const operation = body.operation || "reserve";

    if (operation === "reserve") {
      const reservation = await reserveCredits({
        admin,
        userId: user.id,
        action: "architectureWorkspace",
        metadata: {
          studio: "architecture_studio",
          tool: "workspace_setup",
        },
      });

      return NextResponse.json({
        success: true,
        reservationId: reservation.id,
        amount: reservation.amount,
        status: "reserved",
      });
    }

    const reservationId = String(body.reservationId || "").trim();
    if (!reservationId) {
      return NextResponse.json(
        { success: false, error: "reservationId is required." },
        { status: 400 },
      );
    }

    const reservation = await ownedReservation(admin, user.id, reservationId);

    if (operation === "status") {
      return NextResponse.json({
        success: true,
        status: reservation.status,
        amount: Number(reservation.amount || 0),
      });
    }

    if (operation === "refund") {
      await refundCredits(
        admin,
        reservationId,
        String(body.reason || "Architecture workspace creation did not complete."),
      );
      const updated = await ownedReservation(admin, user.id, reservationId);
      return NextResponse.json({ success: true, status: updated.status });
    }

    if (operation === "commit") {
      const projectId = String(body.projectId || "").trim();
      if (!projectId) {
        return NextResponse.json(
          { success: false, error: "projectId is required before committing workspace credits." },
          { status: 400 },
        );
      }

      const { data: project, error: projectError } = await admin
        .from("architecture_projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (projectError) throw projectError;
      if (!project) {
        return NextResponse.json(
          { success: false, error: "Architecture project not found." },
          { status: 404 },
        );
      }

      await commitCredits(admin, reservationId, {
        project_id: projectId,
        studio: "architecture_studio",
        tool: "workspace_setup",
      });

      return NextResponse.json({ success: true, status: "committed" });
    }

    return NextResponse.json(
      { success: false, error: "Invalid workspace credit operation." },
      { status: 400 },
    );
  } catch (error) {
    const status = error instanceof ApiAuthError || error instanceof CreditError
      ? error.status
      : 500;
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Architecture workspace credits could not be updated.",
      },
      { status },
    );
  }
}
