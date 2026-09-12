"use client";

/**
 * Paso 1 de la planilla: quiénes juegan.
 *
 * Se anotan las etiquetas de todos los que pueden entrar hoy —los que arrancan
 * y los del banco—, un equipo por vez. No son jugadores de la nómina del
 * torneo: es el número que la mesa ve en la camiseta, y si alguno no tiene
 * número, una letra.
 *
 * EL TECLADO ES PROPIO Y NO EL DEL TELÉFONO. En la cancha se anota de a un
 * número por vez y las teclas grandes se aciertan sin mirar. El del sistema
 * ocupa media pantalla, tapa la lista, y en muchos Android no trae una tecla
 * de "listo" que se pueda usar para agregar. La tecla ABC está porque hay
 * ligas donde alguien no tiene dorsal y se lo anota como "A".
 */

import { useState } from "react";
import { Delete, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type Etiqueta,
  type Lado,
  normalizarEtiqueta,
  validarEtiqueta,
} from "@/lib/volley/planilla";

interface Props {
  tituloArriba: string;
  homeTeamName: string;
  awayTeamName: string;
  jugadoresEnCancha: number;
  nomina: Record<Lado, Etiqueta[]>;
  onChange: (nomina: Record<Lado, Etiqueta[]>) => void;
  onBack: () => void;
  onContinuar: () => void;
}

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function RosterScreen({
  tituloArriba,
  homeTeamName,
  awayTeamName,
  jugadoresEnCancha,
  nomina,
  onChange,
  onBack,
  onContinuar,
}: Props) {
  const [lado, setLado] = useState<Lado>("home");
  const [buffer, setBuffer] = useState("");
  const [letras, setLetras] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nombre: Record<Lado, string> = { home: homeTeamName, away: awayTeamName };
  const anotados = nomina[lado];
  // El otro equipo es el que sigue. Cuando los dos tienen gente anotada, el
  // botón grande ya no manda a ningún lado: manda a la rotación.
  const faltaElOtro = nomina[lado === "home" ? "away" : "home"].length === 0;

  const teclear = (t: string) => {
    setError(null);
    setBuffer((b) => (b.length >= 3 ? b : b + t));
  };

  const borrar = () => {
    setError(null);
    setBuffer((b) => b.slice(0, -1));
  };

  const agregar = () => {
    const etiqueta = normalizarEtiqueta(buffer);
    const err = validarEtiqueta(etiqueta, anotados);
    if (err) {
      setError(err);
      return;
    }
    onChange({ ...nomina, [lado]: [...anotados, etiqueta] });
    setBuffer("");
    setError(null);
    setLetras(false);
  };

  const quitar = (etiqueta: Etiqueta) => {
    onChange({ ...nomina, [lado]: anotados.filter((e) => e !== etiqueta) });
  };

  const cambiarDeEquipo = (nuevo: Lado) => {
    setLado(nuevo);
    setBuffer("");
    setError(null);
    setLetras(false);
  };

  const siguiente = () => {
    if (faltaElOtro) {
      cambiarDeEquipo(lado === "home" ? "away" : "home");
      return;
    }
    onContinuar();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Encabezado */}
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{tituloArriba}</p>
          <h1 className="truncate font-semibold">
            {homeTeamName} vs {awayTeamName}
          </h1>
        </div>
        <span className="shrink-0 rounded-full border px-3 py-1 text-sm text-muted-foreground">
          Paso 1 de 2
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 landscape:flex-row-reverse landscape:items-start">
        {/* Lo anotado. Acostado va a la derecha, para que la mano que escribe
            en el teclado de la izquierda no lo tape. */}
        <div className="flex flex-1 flex-col gap-4 landscape:min-w-0">
          <div>
            <h2 className="text-2xl font-bold">¿Quiénes juegan?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Anotá el número de cada jugador que puede entrar hoy, los que
              arrancan y los del banco. Si alguno no tiene número, poné una letra.
            </p>
          </div>

          {/* Elegir equipo */}
          <div className="flex gap-2">
            {(["home", "away"] as Lado[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => cambiarDeEquipo(l)}
                className={`flex-1 rounded-lg border px-3 py-2 text-center transition-colors ${
                  lado === l
                    ? "border-primary bg-primary/10"
                    : "bg-card hover:bg-accent"
                }`}
              >
                <span className="block truncate font-semibold">{nombre[l]}</span>
                <span
                  className={`block text-sm ${
                    lado === l ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {nomina[l].length > 0
                    ? `${nomina[l].length} anotados`
                    : "sin anotar"}
                </span>
              </button>
            ))}
          </div>

          {/* Lo que se está escribiendo */}
          <div className="flex gap-2">
            <div
              className={`flex h-14 flex-1 items-center rounded-lg border-2 px-4 text-2xl font-bold ${
                buffer ? "border-primary" : "border-input text-muted-foreground"
              }`}
            >
              {buffer || <span className="text-base font-normal">Tocá el teclado</span>}
            </div>
            <Button
              type="button"
              className="h-14 px-6 text-base"
              disabled={!buffer}
              onClick={agregar}
            >
              Agregar
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Los anotados */}
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{anotados.length}</span>{" "}
              anotados · mínimo {jugadoresEnCancha}
            </p>
            {anotados.length > 0 && (
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Tocá uno para quitarlo
              </p>
            )}
          </div>

          {anotados.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {anotados.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => quitar(e)}
                  className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 hover:bg-accent"
                >
                  <span className="text-lg font-bold">{e}</span>
                  <span className="text-muted-foreground">×</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Todavía no anotaste a nadie de {nombre[lado]}.
            </p>
          )}

          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            Estos son todos los que pueden jugar, no la rotación.{" "}
            <span className="font-semibold text-foreground">
              Los {jugadoresEnCancha} que arrancan en cancha se eligen en el paso
              siguiente.
            </span>
          </div>
        </div>

        {/* Teclado */}
        <div className="grid grid-cols-3 gap-2 landscape:flex-1 landscape:self-stretch">
          {letras ? (
            <>
              {LETRAS.map((l) => (
                <TeclaChica key={l} onClick={() => teclear(l)}>
                  {l}
                </TeclaChica>
              ))}
              <TeclaChica onClick={() => setLetras(false)}>123</TeclaChica>
              <TeclaChica onClick={borrar} aria-label="Borrar">
                <Delete className="mx-auto h-5 w-5" />
              </TeclaChica>
            </>
          ) : (
            <>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                <Tecla key={n} onClick={() => teclear(n)}>
                  {n}
                </Tecla>
              ))}
              <Tecla onClick={() => setLetras(true)} tenue>
                ABC
              </Tecla>
              <Tecla onClick={() => teclear("0")}>0</Tecla>
              <Tecla onClick={borrar} tenue aria-label="Borrar">
                <Delete className="mx-auto h-6 w-6" />
              </Tecla>
            </>
          )}
        </div>
      </div>

      {/* Pie */}
      <footer className="flex gap-2 border-t p-4">
        <Button variant="outline" className="h-14 flex-1 text-base" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Atrás
        </Button>
        <Button
          className="h-14 flex-[2] text-base"
          disabled={anotados.length === 0}
          onClick={siguiente}
        >
          {faltaElOtro
            ? `Seguir con ${nombre[lado === "home" ? "away" : "home"]}`
            : "Seguir con la rotación"}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </footer>
    </div>
  );
}

function Tecla({
  children,
  onClick,
  tenue,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  tenue?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-16 rounded-lg border bg-card text-2xl font-bold transition-colors active:bg-accent ${
        tenue ? "text-muted-foreground" : ""
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}

function TeclaChica({
  children,
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-12 rounded-lg border bg-card text-lg font-bold transition-colors active:bg-accent"
      {...rest}
    >
      {children}
    </button>
  );
}
