"use client";

/**
 * La pantalla del marcador: la que la mesa mira todo el partido.
 *
 * De las tres propuestas quedó la del marcador grande: el marcador manda y los
 * botones de punto son enormes, para usarla sin mirar mucho.
 *
 * DE PIE Y ACOSTADO SON DOS DIBUJOS DISTINTOS, no el mismo encogido. Acostado
 * no hay alto para apilar y sí hay ancho de sobra, así que:
 *
 *   - Cada equipo se lleva un lado entero, y todo ese lado es su botón de
 *     punto. Cae justo donde apoyan los pulgares al sostener el aparato con las
 *     dos manos: se toca el lado del que anotó, sin apuntar.
 *   - El marcador y la rotación de cada equipo viven en su propio lado. No hay
 *     forma de confundir a quién le estás sumando.
 *   - El centro es lo que se mira y no se toca: los sets, quién saca y los
 *     últimos puntos.
 *   - Los botones de acción van en el centro y NO abajo de todo: acostado, el
 *     borde inferior es donde descansan los pulgares que están tocando los
 *     lados, y ahí un "Cerrar set" se aprieta sin querer.
 *
 * Por eso hay dos árboles de JSX y no uno solo con clases. Comparten las piezas
 * chicas, que es donde estaría la duplicación que importa.
 */

import { useState } from "react";
import { Smartphone, Undo2, ChevronLeft, ArrowLeftRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type Etiqueta,
  type EstadoDelSet,
  type Lado,
  type LineaDelHistorial,
  type Planilla,
  TIEMPOS_POR_SET,
  filasDeLaCancha,
  historial,
  indiceDePosicion,
} from "@/lib/volley/planilla";

interface Props {
  tituloArriba: string;
  planilla: Planilla;
  estado: EstadoDelSet;
  nombre: Record<Lado, string>;
  setsGanados: Record<Lado, number>;
  numeroDeSet: number;
  guardando: boolean;
  onPunto: (equipo: Lado) => void;
  onDeshacer: () => void;
  onCambio: (equipo: Lado) => void;
  onTiempo: (equipo: Lado) => void;
  onCerrarSet: () => void;
  /** Los equipos se cambiaron de cancha: se dibujan al revés. */
  onCambiarDeLado: () => void;
  onBack: () => void;
}

export function MarcadorScreen(props: Props) {
  const {
    tituloArriba,
    planilla,
    estado,
    nombre,
    setsGanados,
    numeroDeSet,
    guardando,
    onDeshacer,
    onCerrarSet,
    onCambiarDeLado,
    onBack,
  } = props;

  const lineas = planilla.setActual ? historial(planilla.setActual) : [];
  const ultimas = lineas.slice(-5).reverse();
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const hayQueDeshacer = lineas.length > 0;
  const sacador = estado.enCancha[estado.saca][0];
  // Cada equipo se dibuja del lado en que la mesa lo ve, no siempre el local a
  // la izquierda: en el set 2 cambian de cancha, y en el decisivo a mitad.
  const orden: Lado[] =
    estado.izquierda === "home" ? ["home", "away"] : ["away", "home"];
  const [izq, der] = orden;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{tituloArriba}</p>
          <h1 className="truncate font-semibold">Set {numeroDeSet}</h1>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs ${
            guardando
              ? "border-green-600/40 text-green-700 dark:text-green-500"
              : "text-muted-foreground"
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" />
          Guardado en el teléfono
        </span>
      </header>

      {/* ---------------------------------------------------------- De pie */}
      <div className="flex flex-1 flex-col gap-3 p-3 landscape:hidden">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Tanteador lado={izq} {...props} />
          <div className="flex flex-col items-center">
            <p className="text-2xl font-bold tabular-nums">
              {setsGanados[izq]} – {setsGanados[der]}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Sets
            </p>
            <button
              type="button"
              onClick={onCambiarDeLado}
              className="mt-1 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
              aria-label="Cambiar de lado"
            >
              <ArrowLeftRight className="h-3 w-3" />
              Lados
            </button>
          </div>
          <Tanteador lado={der} {...props} />
        </div>

        <p className="text-center text-sm text-primary">
          ● Saca {nombre[estado.saca]}
          {sacador ? ` — número ${sacador}` : ""}
        </p>

        <div className="grid flex-1 grid-cols-2 gap-3">
          {orden.map((l) => (
            <BotonPunto key={l} lado={l} {...props} />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {orden.map((l) => (
            <div key={l} className="space-y-2">
              <AccionesDelEquipo lado={l} {...props} />
              <p className="truncate text-xs uppercase tracking-widest text-muted-foreground">
                {nombre[l]} en cancha
              </p>
              <EnCancha lado={l} {...props} />
            </div>
          ))}
        </div>

        <UltimosPuntos
          lineas={ultimas}
          nombre={nombre}
          orden={orden}
          onAbrir={() => setHistorialAbierto(true)}
        />
      </div>

      {/* -------------------------------------------------------- Acostado */}
      <div className="hidden flex-1 gap-3 p-3 landscape:flex">
        {([izq, "center", der] as const).map((col) =>
          col === "center" ? (
            <div key={col} className="flex w-[30%] shrink-0 flex-col gap-2">
              <div className="rounded-xl border bg-card py-2 text-center">
                <p className="text-2xl font-bold tabular-nums">
                  {setsGanados[izq]} – {setsGanados[der]}
                </p>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Sets
                </p>
              </div>
              <p className="text-center text-sm text-primary">
                ● Saca {nombre[estado.saca]}
                {sacador ? ` — número ${sacador}` : ""}
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <UltimosPuntos
          lineas={ultimas}
          nombre={nombre}
          orden={orden}
          onAbrir={() => setHistorialAbierto(true)}
        />
              </div>
              {/* Las acciones van acá y no abajo de todo: acostado, el borde
                  inferior es donde descansan los pulgares. */}
              <Button
                variant="outline"
                className="h-10 w-full text-sm"
                onClick={onCambiarDeLado}
              >
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Cambiar de lado
              </Button>
              <Button
                variant="outline"
                className="h-12 w-full"
                disabled={!hayQueDeshacer}
                onClick={onDeshacer}
              >
                <Undo2 className="mr-2 h-4 w-4" />
                Deshacer
              </Button>
              <Button className="h-12 w-full" onClick={onCerrarSet}>
                Cerrar set
              </Button>
            </div>
          ) : (
            <div key={col} className="flex flex-1 flex-col gap-2">
              <p className="truncate text-center text-sm uppercase tracking-widest text-muted-foreground">
                {nombre[col]}
              </p>
              <BotonPunto lado={col} conMarcador {...props} />
              <AccionesDelEquipo lado={col} {...props} />
              <EnCancha lado={col} {...props} />
            </div>
          )
        )}
      </div>

      {/* Pie: solo de pie. Acostado las acciones están en el centro. */}
      <footer className="flex gap-2 border-t p-3 landscape:hidden">
        <Button
          variant="outline"
          className="h-14 flex-1 text-base"
          disabled={!hayQueDeshacer}
          onClick={onDeshacer}
        >
          <Undo2 className="mr-2 h-4 w-4" />
          Deshacer
        </Button>
        <Button className="h-14 flex-1 text-base" onClick={onCerrarSet}>
          Cerrar set
        </Button>
      </footer>

      <button
        type="button"
        onClick={onBack}
        className="flex items-center justify-center gap-1 border-t py-2 text-xs text-muted-foreground"
      >
        <ChevronLeft className="h-3 w-3" />
        Volver a los partidos (la planilla queda guardada)
      </button>

      {historialAbierto && (
        <HistorialDelSet
          numeroDeSet={numeroDeSet}
          lineas={lineas}
          nombre={nombre}
          orden={orden}
          onCerrar={() => setHistorialAbierto(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// Piezas
// ============================================================

function Tanteador({
  lado,
  estado,
  nombre,
}: Props & { lado: Lado }) {
  return (
    <div className="min-w-0 text-center">
      <p className="truncate text-xs uppercase tracking-widest text-muted-foreground">
        {nombre[lado]}
      </p>
      <p
        className={`text-6xl font-bold tabular-nums ${
          estado.saca === lado ? "text-primary" : ""
        }`}
      >
        {estado.puntos[lado]}
      </p>
    </div>
  );
}

/** El botón de punto. Acostado se lleva el lado entero y muestra adentro el
 *  marcador de su equipo, para que no haya que cruzar la pantalla. */
function BotonPunto({
  lado,
  estado,
  nombre,
  onPunto,
  conMarcador,
}: Props & { lado: Lado; conMarcador?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onPunto(lado)}
      className={`flex w-full flex-1 flex-col items-center justify-center gap-1 rounded-2xl border-2 transition-colors active:bg-primary/20 ${
        estado.saca === lado ? "border-primary" : "border-border"
      } bg-card`}
    >
      {conMarcador && (
        <span
          className={`text-7xl font-bold tabular-nums ${
            estado.saca === lado ? "text-primary" : ""
          }`}
        >
          {estado.puntos[lado]}
        </span>
      )}
      <span className="text-4xl font-light text-primary">+</span>
      <span className="px-2 text-center text-sm text-muted-foreground">
        Punto {nombre[lado]}
      </span>
    </button>
  );
}

/** Cambio y Tiempo: las dos acciones que son de un equipo y no del partido, así
 *  que viven del lado de su equipo. Los puntitos dicen cuántos tiempos quedan
 *  sin abrir nada. */
function AccionesDelEquipo({
  lado,
  estado,
  onCambio,
  onTiempo,
}: Props & { lado: Lado }) {
  const usados = estado.tiemposUsados[lado];
  const quedan = TIEMPOS_POR_SET - usados;
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="outline"
        className="h-11 w-full"
        onClick={() => onCambio(lado)}
        aria-label="Cambio"
      >
        <ArrowLeftRight className="h-5 w-5" />
      </Button>
      <Button
        variant="outline"
        className="h-11 w-full gap-1.5"
        disabled={quedan === 0}
        onClick={() => onTiempo(lado)}
        aria-label={`Tiempo, quedan ${quedan}`}
      >
        <span className="text-lg font-bold leading-none">T</span>
        <span className="flex flex-col gap-1">
          {Array.from({ length: TIEMPOS_POR_SET }, (_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full border border-primary ${
                i < quedan ? "bg-primary" : ""
              }`}
            />
          ))}
        </span>
      </Button>
    </div>
  );
}

/** Los que están en cancha, en el orden de la cancha: arriba la red. El que
 *  saca va resaltado. */
function EnCancha({
  lado,
  estado,
  planilla,
}: Props & { lado: Lado }) {
  const { frente, fondo } = filasDeLaCancha(planilla.jugadoresEnCancha);
  const cancha = estado.enCancha[lado];
  const saca = estado.saca === lado;
  return (
    <div className="space-y-1.5">
      {[frente, fondo].map((fila, i) => (
        <div
          key={i}
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${fila.length}, minmax(0, 1fr))` }}
        >
          {fila.map((pos) => (
            <Casilla
              key={pos}
              etiqueta={cancha[indiceDePosicion(pos)]}
              destacada={saca && pos === 1}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Casilla({
  etiqueta,
  destacada,
}: {
  etiqueta: Etiqueta | null;
  destacada: boolean;
}) {
  return (
    <div
      className={`flex h-12 items-center justify-center rounded-lg border text-xl font-bold ${
        destacada
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card"
      }`}
    >
      {etiqueta ?? <span className="text-muted-foreground/40">—</span>}
    </div>
  );
}

/** Los últimos puntos debajo del marcador. Todo el recuadro se toca para abrir
 *  el set entero. */
function UltimosPuntos({
  lineas,
  nombre,
  orden,
  onAbrir,
}: {
  lineas: LineaDelHistorial[];
  nombre: Record<Lado, string>;
  /** El marcador de cada línea va en el mismo orden que los lados. */
  orden: Lado[];
  onAbrir: () => void;
}) {
  if (lineas.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Todavía no se anotó ningún punto.
      </p>
    );
  }
  return (
    <button type="button" onClick={onAbrir} className="block w-full space-y-1 text-left">
      <span className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
        Últimos puntos
        <span className="flex items-center gap-1 normal-case tracking-normal text-primary">
          <History className="h-3.5 w-3.5" />
          Ver todo el set
        </span>
      </span>
      <span className="block divide-y rounded-lg border">
        {lineas.map((l) => (
          <Linea key={l.indice} linea={l} nombre={nombre} orden={orden} />
        ))}
      </span>
    </button>
  );
}

function Linea({
  linea: l,
  nombre,
  orden,
}: {
  linea: LineaDelHistorial;
  nombre: Record<Lado, string>;
  orden: Lado[];
}) {
  return (
    <span className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {l.puntos[orden[0]]} – {l.puntos[orden[1]]}
      </span>
      <span className="truncate font-semibold">{textoDelEvento(l, nombre)}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {detalleDelEvento(l, nombre)}
      </span>
    </span>
  );
}

/**
 * El set entero, para cuando hay un reclamo (pedido del dueño, 2026-09-13).
 *
 * Solo se mira: no se edita un punto viejo. Si el reclamo tiene razón, la mesa
 * deshace hasta ahí y vuelve a anotar — editar un punto del medio es la puerta a
 * que el marcador y la rotación digan cosas distintas (ver `planilla.ts`).
 *
 * Lo más reciente arriba, que es donde está casi siempre el punto discutido.
 */
function HistorialDelSet({
  numeroDeSet,
  lineas,
  nombre,
  orden,
  onCerrar,
}: {
  numeroDeSet: number;
  lineas: LineaDelHistorial[];
  nombre: Record<Lado, string>;
  orden: Lado[];
  onCerrar: () => void;
}) {
  const puntos = lineas.filter((l) => l.evento.t === "punto").length;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCerrar}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-2xl border bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b p-4">
          <h2 className="text-lg font-bold">Historial del set {numeroDeSet}</h2>
          <p className="text-sm text-muted-foreground">
            {puntos} {puntos === 1 ? "punto" : "puntos"} · lo más reciente arriba
          </p>
          {/* Dice de quién es cada número del marcador: después de un cambio
              de cancha el orden ya no es local–visitante. */}
          <p className="mt-2 truncate text-xs uppercase tracking-widest text-muted-foreground">
            {nombre[orden[0]]} – {nombre[orden[1]]}
          </p>
        </div>
        <div className="min-h-0 flex-1 divide-y overflow-y-auto">
          {[...lineas].reverse().map((l) => (
            <Linea key={l.indice} linea={l} nombre={nombre} orden={orden} />
          ))}
        </div>
        <div className="space-y-2 border-t p-4">
          <p className="text-xs text-muted-foreground">
            Para corregir un punto, usá Deshacer hasta llegar a él y volvé a
            anotar.
          </p>
          <Button className="h-12 w-full" onClick={onCerrar}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}

function textoDelEvento(
  l: LineaDelHistorial,
  nombre: Record<Lado, string>
): string {
  const ev = l.evento;
  if (ev.t === "cambio-de-cancha") return "Cambio de cancha";
  if (ev.t === "punto") return `Punto ${nombre[ev.equipo]}`;
  if (ev.t === "tiempo") return `Tiempo ${nombre[ev.equipo]}`;
  if (ev.t === "completar") return `Entra el ${ev.entra}`;
  return `Entra el ${ev.entra} por el ${ev.sale}`;
}

function detalleDelEvento(
  l: LineaDelHistorial,
  nombre: Record<Lado, string>
): string {
  if (l.evento.t === "cambio-de-cancha") return "";
  if (l.evento.t !== "punto") return nombre[l.evento.equipo];
  if (l.roto) return `rotó ${nombre[l.saca]}`;
  return l.sacador ? `saca ${l.sacador}` : "";
}
