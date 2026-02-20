import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { paymentId, tournamentId } = await request.json();

    if (!paymentId || !tournamentId) {
      return NextResponse.json(
        { error: "Missing paymentId or tournamentId" },
        { status: 400 }
      );
    }

    await supabaseAdmin
      .from("payments")
      .update({ tournament_id: tournamentId })
      .eq("id", paymentId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Link tournament error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
