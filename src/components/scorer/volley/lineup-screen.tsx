"use client";

/**
 * Paso 2 de la planilla: la rotación de arranque, un equipo por vez.
 *
 * Las posiciones se dibujan como se ven parado detrás de la línea de fondo:
 * arriba la red, abajo el fondo, y la 1 abajo a la derecha porque es la que
 * saca. Es el orden que la mesa tiene enfrente, no una lista del uno al seis —
 * con la lista hay que traducir en la cabeza, y traducir en la cancha es
 * equivocarse.
 *
 * Cuántas casillas se dibujan sale del torneo (4, 5 o 6 por equipo), no de un
 * número fijo.
 *
 * DESPUÉS DE ESTO NO SE TOCA MÁS LA ROTACIÓN EN TODO EL SET: la app rota sola
 * cuando el equipo que recibe gana el punto. Es lo que hace que los que están en
 * cancha nunca se desincronicen del marcador, porque salen del mismo dato.
 */

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type Alineacion,
  type Etiqueta,
  filasDeLaCancha,
  huecos,
  indiceDePosicion,
} from "@/lib/volley/planilla";

interface Props {
  tituloArriba: string;
  teamName: string;
  jugadoresEnCancha: number;
  /** Todos los que pueden entrar hoy, de este equipo. */
  nomina: Etiqueta[];
  alineacion: Alineacion;
  onChange: (alineacion: Alineacion) => void;
  onBack: () => void;
  onContinuar: () => void;
  /** Texto del botón grande: cambia si falta el otro equipo. */
  textoContinuar: string;
}

export function LineupScreen({
  tituloArriba,
  teamName,
  jugadoresEnCancha,
  nomina,
  alineacion,
  onChange,
  onBack,
  onContinuar,
  textoContinuar,
}: Props) {
  const { frente, fondo } = filasDeLaCancha(jugadoresEnCancha);

  // La posición que está esperando jugador. Arranca en la primera vacía.
  const primeraVacia = () => {
    const i = alineacion.findIndex((e) => e === null);
    return i < 0 ? null : i + 1;
  };
  const [posicionActiva, setPosicionActiva] = useState<number | null>(primeraVacia);

  const ubicados = new Set(alineacion.filter((e): e is Etiqueta => e !== null));
  const sinUbicar = nomina.filter((e) => !ubicados.has(e));
  const faltan = huecos(alineacion);

  const ubicar = (etiqueta: Etiqueta) => {
    if (posicionActiva === null) return;
    const siguiente = [...alineacion];
    siguiente[indiceDePosicion(posicionActiva)] = etiqueta;
    onChange(siguiente);
    // Saltar sola a la próxima vacía: así se ubica tocando jugador, jugador,
    // jugador, sin tener que elegir la posición cada vez.
    const i = siguiente.findIndex((e) => e === null);
    setPosicionActiva(i < 0 ? null : i + 1);
  };

  const tocarPosicion = (posicion: number) => {
    const ocupada = alineacion[indiceDePosicion(posicion)];
    if (ocupada !== null) {
      // Sacar al que estaba: vuelve a la lista de sin ubicar y la posición
      // queda esperando.
      const siguiente = [...alineacion];
      siguiente[indiceDePosicion(posicion)] = null;
      onChange(siguiente);
    }
    setPosicionActiva(posicion);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{tituloArriba}</p>
          <h1 className="truncate font-semibold">Rotación de {teamName}</h1>
        </div>
        <span className="shrink-0 rounded-full border px-3 py-1 text-sm text-muted-foreground">
          Paso 2 de 2
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div>
          <h2 className="text-2xl font-bold">¿Quiénes arrancan y dónde?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tocá una posición y elegí el jugador. La{" "}
            <span className="font-semibold text-foreground">1</span> es la que
            saca primero.
          </p>
        </div>

        {/* La cancha */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 border-t border-dashed" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Red
            </span>
            <div className="h-px flex-1 border-t border-dashed" />
          </div>

          <Fila
            posiciones={frente}
            alineacion={alineacion}
            posicionActiva={posicionActiva}
            onTocar={tocarPosicion}
          />
          <Fila
            posiciones={fondo}
            alineacion={alineacion}
            posicionActiva={posicionActiva}
            onTocar={tocarPosicion}
          />
        </div>

        {/* Los que faltan por ubicar */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Sin ubicar
            {posicionActiva !== null && ` · tocá uno para la pos ${posicionActiva}`}
          </p>
          {sinUbicar.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {sinUbicar.map((e) => (
                <button
                  key={e}
                  type="button"
                  disabled={posicionActiva === null}
                  onClick={() => ubicar(e)}
                  className="h-14 min-w-14 rounded-lg border bg-card px-4 text-xl font-bold transition-colors hover:bg-accent disabled:opacity-40"
                >
                  {e}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ya están todos ubicados.
            </p>
          )}
        </div>

        <div className="mt-auto space-y-3">
          {faltan > 0 && (
            <div className="rounded-lg border border-primary/50 bg-primary/10 p-3 text-sm">
              <span className="font-semibold">
                {teamName} va a empezar con {jugadoresEnCancha - faltan} de{" "}
                {jugadoresEnCancha}.
              </span>{" "}
              La posición vacía rota como una más. Si llega el que falta, se
              agrega desde el marcador sin gastar cambio.
            </div>
          )}
          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            Los que queden sin ubicar van al{" "}
            <span className="font-semibold text-foreground">banco</span> y entran
            por cambio. Después de esto no hay que tocar la rotación en todo el
            set:{" "}
            <span className="font-semibold text-foreground">la app rota sola</span>{" "}
            cuando el equipo que recibe gana el punto.
          </div>
        </div>
      </div>

      <footer className="flex gap-2 border-t p-4">
        <Button variant="outline" className="h-14 flex-1 text-base" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Atrás
        </Button>
        <Button
          className="h-14 flex-[2] text-base"
          disabled={faltan === jugadoresEnCancha}
          onClick={onContinuar}
        >
          {textoContinuar}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </footer>
    </div>
  );
}

function Fila({
  posiciones,
  alineacion,
  posicionActiva,
  onTocar,
}: {
  posiciones: number[];
  alineacion: Alineacion;
  posicionActiva: number | null;
  onTocar: (posicion: number) => void;
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${posiciones.length}, minmax(0, 1fr))` }}
    >
      {posiciones.map((pos) => {
        const etiqueta = alineacion[indiceDePosicion(pos)];
        const activa = posicionActiva === pos;
        const saca = pos === 1;
        return (
          <button
            key={pos}
            type="button"
            onClick={() => onTocar(pos)}
            className={`flex h-28 flex-col items-center justify-center gap-1 rounded-xl border-2 transition-colors ${
              activa ? "border-primary bg-primary/5" : "border-border bg-card"
            }`}
          >
            <span
              className={`text-xs uppercase tracking-widest ${
                saca ? "text-primary" : "text-muted-foreground"
              }`}
            >
              Pos {pos}
              {saca && " · saca"}
            </span>
            {etiqueta ? (
              <span className="text-3xl font-bold">{etiqueta}</span>
            ) : (
              <span className="h-1 w-6 rounded bg-muted-foreground/40" />
            )}
          </button>
        );
      })}
    </div>
  );
}
