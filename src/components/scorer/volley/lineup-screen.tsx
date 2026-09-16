"use client";

/**
 * La rotación de arranque de un equipo, y de paso quiénes juegan.
 *
 * ES LA PRIMERA PANTALLA DE LA PLANILLA. Antes había un paso aparte para anotar
 * todos los números y otro para ubicarlos; el dueño pidió juntarlos
 * (2026-09-12): se toca una posición, se escribe el número ahí mismo, y el
 * teclado salta solo a la siguiente. Escribir y ubicar son el mismo toque, y
 * para un equipo de cuatro eran dos pantallas para escribir cuatro números.
 *
 * Acá solo se anotan los que arrancan. Los suplentes no tienen lugar en esta
 * pantalla (el dueño la quiso sin lista de banco, 2026-09-12): se agregan
 * desde el cambio, con "Llegó tarde", cuando van a entrar.
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
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Teclado, Visor } from "./teclado";
import {
  type Alineacion,
  type Etiqueta,
  filasDeLaCancha,
  huecos,
  indiceDePosicion,
  normalizarEtiqueta,
  validarEtiqueta,
} from "@/lib/volley/planilla";

interface Props {
  tituloArriba: string;
  teamName: string;
  /** "Paso 1 de 2" o "Paso 2 de 2". */
  paso: string;
  /** El otro equipo. Va apagado al lado del propio: ver los dos juntos es lo
   *  que deja saber de cuál de los dos es esta rotación. */
  rivalName: string;
  jugadoresEnCancha: number;
  /** Todos los que pueden entrar hoy, de este equipo: en cancha y banco. */
  nomina: Etiqueta[];
  onNominaChange: (nomina: Etiqueta[]) => void;
  alineacion: Alineacion;
  onChange: (alineacion: Alineacion) => void;
  onBack: () => void;
  onContinuar: () => void;
  /** Texto del botón grande: cambia si falta el otro equipo. */
  textoContinuar: string;
}

/** La posición donde va lo que se está escribiendo, o `null` con el teclado cerrado. */
type Destino = number | null;

export function LineupScreen({
  tituloArriba,
  teamName,
  rivalName,
  paso,
  jugadoresEnCancha,
  nomina,
  onNominaChange,
  alineacion,
  onChange,
  onBack,
  onContinuar,
  textoContinuar,
}: Props) {
  const { frente, fondo } = filasDeLaCancha(jugadoresEnCancha);

  const primeraVacia = (a: Alineacion): number | null => {
    const i = a.findIndex((e) => e === null);
    return i < 0 ? null : i + 1;
  };

  // Arranca con el teclado abierto en la primera posición vacía: la mesa entra
  // y escribe, sin tener que tocar nada antes.
  const [destino, setDestino] = useState<Destino>(() => primeraVacia(alineacion));
  /** Si el teclado está a la vista. Arranca escondido detrás del botón. */
  const [escribiendo, setEscribiendo] = useState(false);
  const [buffer, setBuffer] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ubicados = new Set(alineacion.filter((e): e is Etiqueta => e !== null));
  const banco = nomina.filter((e) => !ubicados.has(e));
  const faltan = huecos(alineacion);
  const ocupante = typeof destino === "number" ? alineacion[indiceDePosicion(destino)] : null;

  const abrir = (d: Destino) => {
    setDestino(d);
    setBuffer("");
    setError(null);
  };

  /** Tocar una posición abre el teclado de una (dueño, 2026-09-15). Antes el
   *  toque solo la marcaba como activa y había que apretar además "Agregar un
   *  nuevo jugador": dos toques para lo que la mesa pide en uno. */
  const tocarPosicion = (posicion: number) => {
    abrir(posicion);
    setEscribiendo(true);
  };

  /** Pone a alguien en la posición abierta y salta a la siguiente vacía. El que
   *  estaba ahí no se borra: pasa al banco. */
  const ubicar = (etiqueta: Etiqueta) => {
    if (typeof destino !== "number") return;
    const siguiente = [...alineacion];
    siguiente[indiceDePosicion(destino)] = etiqueta;
    onChange(siguiente);
    abrir(primeraVacia(siguiente));
  };

  const poner = () => {
    const etiqueta = normalizarEtiqueta(buffer);
    if (destino === null) return;
    // Un número que ya está anotado no es un error acá: si está en el banco, se
    // lo sube a la cancha. Solo se frena si ya está parado en otra posición.
    const err = validarEtiqueta(etiqueta, []);
    if (err) return setError(err);
    const yaEn = alineacion.indexOf(etiqueta);
    if (yaEn >= 0 && yaEn !== indiceDePosicion(destino)) {
      return setError(`El ${etiqueta} ya está en la posición ${yaEn + 1}.`);
    }
    if (!nomina.includes(etiqueta)) onNominaChange([...nomina, etiqueta]);
    ubicar(etiqueta);
  };

  const vaciarPosicion = () => {
    if (typeof destino !== "number") return;
    const siguiente = [...alineacion];
    siguiente[indiceDePosicion(destino)] = null;
    onChange(siguiente);
    setError(null);
  };

  const tituloDelTeclado = ocupante
    ? `Posición ${destino} · ahora está el ${ocupante}`
    : `Número para la posición ${destino}`;

  return (
    // min-h-dvh y no min-h-screen: en el celular, screen cuenta también lo que
    // tapa la barra del navegador y los botones de abajo quedaban escondidos.
    <div className="min-h-dvh flex flex-col bg-background">
      {/* El equipo manda en el header (dueño, 2026-09-15). Antes era "Rotación de
          Aura" en una línea chica y del mismo grosor de punta a punta: el
          nombre, que es lo único que cambia entre las dos pantallas, se perdía
          entre las palabras. Ahora el nombre va grande y solo, y el rival
          apagado al lado — con los dos a la vista no hay forma de cargarle la
          rotación al equipo equivocado. */}
      <header className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm text-muted-foreground">{tituloArriba}</p>
          <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
            {paso}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="h-9 w-1.5 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase leading-none tracking-widest text-muted-foreground">
              Rotación de
            </p>
            <h1 className="truncate text-2xl font-bold leading-tight">{teamName}</h1>
          </div>
          <span className="max-w-[35%] shrink-0 truncate text-sm text-muted-foreground">
            vs {rivalName}
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 landscape:flex-row landscape:items-start">
        <div className="flex flex-col gap-4 landscape:min-w-0 landscape:flex-1">
          <p className="text-sm text-muted-foreground">
            Tocá una posición y escribí el número o la letra. La{" "}
            <span className="font-semibold text-foreground">1</span> es la que
            saca primero.
          </p>

          {/* La cancha */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 border-t border-dashed" />
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Red
              </span>
              <div className="h-px flex-1 border-t border-dashed" />
            </div>
            {[frente, fondo].map((fila, i) => (
              <Fila
                key={i}
                posiciones={fila}
                alineacion={alineacion}
                activa={typeof destino === "number" ? destino : null}
                // Con el teclado abierto las casillas se achican para que la
                // cancha y el teclado entren juntos de pie.
                compacta={destino !== null}
                onTocar={tocarPosicion}
              />
            ))}
          </div>

          {faltan > 0 && destino === null && (
            <div className="rounded-lg border border-primary/50 bg-primary/10 p-3 text-sm">
              <span className="font-semibold">
                {teamName} va a empezar con {jugadoresEnCancha - faltan} de{" "}
                {jugadoresEnCancha}.
              </span>{" "}
              La posición vacía rota como una más. Si llega el que falta, se
              agrega desde el marcador sin gastar cambio.
            </div>
          )}
        </div>

        {/* El teclado. Acostado va a la derecha, al lado de la cancha. */}
        {destino !== null && (
          <div className="flex flex-col gap-2 landscape:w-[42%] landscape:shrink-0">
            {/* En el segundo set ya están todos anotados: se suben con un
                toque, sin volver a escribir. Va arriba de todo del teclado
                porque, cuando aparece, es lo más rápido de usar. */}
            {typeof destino === "number" && banco.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Ya anotados:</span>
                {banco.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => ubicar(e)}
                    className="h-10 min-w-10 rounded-lg border bg-card px-3 font-bold hover:bg-accent"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-semibold">{tituloDelTeclado}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  abrir(null);
                  setEscribiendo(false);
                }}
              >
                Listo
              </Button>
            </div>
            {/* Al entrar el teclado está escondido y la pantalla deja ver la
                cancha y los ya anotados (dueño, 2026-09-12). Lo abre tocar una
                posición o el botón de abajo, y una vez abierto se queda abierto
                al saltar de posición, para anotar a los que arrancan de corrido. */}
            {escribiendo ? (
              <>
                <div className="flex gap-2">
                  <Visor texto={buffer} />
                  <Button className="h-14 px-6 text-base" disabled={!buffer} onClick={poner}>
                    Poner
                  </Button>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}

                <Teclado
                  onTecla={(t) => {
                    setError(null);
                    setBuffer((b) => (b.length >= 3 ? b : b + t));
                  }}
                  onBorrar={() => {
                    setError(null);
                    setBuffer((b) => b.slice(0, -1));
                  }}
                />
              </>
            ) : (
              <Button
                variant="outline"
                className="h-14 w-full border-2 border-dashed text-base"
                onClick={() => setEscribiendo(true)}
              >
                <Plus className="mr-2 h-5 w-5" />
                Agregar un nuevo jugador
              </Button>
            )}

            {ocupante && (
              <Button variant="outline" className="h-11" onClick={vaciarPosicion}>
                Sacar al {ocupante} de la posición {destino}
              </Button>
            )}
          </div>
        )}
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
  activa,
  compacta,
  onTocar,
}: {
  posiciones: number[];
  alineacion: Alineacion;
  activa: number | null;
  compacta: boolean;
  onTocar: (posicion: number) => void;
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${posiciones.length}, minmax(0, 1fr))` }}
    >
      {posiciones.map((pos) => {
        const etiqueta = alineacion[indiceDePosicion(pos)];
        const saca = pos === 1;
        return (
          <button
            key={pos}
            type="button"
            onClick={() => onTocar(pos)}
            className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 transition-colors ${
              compacta ? "h-20" : "h-28"
            } ${activa === pos ? "border-primary bg-primary/10" : "border-border bg-card"}`}
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
