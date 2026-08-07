import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * Server-side admin guard. The client must send the user's Supabase access
 * token in the `Authorization: Bearer <token>` header. Returns the userId on
 * success, or a 401/403 NextResponse the route should return as-is.
 *
 * Verification is done against the project's anon key (so the JWT signature
 * is validated by Supabase) plus a role lookup in `users` via the service
 * role (bypasses RLS to read the role reliably).
 */
export async function requireAdmin(
  request: NextRequest
): Promise<{ userId: string } | NextResponse> {
  // Los tres motivos de rechazo se distinguen en el mensaje a propósito. Con un
  // "Unauthorized" genérico, un token vencido, una cuenta sin permisos y una
  // variable de entorno faltante se ven todos igual desde el navegador, y no
  // hay forma de saber cuál fue sin instrumentar el servidor.
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json(
      { error: "No hay sesión. Vuelve a iniciar sesión." },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Config error" }, { status: 500 });
  }

  // Validate the JWT and get the user. createClient is cheap; this happens
  // once per admin request.
  const validator = createClient(supabaseUrl, anonKey);
  const { data: userResp, error: authError } = await validator.auth.getUser(token);
  if (authError || !userResp?.user) {
    return NextResponse.json(
      { error: "Tu sesión venció. Vuelve a iniciar sesión." },
      { status: 401 }
    );
  }

  // Look up the role via service role so RLS doesn't get in the way.
  const { data: row, error: roleError } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", userResp.user.id)
    .single();

  // Que la consulta FALLE no es lo mismo que "no sos admin": lo primero suele
  // ser la service key mal cargada en el servidor, y devolverlo como "no tenés
  // permiso" manda a buscar el problema en la cuenta equivocada.
  if (roleError) {
    console.error("requireAdmin: no se pudo leer el rol", roleError);
    return NextResponse.json(
      { error: "No se pudo verificar tu rol. Es un problema del servidor." },
      { status: 500 }
    );
  }

  if (row?.role !== "admin") {
    return NextResponse.json(
      { error: "Tu cuenta no es de administrador." },
      { status: 403 }
    );
  }

  return { userId: userResp.user.id };
}
