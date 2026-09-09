import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireAdminApiCapability } from "@/lib/server/admin-api";
import { recordAdminAudit } from "@/lib/admin/audit";
import {
  sendExpertQuoteRequestEmails,
  sendPreferredExpertEmail,
} from "@/lib/communications/expert-operations";
import {
  buildExpertSharePackOptions,
  buildExpertSharedScope,
} from "@/lib/expert-network/share-pack";
import { notifyExpertOperationalEvent } from "@/lib/expert-network/operational-notifications";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function text(value: unknown, max = 10000) {
  return String(value || "").trim().slice(0, max);
}

function requestStudio(row: Record<string, any>) {
  return text(row.studio, 100);
}

async function loadProfiles(
  supabase: SupabaseClient,
  ids: string[],
  existing: any[] = [],
) {
  const profiles = new Map<string, any>();
  for (const profile of existing) profiles.set(String(profile.id), profile);
  const missing = Array.from(new Set(ids)).filter((id) => id && !profiles.has(id));
  if (missing.length > 0) {
    const { data, error } = await supabase
      .from("expert_profiles")
      .select(
        "id,user_id,full_name,email,studio,role_title,location,timezone,years_experience,specialties,software_tools,languages,availability,status,portfolio_url,linkedin_url",
      )
      .in("id", missing);
    if (error) throw error;
    for (const profile of data || []) profiles.set(String(profile.id), profile);
  }
  return profiles;
}

async function loadPayload(supabase: SupabaseClient, requestId: string) {
  const { data: studioRequest, error: requestError } = await supabase
    .from("studio_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError) throw requestError;
  if (!studioRequest) throw new Error("Studio request not found.");

  const studio = requestStudio(studioRequest);
  let expertQuery = supabase
    .from("expert_profiles")
    .select(
      "id,user_id,full_name,email,studio,role_title,location,timezone,years_experience,specialties,software_tools,languages,availability,status,portfolio_url,linkedin_url",
    )
    .eq("status", "active")
    .order("full_name", { ascending: true })
    .limit(500);
  if (studio) expertQuery = expertQuery.eq("studio", studio);

  const [expertsResult, opportunitiesResult, quoteResult] = await Promise.all([
    expertQuery,
    supabase
      .from("expert_opportunities")
      .select("*")
      .eq("studio_request_id", requestId)
      .order("created_at", { ascending: false }),
    supabase
      .from("workspace_quotes")
      .select("id,status,amount,currency,created_at,paid_at,production_job_id")
      .eq("studio_request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (expertsResult.error) throw expertsResult.error;
  if (opportunitiesResult.error) throw opportunitiesResult.error;
  if (quoteResult.error) throw quoteResult.error;

  const profileIds = (opportunitiesResult.data || [])
    .map((row: any) => String(row.expert_profile_id || ""))
    .filter(Boolean);
  const profiles = await loadProfiles(
    supabase,
    profileIds,
    expertsResult.data || [],
  );

  const opportunities = (opportunitiesResult.data || []).map((row: any) => ({
    ...row,
    expert: profiles.get(String(row.expert_profile_id)) || null,
  }));
  const selected = opportunities.find((row: any) => row.status === "selected") || null;

  return {
    request: {
      id: studioRequest.id,
      projectName: studioRequest.project_name,
      projectId: studioRequest.project_id,
      studio: studioRequest.studio,
      service: studioRequest.service,
      status: studioRequest.status,
      sharedScope:
        selected?.shared_scope ||
        opportunities[0]?.shared_scope ||
        buildExpertSharedScope({ row: studioRequest }),
      sharePackOptions: buildExpertSharePackOptions(studioRequest),
    },
    clientQuote: quoteResult.data || null,
    experts: expertsResult.data || [],
    opportunities,
    selected,
  };
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireAdminApiCapability("operations");
    if (access.response) return access.response;

    const requestId = text(request.nextUrl.searchParams.get("requestId"), 200);
    if (!requestId) {
      return NextResponse.json(
        { success: false, error: "Studio request is required." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      ...(await loadPayload(adminClient(), requestId)),
    });
  } catch (error) {
    console.error("Load Expert sourcing error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Expert sourcing could not be loaded.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireAdminApiCapability("operations");
    if (access.response) return access.response;

    const supabase = adminClient();
    const body = (await request.json()) as Record<string, unknown>;
    const action = text(body.action, 80);
    const requestId = text(body.requestId, 200);

    if (!action || !requestId) {
      return NextResponse.json(
        { success: false, error: "Action and Studio request are required." },
        { status: 400 },
      );
    }

    const { data: studioRequest, error: requestError } = await supabase
      .from("studio_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!studioRequest) {
      return NextResponse.json(
        { success: false, error: "Studio request not found." },
        { status: 404 },
      );
    }

    if (String(studioRequest.status || "").toLowerCase() === "converted") {
      return NextResponse.json(
        {
          success: false,
          error:
            "This request is already in production. Expert sourcing is locked at the request stage.",
        },
        { status: 409 },
      );
    }

    if (action === "request_quotes") {
      const expertIds = Array.isArray(body.expertIds)
        ? Array.from(
            new Set(
              body.expertIds
                .map((value) => text(value, 100))
                .filter(Boolean),
            ),
          )
        : [];
      if (expertIds.length === 0) {
        return NextResponse.json(
          { success: false, error: "Select at least one Expert." },
          { status: 400 },
        );
      }
      if (expertIds.length > 20) {
        return NextResponse.json(
          {
            success: false,
            error: "Request quotes from no more than 20 Experts at a time.",
          },
          { status: 400 },
        );
      }

      const { data: experts, error: expertError } = await supabase
        .from("expert_profiles")
        .select("id,user_id,email,full_name,role_title,studio,status,availability")
        .in("id", expertIds);
      if (expertError) throw expertError;

      const studio = requestStudio(studioRequest);
      const allowed = (experts || []).filter(
        (expert: any) =>
          expert.status === "active" &&
          expert.availability !== "unavailable" &&
          (!studio || expert.studio === studio),
      );
      if (allowed.length !== expertIds.length) {
        return NextResponse.json(
          {
            success: false,
            error:
              "One or more selected Experts are unavailable, inactive, or do not match this Studio.",
          },
          { status: 400 },
        );
      }

      const selectedItemIds = Array.isArray(body.shareItemIds)
        ? body.shareItemIds.map((value) => text(value, 160)).filter(Boolean)
        : [];
      const selectedVisualIds = Array.isArray(body.shareVisualIds)
        ? body.shareVisualIds.map((value) => text(value, 160)).filter(Boolean)
        : [];
      const sharedScope = buildExpertSharedScope({
        row: studioRequest,
        sharedBrief: text(body.sharedBrief, 12000),
        selectedItemIds,
        selectedVisualIds,
      });
      const now = new Date().toISOString();
      const rows = allowed.map((expert: any) => ({
        studio_request_id: requestId,
        production_job_id: null,
        expert_profile_id: expert.id,
        status: "requested",
        shared_scope: sharedScope,
        requested_by: access.user?.id || null,
        requested_at: now,
        quoted_fee_cents: null,
        turnaround_days: null,
        included_revisions: null,
        expert_notes: null,
        quoted_at: null,
        responded_at: null,
        closed_at: null,
        updated_at: now,
      }));

      const { error: upsertError } = await supabase
        .from("expert_opportunities")
        .upsert(rows, {
          onConflict: "studio_request_id,expert_profile_id",
          ignoreDuplicates: true,
        });
      if (upsertError) throw upsertError;

      // Email delivery is intentionally non-blocking for the business action.
      // A quote request must remain saved even if Resend has a temporary issue.
      await sendExpertQuoteRequestEmails({
        requestId,
        sharedScope,
        experts: allowed,
      });

      // The quote-request email and in-app alert are deliberately separate so
      // a temporary Resend issue never hides the opportunity inside the portal.
      await Promise.allSettled(
        allowed.map((expert: any) =>
          notifyExpertOperationalEvent(supabase, {
            key: `expert-quote-request:${requestId}:${expert.id}`,
            type: "expert.quote.requested",
            expertUserId: expert.user_id || null,
            expertEmail: null,
            expertName: expert.full_name || "Expert",
            projectName: text(sharedScope.projectName, 300) || text(studioRequest.project_name, 300) || "Untitled project",
            service: text(sharedScope.service, 300) || text(studioRequest.service, 300) || "Production",
            studio: text(sharedScope.studio, 100) || text(studioRequest.studio, 100) || null,
            title: "New Expert quote request",
            message: "Heyy Studio shared a private project opportunity for you to review and quote.",
            status: "Quote requested",
            href: "/expert?section=opportunities",
          }),
        ),
      );

      await recordAdminAudit({
        actorUserId: access.user?.id || null,
        action: "expert.quotes_requested",
        entityType: "studio_request",
        entityId: requestId,
        summary: `Requested Expert quotes from ${allowed.length} Expert${allowed.length === 1 ? "" : "s"}`,
        metadata: {
          expert_ids: allowed.map((item: any) => item.id),
          shared_item_count: sharedScope.quotePack?.items?.length || 0,
          shared_visual_count: sharedScope.quotePack?.visuals?.length || 0,
        },
      });
    } else if (action === "select_preferred") {
      const opportunityId = text(body.opportunityId, 100);
      if (!opportunityId) {
        return NextResponse.json(
          { success: false, error: "Expert quote is required." },
          { status: 400 },
        );
      }

      const { data: opportunity, error: opportunityError } = await supabase
        .from("expert_opportunities")
        .select("*")
        .eq("id", opportunityId)
        .eq("studio_request_id", requestId)
        .maybeSingle();
      if (opportunityError) throw opportunityError;
      if (!opportunity || opportunity.status !== "quoted") {
        return NextResponse.json(
          {
            success: false,
            error: "Only a submitted Expert quote can be selected.",
          },
          { status: 409 },
        );
      }

      const { data: otherOpportunities, error: otherOpportunitiesError } = await supabase
        .from("expert_opportunities")
        .select("id,expert_profile_id,status,quoted_fee_cents,shared_scope")
        .eq("studio_request_id", requestId)
        .neq("id", opportunity.id)
        .in("status", ["requested", "quoted", "selected"]);
      if (otherOpportunitiesError) throw otherOpportunitiesError;

      const otherProfileIds = Array.from(new Set((otherOpportunities || []).map((item: any) => item.expert_profile_id).filter(Boolean)));
      const { data: otherProfiles, error: otherProfilesError } = otherProfileIds.length
        ? await supabase.from("expert_profiles").select("id,user_id,email,full_name").in("id", otherProfileIds)
        : { data: [], error: null };
      if (otherProfilesError) throw otherProfilesError;
      const otherProfileMap = new Map((otherProfiles || []).map((item: any) => [String(item.id), item]));

      const now = new Date().toISOString();
      const { error: closeError } = await supabase
        .from("expert_opportunities")
        .update({ status: "closed", closed_at: now, updated_at: now })
        .eq("studio_request_id", requestId)
        .neq("id", opportunity.id)
        .in("status", ["requested", "quoted", "selected"]);
      if (closeError) throw closeError;

      const { error: selectError } = await supabase
        .from("expert_opportunities")
        .update({ status: "selected", closed_at: null, updated_at: now })
        .eq("id", opportunity.id)
        .eq("studio_request_id", requestId);
      if (selectError) throw selectError;

      // Persist a stable preferred-Expert handoff snapshot on the Studio request.
      // This gives client-quote creation and payment reconciliation a second,
      // deterministic source of truth even if opportunity status changes later.
      const nextMetadata = {
        ...(studioRequest.metadata && typeof studioRequest.metadata === "object"
          ? studioRequest.metadata
          : {}),
        preferred_expert_opportunity_id: opportunity.id,
        preferred_expert_profile_id: opportunity.expert_profile_id,
        preferred_expert_fee_cents: opportunity.quoted_fee_cents,
        preferred_expert_currency: opportunity.currency || "USD",
        preferred_expert_turnaround_days: opportunity.turnaround_days,
        preferred_expert_included_revisions: opportunity.included_revisions,
        preferred_expert_extra_revision_fee_cents: opportunity.extra_revision_fee_cents ?? null,
        preferred_expert_selected_at: now,
      };
      const { error: preferredSnapshotError } = await supabase
        .from("studio_requests")
        .update({ metadata: nextMetadata, updated_at: now })
        .eq("id", requestId);
      if (preferredSnapshotError) throw preferredSnapshotError;

      const { data: preferredExpert, error: preferredExpertError } = await supabase
        .from("expert_profiles")
        .select("id,user_id,email,full_name,role_title")
        .eq("id", opportunity.expert_profile_id)
        .maybeSingle();
      if (preferredExpertError) {
        console.error("Preferred Expert email profile lookup failed:", preferredExpertError);
      } else if (preferredExpert) {
        const preferredProjectName =
          text(opportunity.shared_scope?.projectName, 300) ||
          text(studioRequest.project_name, 300) ||
          "Untitled project";
        const preferredService =
          text(opportunity.shared_scope?.service, 300) ||
          text(studioRequest.service, 300) ||
          "Production";
        const preferredStudio =
          text(opportunity.shared_scope?.studio, 100) ||
          text(studioRequest.studio, 100) ||
          null;

        try {
          await sendPreferredExpertEmail({
            requestId,
            opportunityId: opportunity.id,
            expert: preferredExpert,
            projectName: preferredProjectName,
            service: preferredService,
            studio: preferredStudio,
            feeCents: opportunity.quoted_fee_cents,
            currency: opportunity.currency || "USD",
            turnaroundDays: opportunity.turnaround_days,
            includedRevisions: opportunity.included_revisions,
          });
        } catch (emailError) {
          console.error("Preferred Expert email failed:", emailError);
        }

        await notifyExpertOperationalEvent(supabase, {
          key: `expert-preferred:${opportunity.id}`,
          type: "expert.preferred.selected",
          expertUserId: preferredExpert.user_id || null,
          expertEmail: null,
          expertName: preferredExpert.full_name || "Expert",
          projectName: preferredProjectName,
          service: preferredService,
          studio: preferredStudio,
          title: "Your quote was selected as preferred",
          message: "Heyy Studio selected your quote as the preferred option. Do not begin work until client payment is confirmed and the project becomes an active assignment.",
          status: "Preferred — awaiting client payment",
          href: "/expert?section=opportunities",
        });
      }

      const selectedProjectName =
        text(opportunity.shared_scope?.projectName, 300) ||
        text(studioRequest.project_name, 300) ||
        "Untitled project";
      const selectedService =
        text(opportunity.shared_scope?.service, 300) ||
        text(studioRequest.service, 300) ||
        "Production";
      const selectedStudio =
        text(opportunity.shared_scope?.studio, 100) ||
        text(studioRequest.studio, 100) ||
        null;

      await Promise.allSettled(
        (otherOpportunities || [])
          .filter((item: any) => item.quoted_fee_cents !== null && item.quoted_fee_cents !== undefined)
          .map((item: any) => {
            const expert = otherProfileMap.get(String(item.expert_profile_id)) as any;
            if (!expert) return Promise.resolve();
            return notifyExpertOperationalEvent(supabase, {
              key: `expert-not-selected:${requestId}:${item.id}:${opportunity.id}`,
              type: "expert.preferred.not_selected",
              expertUserId: expert.user_id || null,
              expertEmail: expert.email || null,
              expertName: expert.full_name || "Expert",
              projectName: selectedProjectName,
              service: selectedService,
              studio: selectedStudio,
              title: "Another Expert was selected for this project",
              message: "Thanks for quoting this opportunity. Heyy Studio selected another Expert for this project. No action is needed from you — please keep an eye on the Expert Portal for upcoming project opportunities.",
              status: "Opportunity closed",
              href: "/expert?section=opportunities",
            });
          }),
      );

      await recordAdminAudit({
        actorUserId: access.user?.id || null,
        action: "expert.preferred_selected",
        entityType: "studio_request",
        entityId: requestId,
        summary: "Selected preferred Expert before client payment",
        metadata: {
          opportunity_id: opportunity.id,
          expert_profile_id: opportunity.expert_profile_id,
          quoted_fee_cents: opportunity.quoted_fee_cents,
          currency: opportunity.currency,
        },
      });
    } else if (action === "clear_preferred") {
      const { data: preferenceRows, error: preferenceRowsError } = await supabase
        .from("expert_opportunities")
        .select("id,expert_profile_id,status,quoted_fee_cents,shared_scope")
        .eq("studio_request_id", requestId)
        .in("status", ["selected", "closed"]);
      if (preferenceRowsError) throw preferenceRowsError;

      const preferenceProfileIds = Array.from(new Set((preferenceRows || []).map((item: any) => item.expert_profile_id).filter(Boolean)));
      const { data: preferenceProfiles, error: preferenceProfilesError } = preferenceProfileIds.length
        ? await supabase.from("expert_profiles").select("id,user_id,email,full_name").in("id", preferenceProfileIds)
        : { data: [], error: null };
      if (preferenceProfilesError) throw preferenceProfilesError;
      const preferenceProfileMap = new Map((preferenceProfiles || []).map((item: any) => [String(item.id), item]));

      const now = new Date().toISOString();
      const { error: selectedError } = await supabase
        .from("expert_opportunities")
        .update({ status: "quoted", closed_at: null, updated_at: now })
        .eq("studio_request_id", requestId)
        .eq("status", "selected");
      if (selectedError) throw selectedError;

      // Quotes closed only because another Expert had been preferred should
      // become comparable again if Admin changes that decision before the
      // client quote/payment handoff.
      const { error: reopenQuotedError } = await supabase
        .from("expert_opportunities")
        .update({ status: "quoted", closed_at: null, updated_at: now })
        .eq("studio_request_id", requestId)
        .eq("status", "closed")
        .not("quoted_fee_cents", "is", null);
      if (reopenQuotedError) throw reopenQuotedError;

      const nextMetadata = {
        ...(studioRequest.metadata && typeof studioRequest.metadata === "object"
          ? studioRequest.metadata
          : {}),
      } as Record<string, unknown>;
      delete nextMetadata.preferred_expert_opportunity_id;
      delete nextMetadata.preferred_expert_profile_id;
      delete nextMetadata.preferred_expert_fee_cents;
      delete nextMetadata.preferred_expert_currency;
      delete nextMetadata.preferred_expert_turnaround_days;
      delete nextMetadata.preferred_expert_included_revisions;
      delete nextMetadata.preferred_expert_selected_at;
      const { error: clearSnapshotError } = await supabase
        .from("studio_requests")
        .update({ metadata: nextMetadata, updated_at: now })
        .eq("id", requestId);
      if (clearSnapshotError) throw clearSnapshotError;

      const { error: reopenRequestedError } = await supabase
        .from("expert_opportunities")
        .update({ status: "requested", closed_at: null, updated_at: now })
        .eq("studio_request_id", requestId)
        .eq("status", "closed")
        .is("quoted_fee_cents", null);
      if (reopenRequestedError) throw reopenRequestedError;

      const changedProjectName = text(studioRequest.project_name, 300) || "Untitled project";
      const changedService = text(studioRequest.service, 300) || "Production";
      const changedStudio = text(studioRequest.studio, 100) || null;
      await Promise.allSettled(
        (preferenceRows || [])
          .filter((item: any) => item.status === "selected" || item.quoted_fee_cents !== null)
          .map((item: any) => {
            const expert = preferenceProfileMap.get(String(item.expert_profile_id)) as any;
            if (!expert) return Promise.resolve();
            const wasPreferred = item.status === "selected";
            return notifyExpertOperationalEvent(supabase, {
              key: `expert-preference-reopened:${requestId}:${item.id}:${now}`,
              type: wasPreferred ? "expert.preferred.changed" : "expert.opportunity.reopened",
              expertUserId: expert.user_id || null,
              expertEmail: expert.email || null,
              expertName: expert.full_name || "Expert",
              projectName: changedProjectName,
              service: changedService,
              studio: changedStudio,
              title: wasPreferred ? "Preferred Expert status changed" : "Project selection reopened",
              message: wasPreferred
                ? "Heyy Studio changed the internal Expert selection before client payment. Please do not start work. Your quote is back under review and we will notify you if the project is selected again."
                : "Heyy Studio reopened the Expert selection for this project before client payment. Your submitted quote is back under review; no action is required unless we contact you.",
              status: "Under review",
              href: "/expert?section=opportunities",
            });
          }),
      );
    } else {
      return NextResponse.json(
        { success: false, error: "Unknown Expert sourcing action." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      ...(await loadPayload(supabase, requestId)),
    });
  } catch (error) {
    console.error("Expert sourcing action error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Expert sourcing action failed.",
      },
      { status: 500 },
    );
  }
}
