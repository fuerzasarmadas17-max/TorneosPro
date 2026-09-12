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

import { Smartphone, Undo2, ChevronLeft } from "lucide-react";
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
    onBack,
  } = props;

  const lineas = planilla.setActual ? historial(planilla.setActual) : [];
  const ultimas = lineas.slice(-5).reverse();
  const hayQueDeshacer = lineas.length > 0;
  const sacador = estado.enCancha[estado.saca][0];

  return (
    <div className="flex min-h-screen flex-col bg-background">
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
          <Tanteador lado="home" {...props} />
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums">
              {setsGanados.home} – {setsGanados.away}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Sets
            </p>
          </div>
          <Tanteador lado="away" {...props} />
        </div>

        <p className="text-center text-sm text-primary">
          ● Saca {nombre[estado.saca]}
          {sacador ? ` — número ${sacador}` : ""}
        </p>

        <div className="grid flex-1 grid-cols-2 gap-3">
          {(["home", "away"] as Lado[]).map((l) => (
            <BotonPunto key={l} lado={l} {...props} />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(["home", "away"] as Lado[]).map((l) => (
            <div key={l} className="space-y-2">
              <AccionesDelEquipo lado={l} {...props} />
              <p className="truncate text-xs uppercase tracking-widest text-muted-foreground">
                {nombre[l]} en cancha
              </p>
              <EnCancha lado={l} {...props} />
            </div>
          ))}
        </div>

        <UltimosPuntos lineas={ultimas} nombre={nombre} />
      </div>

      {/* -------------------------------------------------------- Acostado */}
      <div className="hidden flex-1 gap-3 p-3 landscape:flex">
        {(["home", "center", "away"] as const).map((col) =>
          col === "center" ? (
            <div key={col} className="flex w-[30%] shrink-0 flex-col gap-2">
              <div className="rounded-xl border bg-card py-2 text-center">
                <p className="text-2xl font-bold tabular-nums">
                  {setsGanados.home} – {setsGanados.away}
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
                <UltimosPuntos lineas={ultimas} nombre={nombre} />
              </div>
              {/* Las acciones van acá y no abajo de todo: acostado, el borde
                  inferior es donde descansan los pulgares. */}
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
    <div className="flex gap-2">
      <Button
        variant="outline"
        className="h-11 flex-1 text-sm"
        onClick={() => onCambio(lado)}
      >
        Cambio
      </Button>
      <Button
        variant="outline"
        className="h-11 flex-1 text-sm"
        disabled={quedan === 0}
        onClick={() => onTiempo(lado)}
      >
        Tiempo
        <span className="ml-1.5 flex gap-1">
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

function UltimosPuntos({
  lineas,
  nombre,
}: {
  lineas: LineaDelHistorial[];
  nombre: Record<Lado, string>;
}) {
  if (lineas.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Todavía no se anotó ningún punto.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Últimos puntos
      </p>
      <div className="divide-y rounded-lg border">
        {lineas.map((l) => (
          <div
            key={l.indice}
            className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
          >
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {l.puntos.home} – {l.puntos.away}
            </span>
            <span className="truncate font-semibold">
              {textoDelEvento(l, nombre)}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {detalleDelEvento(l, nombre)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function textoDelEvento(
  l: LineaDelHistorial,
  nombre: Record<Lado, string>
): string {
  const ev = l.evento;
  if (ev.t === "punto") return `Punto ${nombre[ev.equipo]}`;
  if (ev.t === "tiempo") return `Tiempo ${nombre[ev.equipo]}`;
  if (ev.t === "completar") return `Entra el ${ev.entra}`;
  return `Entra el ${ev.entra} por el ${ev.sale}`;
}

function detalleDelEvento(
  l: LineaDelHistorial,
  nombre: Record<Lado, string>
): string {
  if (l.evento.t !== "punto") return nombre[l.evento.equipo];
  if (l.roto) return `rotó ${nombre[l.saca]}`;
  return l.sacador ? `saca ${l.sacador}` : "";
}
