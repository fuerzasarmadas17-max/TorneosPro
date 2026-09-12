"use client";

/**
 * La planilla en vivo de vóley: junta los pasos y guarda en el teléfono.
 *
 * El orden que ve la mesa es el del documento: primero quiénes juegan, después
 * la rotación de arranque de cada equipo, y de ahí en adelante el marcador.
 *
 * TODO LO QUE SE TOCA SE GUARDA EN EL TELÉFONO, en el momento. Si se recarga la
 * página, se apaga la pantalla o cambian de pestaña, la planilla sigue donde
 * estaba. Al volver a entrar, si el set ya había arrancado, se entra derecho al
 * marcador en vez de volver a preguntar la nómina.
 *
 * Mientras el partido está en juego no se manda nada al servidor. Ver
 * `Por hacer/planilla-en-vivo-volley.md`.
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Smartphone, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RosterScreen } from "./roster-screen";
import { LineupScreen } from "./lineup-screen";
import {
  type Alineacion,
  type Etiqueta,
  type Lado,
  type Planilla,
  alineacionVacia,
  huecos,
  planillaNueva,
} from "@/lib/volley/planilla";
import {
  guardarPlanilla,
  leerPlanilla,
} from "@/lib/volley/planilla-storage";

type Paso = "nomina" | "rotacion-home" | "rotacion-away" | "arranque" | "marcador";

interface Props {
  token: string;
  matchId: string;
  /** "Copa Santo Coffee · Cancha 2" — lo que va chiquito arriba de todo. */
  tituloArriba: string;
  homeTeamName: string;
  awayTeamName: string;
  jugadoresEnCancha: number;
  onBack: () => void;
}

export function PlanillaScreen({
  token,
  matchId,
  tituloArriba,
  homeTeamName,
  awayTeamName,
  jugadoresEnCancha,
  onBack,
}: Props) {
  // Lo que había en el teléfono, leído una sola vez al montar. Va en un
  // inicializador y no en un efecto porque esta pantalla recién se monta cuando
  // la mesa toca "Planilla en vivo": nunca se dibuja en el servidor, así que no
  // hay renderizado previo con el que pueda no coincidir.
  const [inicial] = useState(() => {
    const planilla = leerPlanilla(token, matchId) ?? planillaNueva(matchId, jugadoresEnCancha);
    const paso: Paso = planilla.setActual
      ? "marcador"
      : planilla.nomina.home.length > 0 && planilla.nomina.away.length > 0
        ? "rotacion-home"
        : "nomina";
    // Si el set ya había arrancado, las alineaciones que se ven son las del
    // arranque de ese set y no dos canchas vacías.
    const alineaciones: Record<Lado, Alineacion> = planilla.setActual
      ? planilla.setActual.alineacion
      : {
          home: alineacionVacia(jugadoresEnCancha),
          away: alineacionVacia(jugadoresEnCancha),
        };
    return { planilla, paso, alineaciones, saque: planilla.setActual?.saqueInicial ?? null };
  });

  const [planilla, setPlanilla] = useState<Planilla>(inicial.planilla);
  const [paso, setPaso] = useState<Paso>(inicial.paso);
  // Alineaciones que se están armando, antes de que el set arranque. No viven
  // en la planilla todavía porque la planilla guarda SETS, y el set no existe
  // hasta que alguien toca "Empezar el set".
  const [alineaciones, setAlineaciones] = useState<Record<Lado, Alineacion>>(
    inicial.alineaciones
  );
  const [saqueInicial, setSaqueInicial] = useState<Lado | null>(inicial.saque);
  const [sinGuardado, setSinGuardado] = useState(false);

  // Guardar en cada cambio. Si el navegador no deja (ventana privada,
  // almacenamiento lleno), se avisa una sola vez: la mesa tiene que saber que
  // lo anotado no sobrevive a una recarga.
  const actualizar = useCallback(
    (siguiente: Planilla) => {
      setPlanilla(siguiente);
      const ok = guardarPlanilla(token, matchId, siguiente);
      if (!ok) setSinGuardado(true);
    },
    [token, matchId]
  );

  const nombre: Record<Lado, string> = { home: homeTeamName, away: awayTeamName };

  const empezarElSet = () => {
    if (saqueInicial === null) {
      toast.error("Elegí quién saca primero.");
      return;
    }
    actualizar({
      ...planilla,
      setActual: {
        numero: planilla.setsCerrados.length + 1,
        alineacion: alineaciones,
        saqueInicial,
        eventos: [],
      },
    });
    setPaso("marcador");
  };

  // ------------------------------------------------------------------
  // Paso 1 — quiénes juegan
  // ------------------------------------------------------------------
  if (paso === "nomina") {
    return (
      <>
        <AvisoSinGuardado visible={sinGuardado} />
        <RosterScreen
          tituloArriba={tituloArriba}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
          jugadoresEnCancha={jugadoresEnCancha}
          nomina={planilla.nomina}
          onChange={(nomina: Record<Lado, Etiqueta[]>) => {
            actualizar({ ...planilla, nomina });
            // Un jugador borrado de la nómina no puede quedar parado en la
            // cancha del paso siguiente.
            setAlineaciones((prev) => ({
              home: prev.home.map((e) => (e && nomina.home.includes(e) ? e : null)),
              away: prev.away.map((e) => (e && nomina.away.includes(e) ? e : null)),
            }));
          }}
          onBack={onBack}
          onContinuar={() => setPaso("rotacion-home")}
        />
      </>
    );
  }

  // ------------------------------------------------------------------
  // Paso 2 — la rotación de arranque, un equipo por vez
  // ------------------------------------------------------------------
  if (paso === "rotacion-home" || paso === "rotacion-away") {
    const lado: Lado = paso === "rotacion-home" ? "home" : "away";
    return (
      <>
        <AvisoSinGuardado visible={sinGuardado} />
        <LineupScreen
          tituloArriba={tituloArriba}
          teamName={nombre[lado]}
          jugadoresEnCancha={jugadoresEnCancha}
          nomina={planilla.nomina[lado]}
          alineacion={alineaciones[lado]}
          onChange={(alineacion) =>
            setAlineaciones((prev) => ({ ...prev, [lado]: alineacion }))
          }
          onBack={() => setPaso(lado === "home" ? "nomina" : "rotacion-home")}
          onContinuar={() =>
            setPaso(lado === "home" ? "rotacion-away" : "arranque")
          }
          textoContinuar={
            lado === "home" ? `Seguir con ${awayTeamName}` : "Listo, ya están los dos"
          }
        />
      </>
    );
  }

  // ------------------------------------------------------------------
  // Antes de arrancar — quién saca primero
  // ------------------------------------------------------------------
  if (paso === "arranque") {
    const incompletos = (["home", "away"] as Lado[]).filter(
      (l) => huecos(alineaciones[l]) > 0
    );
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <AvisoSinGuardado visible={sinGuardado} />
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-muted-foreground">{tituloArriba}</p>
            <h1 className="truncate font-semibold">Set {planilla.setsCerrados.length + 1}</h1>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          <div>
            <h2 className="text-2xl font-bold">¿Quién saca primero?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Es lo último que falta. De acá en adelante la app lleva sola la
              rotación y el saque.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {(["home", "away"] as Lado[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setSaqueInicial(l)}
                className={`rounded-xl border-2 p-4 text-left transition-colors ${
                  saqueInicial === l
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >
                <span className="block text-lg font-bold">{nombre[l]}</span>
                <span className="block text-sm text-muted-foreground">
                  Saca el{" "}
                  {alineaciones[l][0] ?? "— (la posición 1 quedó vacía)"}
                </span>
              </button>
            ))}
          </div>

          {incompletos.length > 0 && (
            <div className="flex gap-3 rounded-lg border border-primary/50 bg-primary/10 p-3 text-sm">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                {incompletos.map((l) => nombre[l]).join(" y ")}{" "}
                {incompletos.length === 1 ? "empieza" : "empiezan"} con menos de{" "}
                {jugadoresEnCancha}. La posición vacía rota como una más y el que
                llegue tarde se agrega desde el marcador.
              </p>
            </div>
          )}

          <div className="mt-auto">
            <Button className="h-14 w-full text-base" onClick={empezarElSet}>
              Empezar el set
            </Button>
          </div>
        </div>

        <footer className="border-t p-4">
          <Button
            variant="outline"
            className="h-12 w-full text-base"
            onClick={() => setPaso("rotacion-away")}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Volver a la rotación
          </Button>
        </footer>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // El marcador — paso 4, todavía no construido
  // ------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AvisoSinGuardado visible={sinGuardado} />
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{tituloArriba}</p>
          <h1 className="truncate font-semibold">
            Set {planilla.setActual?.numero ?? 1}
          </h1>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-sm text-muted-foreground">
          <Smartphone className="h-3.5 w-3.5" />
          Guardado en el teléfono
        </span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-semibold">El marcador todavía no está.</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          La nómina y la rotación de arranque quedaron guardadas en este
          teléfono. La pantalla para contar los puntos es el paso siguiente de
          la construcción.
        </p>
        <div className="w-full max-w-sm rounded-lg border bg-muted/30 p-3 text-left text-sm">
          {(["home", "away"] as Lado[]).map((l) => (
            <p key={l} className="truncate">
              <span className="font-semibold">{nombre[l]}:</span>{" "}
              {planilla.setActual?.alineacion[l]
                .map((e) => e ?? "—")
                .join(" · ") ?? "—"}
            </p>
          ))}
          <p className="mt-1 text-muted-foreground">
            Saca {nombre[planilla.setActual?.saqueInicial ?? "home"]}.
          </p>
        </div>
        <Button variant="outline" className="h-12" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Volver a los partidos
        </Button>
      </div>
    </div>
  );
}

/** Barra fija de aviso cuando el navegador no deja guardar. Va arriba de todo y
 *  no se puede cerrar: es el único caso en que una recarga pierde lo anotado. */
function AvisoSinGuardado({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="flex items-center gap-2 bg-destructive px-4 py-2 text-sm text-white">
      <TriangleAlert className="h-4 w-4 shrink-0" />
      Este teléfono no está guardando la planilla. Si recargás la página, se
      pierde lo anotado.
    </div>
  );
}
