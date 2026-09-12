"use client";

/**
 * La pantalla de cambio. Se abre desde el "Cambio" del lado de un equipo, así
 * que ya sabe de qué equipo es: nunca hay que preguntarlo primero.
 *
 * Dos pasos en una sola pantalla: quién sale, de los que están en cancha, y
 * quién entra, de la banca. El botón de confirmar dice el cambio completo en
 * palabras, "Entra el 8 por el 9", para que se lea antes de apretar.
 *
 * TRES REGLAS QUE LA PANTALLA RESPETA:
 *
 * 1. Un jugador puede identificarse con una letra. Por eso la casilla es
 *    cuadrada y centrada, igual de cómoda para una "A" que para un "12".
 *
 * 2. Dentro del set, un cambio ata a los dos jugadores: si el 6 entró por el 4,
 *    hasta que termine el set esos dos solo deberían entrar y salir entre ellos.
 *    La pantalla lo AVISA y no lo bloquea (decisión del dueño, 2026-09-12): hay
 *    ligas de barrio que no aplican la regla, y una planilla que le dice "no" a
 *    la mesa en media cancha es peor que una que le avisa. Por eso el jugador
 *    atado se muestra con su motivo escrito y se puede elegir igual, con la
 *    advertencia a la vista antes de confirmar.
 *
 * 3. Completar una posición vacía NO es un cambio: no gasta cambio y no ata a
 *    nadie. Es el que llegó tarde, y desde acá también se lo puede agregar a la
 *    lista sin volver al principio.
 *
 * De pie la hoja sube desde abajo, que es donde llega el pulgar. Acostado va
 * centrada, porque el borde inferior queda tapado por las manos que sostienen
 * el aparato.
 */

import { useState } from "react";
import { X, TriangleAlert, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Teclado, Visor } from "./teclado";
import {
  type Etiqueta,
  type EstadoDelSet,
  type Evento,
  type Lado,
  type Planilla,
  enElBanco,
  indiceDePosicion,
  filasDeLaCancha,
  normalizarEtiqueta,
  validarEtiqueta,
} from "@/lib/volley/planilla";

interface Props {
  lado: Lado;
  teamName: string;
  planilla: Planilla;
  estado: EstadoDelSet;
  onConfirmar: (evento: Evento) => void;
  onAgregarALaNomina: (etiqueta: Etiqueta) => void;
  onCerrar: () => void;
}

/** Lo que sale: un jugador que está en cancha, o una posición que quedó vacía. */
type Sale =
  | { tipo: "jugador"; etiqueta: Etiqueta; posicion: number }
  | { tipo: "vacia"; posicion: number };

export function CambioSheet({
  lado,
  teamName,
  planilla,
  estado,
  onConfirmar,
  onAgregarALaNomina,
  onCerrar,
}: Props) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [entra, setEntra] = useState<Etiqueta | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [buffer, setBuffer] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cancha = estado.enCancha[lado];
  const banco = enElBanco(planilla, estado, lado);
  const { frente, fondo } = filasDeLaCancha(planilla.jugadoresEnCancha);
  const posiciones = [...frente, ...fondo];

  // El que entra puede estar atado a otro por un cambio anterior del set.
  const atadoDe = (etiqueta: Etiqueta): Etiqueta | undefined =>
    estado.atados[lado][etiqueta];

  const avisoDeAtadura =
    entra && sale?.tipo === "jugador" && atadoDe(entra) && atadoDe(entra) !== sale.etiqueta
      ? `El ${entra} entró por el ${atadoDe(entra)} en este set. En la mayoría de las ligas solo puede volver por él.`
      : null;

  const confirmar = () => {
    if (!sale || !entra) return;
    if (sale.tipo === "vacia") {
      onConfirmar({ t: "completar", equipo: lado, posicion: sale.posicion, entra });
    } else {
      onConfirmar({ t: "cambio", equipo: lado, sale: sale.etiqueta, entra });
    }
    onCerrar();
  };

  const agregar = () => {
    const etiqueta = normalizarEtiqueta(buffer);
    const err = validarEtiqueta(etiqueta, planilla.nomina[lado]);
    if (err) {
      setError(err);
      return;
    }
    onAgregarALaNomina(etiqueta);
    setEntra(etiqueta);
    setBuffer("");
    setError(null);
    setAgregando(false);
  };

  const frase =
    sale && entra
      ? sale.tipo === "vacia"
        ? `Entra el ${entra} en la posición ${sale.posicion}`
        : `Entra el ${entra} por el ${sale.etiqueta}`
      : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 landscape:justify-center landscape:p-4">
      <div className="max-h-[92vh] overflow-y-auto rounded-t-2xl border-t bg-background p-4 landscape:mx-auto landscape:w-full landscape:max-w-3xl landscape:rounded-2xl landscape:border">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">Cambio de {teamName}</h2>
            <p className="text-sm text-muted-foreground">
              {estado.cambiosHechos[lado] > 0
                ? `${estado.cambiosHechos[lado]} en este set`
                : "Primer cambio del set"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onCerrar} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {agregando ? (
          /* ---------------------------------------- agregar al que llegó tarde */
          <div className="space-y-3">
            <p className="font-semibold">¿Qué número trae el que llegó?</p>
            <div className="flex gap-2">
              <Visor texto={buffer} />
              <Button className="h-14 px-6" disabled={!buffer} onClick={agregar}>
                Agregar
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Teclado
              onTecla={(t) => {
                setError(null);
                setBuffer((b) => (b.length >= 3 ? b : b + t));
              }}
              onBorrar={() => setBuffer((b) => b.slice(0, -1))}
            />
            <Button
              variant="outline"
              className="h-12 w-full"
              onClick={() => {
                setAgregando(false);
                setBuffer("");
                setError(null);
              }}
            >
              Volver al cambio
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* ------------------------------------------------ quién sale */}
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                1 · Quién sale
              </p>
              <div className="flex flex-wrap gap-2">
                {posiciones.map((pos) => {
                  const etiqueta = cancha[indiceDePosicion(pos)];
                  const elegido =
                    sale?.posicion === pos &&
                    (etiqueta ? sale.tipo === "jugador" : sale.tipo === "vacia");
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() =>
                        setSale(
                          etiqueta
                            ? { tipo: "jugador", etiqueta, posicion: pos }
                            : { tipo: "vacia", posicion: pos }
                        )
                      }
                      className={`flex h-16 w-16 flex-col items-center justify-center rounded-lg border-2 transition-colors ${
                        elegido ? "border-primary bg-primary/10" : "border-border bg-card"
                      }`}
                    >
                      <span className="text-[10px] uppercase text-muted-foreground">
                        Pos {pos}
                      </span>
                      <span className="text-xl font-bold">
                        {etiqueta ?? <span className="text-muted-foreground/50">—</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              {sale?.tipo === "vacia" && (
                <p className="text-sm text-muted-foreground">
                  La posición {sale.posicion} está vacía. Completarla no gasta
                  cambio y no ata a nadie.
                </p>
              )}
            </div>

            {/* ------------------------------------------------ quién entra */}
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                2 · Quién entra
              </p>
              {banco.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No hay nadie en el banco.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {banco.map((e) => {
                  const atado = atadoDe(e);
                  const elegido = entra === e;
                  return (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEntra(e)}
                      className={`flex min-w-16 flex-col items-center justify-center rounded-lg border-2 px-3 py-2 transition-colors ${
                        elegido ? "border-primary bg-primary/10" : "border-border bg-card"
                      }`}
                    >
                      <span className="text-xl font-bold">{e}</span>
                      {atado && (
                        <span className="text-[10px] text-muted-foreground">
                          solo por el {atado}
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setAgregando(true)}
                  className="flex min-w-16 flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-2 text-muted-foreground"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-[10px]">Llegó tarde</span>
                </button>
              </div>
            </div>

            {avisoDeAtadura && (
              <div className="flex gap-2 rounded-lg border border-primary/50 bg-primary/10 p-3 text-sm">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>{avisoDeAtadura} Si en tu liga se puede, seguí igual.</p>
              </div>
            )}

            <Button
              className="h-14 w-full text-base"
              disabled={!sale || !entra}
              onClick={confirmar}
            >
              {frase ?? "Elegí quién sale y quién entra"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
