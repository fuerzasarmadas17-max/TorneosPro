import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Verify checksum
    const eventSecret = process.env.WOMPI_EVENT_SECRET;
    if (!eventSecret) {
      console.error("WOMPI_EVENT_SECRET not configured");
      return NextResponse.json({ error: "Config error" }, { status: 500 });
    }

    const properties = body.signature?.properties as string[] | undefined;
    const checksum = body.signature?.checksum as string | undefined;
    const transaction = body.data?.transaction;

    if (!properties || !checksum || !transaction) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Build string from properties, append timestamp + secret
    const propertyValues = properties.map((prop) => {
      const parts = prop.split(".");
      let value: unknown = body.data;
      for (const part of parts) {
        value = (value as Record<string, unknown>)?.[part];
      }
      return String(value ?? "");
    });

    const checksumInput =
      propertyValues.join("") + String(body.timestamp) + eventSecret;
    const computedChecksum = crypto
      .createHash("sha256")
      .update(checksumInput)
      .digest("hex");

    if (computedChecksum !== checksum) {
      console.error("Webhook checksum mismatch");
      return NextResponse.json({ error: "Invalid checksum" }, { status: 401 });
    }

    // 2. Find payment by reference
    const { data: payment, error: fetchError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("reference", transaction.reference)
      .single();

    if (fetchError || !payment) {
      console.error("Payment not found for reference:", transaction.reference);
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // 3. Map Wompi status to our enum
    const statusMap: Record<string, string> = {
      APPROVED: "approved",
      DECLINED: "declined",
      VOIDED: "voided",
      ERROR: "error",
    };
    const newStatus = statusMap[transaction.status] || "error";

    // 4. Update payment record
    await supabaseAdmin
      .from("payments")
      .update({
        status: newStatus,
        wompi_transaction_id: transaction.id,
        wompi_status: transaction.status,
        payment_method: transaction.payment_method_type,
      })
      .eq("id", payment.id);

    // 5. If APPROVED, handle recovery paths
    if (newStatus === "approved") {
      const tournamentData = payment.tournament_data as Record<string, unknown> | null;

      if (tournamentData?.type === "upgrade" && tournamentData.tournamentId) {
        // Upgrade: update existing tournament tier/price
        await handleTierUpgrade(payment, tournamentData);
      } else if (!payment.tournament_id) {
        // New tournament creation (recovery path)
        await createTournamentFromPayment(payment);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function handleTierUpgrade(
  payment: Record<string, unknown>,
  tournamentData: Record<string, unknown>
) {
  const tournamentId = tournamentData.tournamentId as string;

  try {
    // Update tournament tier and price
    await supabaseAdmin
      .from("tournaments")
      .update({
        tier: tournamentData.newTier,
        price: tournamentData.newPrice,
        plan: "paid",
      })
      .eq("id", tournamentId);

    // Link payment to tournament
    await supabaseAdmin
      .from("payments")
      .update({ tournament_id: tournamentId })
      .eq("id", payment.id);

    // Create and link new teams if needed (recovery path)
    const teamsToAdd = (tournamentData.teamsToAdd as number) || 0;
    const isIndividual = tournamentData.isIndividual as boolean;
    const currentCount = (tournamentData.currentCount as number) || 0;

    if (teamsToAdd > 0) {
      const dbTeamIds: string[] = [];
      for (let i = 0; i < teamsToAdd; i++) {
        const { data: teamRow } = await supabaseAdmin
          .from("teams")
          .insert({
            name: isIndividual
              ? `Jugador ${currentCount + i + 1}`
              : `Equipo ${currentCount + i + 1}`,
          })
          .select("id")
          .single();
        if (teamRow) dbTeamIds.push(teamRow.id);
      }

      if (dbTeamIds.length > 0) {
        await supabaseAdmin.from("tournament_teams").insert(
          dbTeamIds.map((teamId: string) => ({
            tournament_id: tournamentId,
            team_id: teamId,
          }))
        );
      }
    }

    console.log(
      `Tournament ${tournamentId} upgraded to ${tournamentData.newTier} from webhook for payment ${payment.id}`
    );
  } catch (err) {
    console.error("Error upgrading tournament from webhook:", err);
  }
}

async function createTournamentFromPayment(
  payment: Record<string, unknown>
) {
  const tournamentData = payment.tournament_data as Record<string, unknown>;
  if (!tournamentData) {
    console.error("No tournament data in payment", payment.id);
    return;
  }

  try {
    // Insert tournament
    const { data: inserted, error } = await supabaseAdmin
      .from("tournaments")
      .insert({
        name: tournamentData.name,
        sport: tournamentData.sport,
        format: tournamentData.format,
        plan: "paid",
        status: "upcoming",
        description: tournamentData.description || null,
        created_by: payment.user_id,
        start_date: tournamentData.startDate,
        group_stage_complete: false,
        double_round_robin: false,
        max_players_per_team: null,
        best_of: tournamentData.bestOf || null,
        price: payment.amount_cop,
        tier: (tournamentData.tier as string) || null,
        enabled_stats: tournamentData.enabledStats || "{}",
        coupon_id: payment.coupon_id || null,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error("Failed to create tournament from webhook:", error);
      return;
    }

    const tournamentId = inserted.id;

    // Link tournament to payment
    await supabaseAdmin
      .from("payments")
      .update({ tournament_id: tournamentId })
      .eq("id", payment.id);

    // Mark coupon as used
    if (payment.coupon_id) {
      await supabaseAdmin
        .from("coupons")
        .update({
          used_by: payment.user_id,
          used_at: new Date().toISOString(),
          tournament_id: tournamentId,
        })
        .eq("id", payment.coupon_id);
    }

    // Create teams (they weren't created before payment)
    const teamCount = (tournamentData.teamCount as number) || 0;
    const isIndividual = tournamentData.isIndividual as boolean;
    const dbTeamIds: string[] = [];

    if (teamCount > 0) {
      for (let i = 0; i < teamCount; i++) {
        const { data: teamRow } = await supabaseAdmin
          .from("teams")
          .insert({
            name: isIndividual ? `Jugador ${i + 1}` : `Equipo ${i + 1}`,
          })
          .select("id")
          .single();
        if (teamRow) dbTeamIds.push(teamRow.id);
      }

      // Link teams to tournament
      if (dbTeamIds.length > 0) {
        await supabaseAdmin.from("tournament_teams").insert(
          dbTeamIds.map((teamId: string) => ({
            tournament_id: tournamentId,
            team_id: teamId,
          }))
        );
      }
    }

    // Insert groups and distribute teams
    const groups = tournamentData.groups as
      | Array<{ name: string }>
      | undefined;
    if (groups && groups.length > 0 && dbTeamIds.length > 0) {
      for (let gIdx = 0; gIdx < groups.length; gIdx++) {
        const { data: groupRow } = await supabaseAdmin
          .from("tournament_groups")
          .insert({
            tournament_id: tournamentId,
            name: groups[gIdx].name,
          })
          .select("id")
          .single();

        if (groupRow) {
          // Distribute teams round-robin across groups
          const groupTeamIds = dbTeamIds.filter((_, i) => i % groups.length === gIdx);
          if (groupTeamIds.length > 0) {
            await supabaseAdmin.from("tournament_group_teams").insert(
              groupTeamIds.map((teamId: string) => ({
                group_id: groupRow.id,
                team_id: teamId,
              }))
            );
          }
        }
      }
    }

    // Insert playoff config
    const playoffConfig = tournamentData.playoffConfig as
      | { advancePerGroup: number; totalAdvancing: number }
      | undefined;
    if (playoffConfig) {
      await supabaseAdmin.from("playoff_configs").insert({
        tournament_id: tournamentId,
        advance_per_group: playoffConfig.advancePerGroup,
        total_advancing: playoffConfig.totalAdvancing,
      });
    }

    console.log(
      `Tournament ${tournamentId} created from webhook for payment ${payment.id}`
    );
  } catch (err) {
    console.error("Error creating tournament from webhook:", err);
  }
}
