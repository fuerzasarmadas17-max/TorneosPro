import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Verifica el token del usuario y devuelve su id, o la respuesta 401 que la
 * ruta debe devolver tal cual.
 *
 * Es el hermano sin privilegios de `requireAdmin`: sirve para rutas que
 * cualquier usuario logueado puede llamar, pero donde el servidor **no puede
 * confiar en el `userId` que mande el cliente**. Un `userId` que viaja en el
 * body es un `userId` que el navegador puede cambiar — y en una ruta que crea
 * cobros, eso significa comprarle un paquete a otra cuenta.
 */
export async function requireUser(
  request: NextRequest
): Promise<{ userId: string } | NextResponse> {
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

  const validator = createClient(supabaseUrl, anonKey);
  const { data, error } = await validator.auth.getUser(token);
  if (error || !data?.user) {
    return NextResponse.json(
      { error: "Tu sesión venció. Vuelve a iniciar sesión." },
      { status: 401 }
    );
  }

  return { userId: data.user.id };
}
