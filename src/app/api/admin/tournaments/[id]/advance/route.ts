import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { advanceTournament, AdvanceMode } from "@/lib/admin/server-advance";

// POST /api/admin/tournaments/[id]/advance
// Admin-only: generates random results for the next pending jornada (or whole
// phase) of the tournament, then runs the cascade (winner propagation,
// phase / playoff bracket generation, status update) server-side.
//
// Body: { mode: "jornada" | "phase" }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let mode: AdvanceMode;
  try {
    const body = await request.json();
    if (body?.mode !== "jornada" && body?.mode !== "phase") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }
    mode = body.mode;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const result = await advanceTournament(id, mode);
    return NextResponse.json(result);
  } catch (err) {
    console.error("advance error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
