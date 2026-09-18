import { NextRequest, NextResponse } from "next/server";
import { requireTournamentOwner } from "@/lib/scorer/auth";
import { computeCupsQuote } from "@/lib/payments/cups";

// Solo lectura: cuánto cuesta prender las copas en este torneo, para mostrarle
// el aviso del recargo al organizador antes de que guarde.
export async function POST(request: NextRequest) {
  try {
    const { tournamentId } = await request.json();
    if (!tournamentId) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }
    const owner = await requireTournamentOwner(request, tournamentId);
    if (owner instanceof NextResponse) return owner;

    const quote = await computeCupsQuote(tournamentId);
    if (!quote) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }
    return NextResponse.json(quote);
  } catch (err) {
    console.error("cups-quote error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
