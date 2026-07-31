import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/admin/require-admin";

/**
 * POST /api/admin/tournaments/[id]/featured  { featured: boolean }
 *
 * Destaca (o deja de destacar) un torneo en la portada.
 *
 * Va por una ruta de servidor y no por el cliente de Supabase del navegador
 * por dos motivos que se suman:
 *
 * 1. La policy "Creador edita torneo" solo deja actualizar torneos propios,
 *    así que un admin no podría marcar el torneo de otro organizador desde
 *    el browser.
 * 2. El trigger `guard_tournament_featured` exige admin o service_role.
 *    Acá `requireAdmin` verifica el token antes de usar el service_role.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body?.featured !== "boolean") {
    return NextResponse.json(
      { error: "Falta 'featured' (booleano)" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("tournaments")
    .update({ featured: body.featured })
    .eq("id", id);

  if (error) {
    console.error("featured update error:", error);
    // El caso más probable acá es que la migración todavía no se corrió y la
    // columna no existe. Se dice explícito para no perder tiempo buscando.
    return NextResponse.json(
      { error: error.message || "No se pudo actualizar el destacado" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, featured: body.featured });
}
