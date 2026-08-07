import { supabase } from "@/lib/supabase";

/**
 * Cabecera `Authorization` para las rutas propias que validan el token en el
 * servidor (`requireAdmin` y compañía).
 *
 * ⚠️ Por qué no alcanza con `getSession()`
 *
 * `getSession()` lee la sesión de `localStorage` y **puede devolver un token ya
 * vencido**: el refresco automático corre en un temporizador y los navegadores
 * lo frenan en pestañas de fondo. Una pestaña abierta un rato largo termina
 * mandando un token muerto, y la ruta responde 401 "Unauthorized" — con el
 * usuario perfectamente logueado y sin entender por qué.
 *
 * Acá se mira el vencimiento antes de mandar y se refresca si hace falta. Es la
 * diferencia entre "no tenés permiso" y "tu token venció hace 3 minutos".
 *
 * Devuelve `{}` si de verdad no hay sesión; quien llama debe tratar eso como
 * "hay que volver a entrar", no como un error del servidor.
 */

/** Margen antes del vencimiento. Cubre la latencia de la petición en 4G. */
const REFRESH_MARGIN_MS = 60_000;

export async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  let session = data.session;

  const expiresInMs =
    session?.expires_at != null
      ? session.expires_at * 1000 - Date.now()
      : null;

  if (session && (expiresInMs == null || expiresInMs < REFRESH_MARGIN_MS)) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    // Si el refresco falla se manda el token viejo igual: puede que todavía
    // sirva, y un 401 del servidor es mejor diagnóstico que no intentar.
    session = refreshed.session ?? session;
  }

  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
