"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Trophy, Eye, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { whatsappAyudaUrl } from "@/lib/whatsapp";

// Si cierra el modal sin contestar, no se le vuelve a poner en la cara en el
// mismo navegador. Preferible perder una respuesta que hacerlo sentir
// perseguido; la pregunta sigue viva para el resto de los usuarios.
const DISMISS_KEY = "tp_bienvenida_cerrada";

/**
 * Modal de bienvenida con UNA pregunta: ¿a qué viniste?
 *
 * POR QUÉ EXISTE
 * En agosto de 2026 se registraron 22 personas y 20 no hicieron absolutamente
 * nada. No se sabía si eran organizadores que se trabaron o espectadores que
 * llegaron por el link de WhatsApp de un torneo. Son dos problemas opuestos y
 * se arreglan al revés, así que primero hay que saber cuál se tiene.
 *
 * La respuesta se guarda con `set_signup_intent`, que es la única forma de
 * escribir en `users` sin abrirle a nadie el permiso de editarse a sí mismo
 * (con ese permiso, cualquiera podría ponerse rol de administrador).
 */
export function WelcomeDialog() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"pregunta" | "organizador">("pregunta");

  useEffect(() => {
    if (!user?.id) return;
    let cancelado = false;

    (async () => {
      try {
        if (localStorage.getItem(DISMISS_KEY)) return;
      } catch {
        // Navegador con el almacenamiento bloqueado: seguimos igual.
      }

      const { data, error } = await supabase
        .from("users")
        .select("signup_intent")
        .eq("id", user.id)
        .maybeSingle();

      // Si la consulta falla —típicamente porque la migración todavía no se
      // corrió y la columna no existe— NO se muestra nada. Es preferible que
      // el modal llegue tarde a que se le aparezca a todo el mundo sin poder
      // guardar la respuesta.
      if (cancelado || error || !data) return;
      if (!data.signup_intent) setOpen(true);
    })();

    return () => {
      cancelado = true;
    };
  }, [user?.id]);

  const guardar = async (intent: "organizar" | "ver") => {
    // Sin await bloqueante: la respuesta del usuario no puede quedar esperando
    // a la red. Si falla, se pierde el dato pero no la experiencia.
    supabase.rpc("set_signup_intent", { p_intent: intent }).then(({ error }) => {
      if (error) console.error("No se pudo guardar la intención:", error.message);
    });
  };

  const cerrar = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Sin almacenamiento, vuelve a preguntar la próxima vez. Aceptable.
    }
    setOpen(false);
  };

  const elegirOrganizar = () => {
    guardar("organizar");
    setStep("organizador");
  };

  const elegirVer = () => {
    guardar("ver");
    cerrar();
    router.push("/tournaments");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : cerrar())}>
      <DialogContent className="sm:max-w-md">
        {step === "pregunta" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                ¡Bienvenido a Torneos Pro! 🏆
              </DialogTitle>
              <DialogDescription>
                Antes de arrancar, cuéntanos algo rápido para no hacerte perder
                tiempo.
              </DialogDescription>
            </DialogHeader>

            <p className="pt-1 text-sm font-medium">¿Qué te trae por acá?</p>

            <div className="flex flex-col gap-2">
              <Button
                className="h-auto w-full justify-start gap-3 py-3 text-left"
                onClick={elegirOrganizar}
              >
                <Trophy className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>
                  Quiero organizar un torneo
                  <span className="block text-xs font-normal opacity-80">
                    Armar el fixture, cargar resultados, la tabla
                  </span>
                </span>
              </Button>

              <Button
                variant="outline"
                className="h-auto w-full justify-start gap-3 py-3 text-left"
                onClick={elegirVer}
              >
                <Eye className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>
                  Vine a ver un torneo
                  <span className="block text-xs font-normal text-muted-foreground">
                    Resultados, posiciones, estadísticas
                  </span>
                </span>
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                Te acompañamos a armar el primero 💪
              </DialogTitle>
              <DialogDescription>
                Si algo no te cuadra, escríbenos por WhatsApp y lo resolvemos en
                el momento. No estás solo en esto.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Button
                className="w-full gap-2"
                onClick={() => {
                  cerrar();
                  router.push("/tournaments/create");
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Crear mi primer torneo
              </Button>

              <Button asChild variant="outline" className="w-full gap-2">
                <a
                  href={whatsappAyudaUrl(user?.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={cerrar}
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Escribirnos por WhatsApp
                </a>
              </Button>

              <Button variant="ghost" className="w-full" onClick={cerrar}>
                Después
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
