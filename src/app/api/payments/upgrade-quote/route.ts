import { NextRequest, NextResponse } from "next/server";
import { computeUpgradeQuote } from "@/lib/payments/upgrade";

// Read-only: returns the upgrade cost (honoring the original bono) for display.
export async function POST(request: NextRequest) {
  try {
    const { tournamentId, addCount } = await request.json();
    if (!tournamentId || !addCount || Number(addCount) < 1) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    const quote = await computeUpgradeQuote(tournamentId, Number(addCount));
    if (!quote) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    return NextResponse.json(quote);
  } catch (err) {
    console.error("upgrade-quote error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
