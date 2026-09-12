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
import { ChevronLeft, Loader2, CheckCircle2, CloudOff, TriangleAlert, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RosterScreen } from "./roster-screen";
import { LineupScreen } from "./lineup-screen";
import { MarcadorScreen } from "./marcador-screen";
import { CambioSheet } from "./cambio-sheet";
import {
  type Alineacion,
  type Etiqueta,
  type Evento,
  type Lado,
  type Planilla,
  alineacionVacia,
  estadoDelSet,
  huecos,
  planillaNueva,
  setsGanados as contarSets,
} from "@/lib/volley/planilla";
import { volleyballSetWarnings } from "@/lib/volleyball-sets";
import {
  type EnvioPendiente,
  type ResultadoDelEnvio,
  encolar,
  intentarEnviar,
  pendienteDe,
} from "@/lib/volley/envio";
import {
  guardarPlanilla,
  leerPlanilla,
} from "@/lib/volley/planilla-storage";

type Paso =
  | "nomina"
  | "rotacion-home"
  | "rotacion-away"
  | "arranque"
  | "marcador"
  | "terminado";

interface Props {
  token: string;
  matchId: string;
  /** "Copa Santo Coffee · Cancha 2" — lo que va chiquito arriba de todo. */
  tituloArriba: string;
  homeTeamName: string;
  awayTeamName: string;
  jugadoresEnCancha: number;
  /** Cuántos sets se juegan en este torneo. Define cuándo se acabó el partido. */
  bestOf: 3 | 5;
  /** Quién está anotando. Va en el resultado, igual que en la carga a mano. */
  scorerName: string;
  /** Si este partido puede quedar empatado. Va en grupos y liga, no en
   *  playoffs, donde alguien tiene que pasar de ronda. Lo decide el servidor
   *  igual; acá sirve para no ofrecer algo que después va a rechazar. */
  permiteEmpate: boolean;
  onBack: () => void;
  /** El resultado llegó al servidor: la lista de partidos tiene que refrescarse. */
  onEnviado: () => void;
}

export function PlanillaScreen({
  token,
  matchId,
  tituloArriba,
  homeTeamName,
  awayTeamName,
  jugadoresEnCancha,
  bestOf,
  scorerName,
  permiteEmpate,
  onBack,
  onEnviado,
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
    // Un partido que terminó y quedó sin mandar entra derecho a su pantalla,
    // con el motivo a la vista. Si no, la mesa lo daría por guardado.
    const pendiente = pendienteDe(matchId);
    return {
      planilla,
      paso: pendiente ? ("terminado" as Paso) : paso,
      alineaciones,
      saque: planilla.setActual?.saqueInicial ?? null,
      pendiente,
    };
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
  /** Equipo cuyo cambio está abierto, o null. */
  const [cambioDe, setCambioDe] = useState<Lado | null>(null);
  /** El "¿cerramos el set?" abierto. */
  const [cerrando, setCerrando] = useState(false);
  /** Cómo va el envío del resultado al servidor. */
  const [envio, setEnvio] = useState<ResultadoDelEnvio | "enviando" | null>(
    inicial.pendiente
      ? inicial.pendiente.errorPermanente
        ? { estado: "rechazado", mensaje: inicial.pendiente.errorPermanente }
        : { estado: "sin-red", mensaje: "Quedó pendiente de mandar." }
      : null
  );

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

  const setActual = planilla.setActual;
  const estado = setActual ? estadoDelSet(setActual) : null;
  const setsToWin = Math.ceil(bestOf / 2);

  /** Agrega un evento al set en juego. Es lo único que escribe la planilla
   *  mientras se juega: todo lo demás se calcula leyendo la lista. */
  const agregarEvento = (evento: Evento) => {
    if (!setActual) return;
    actualizar({
      ...planilla,
      setActual: { ...setActual, eventos: [...setActual.eventos, evento] },
    });
  };

  /** Deshacer es quitar el último evento, sea un punto, un tiempo o un cambio.
   *  Un punto no se edita: se deshace. Editar el punto 14 de un set que va
   *  22-19 es la puerta a que la planilla y el marcador digan cosas distintas. */
  const deshacer = () => {
    if (!setActual || setActual.eventos.length === 0) return;
    actualizar({
      ...planilla,
      setActual: { ...setActual, eventos: setActual.eventos.slice(0, -1) },
    });
  };

  /** Cierra el set y decide qué sigue: otro set, o el partido terminado. */
  const cerrarSet = () => {
    if (!setActual || !estado) return;
    const cerrado = {
      numero: setActual.numero,
      homePoints: estado.puntos.home,
      awayPoints: estado.puntos.away,
    };
    const siguiente: Planilla = {
      ...planilla,
      setsCerrados: [...planilla.setsCerrados, cerrado],
      setActual: null,
    };
    actualizar(siguiente);
    setCerrando(false);

    const ganados = contarSets(siguiente);
    if (ganados.home >= setsToWin || ganados.away >= setsToWin) {
      setPaso("terminado");
      void terminarPartido(siguiente, ganados);
      return;
    }
    // Cada set arranca con su propia rotación: la del set anterior no sirve, y
    // los cambios y los tiempos se reinician (4.2.1 y 4.2.2 del documento).
    setAlineaciones({
      home: alineacionVacia(jugadoresEnCancha),
      away: alineacionVacia(jugadoresEnCancha),
    });
    setSaqueInicial(null);
    setPaso("rotacion-home");
  };

  /** Arma el resultado, lo deja en la cola y lo intenta mandar.
   *
   *  Encolar ANTES de intentar es lo que hace que el partido no se pierda: si el
   *  teléfono se queda sin batería en medio del envío, el resultado ya está
   *  anotado como pendiente y sale solo la próxima vez que haya red. */
  const terminarPartido = async (
    fin: Planilla,
    ganados: Record<Lado, number>
  ) => {
    const pendiente: EnvioPendiente = {
      token,
      matchId,
      creadoEn: new Date().toISOString(),
      cuerpo: {
        scorerName,
        homeScore: ganados.home,
        awayScore: ganados.away,
        // Los parciales de cada set, que es lo único que el sistema guarda hoy
        // de un partido de vóley. Los puntos uno por uno se quedan en el
        // teléfono: mandarlos es la entrega 2.
        sets: fin.setsCerrados.map((s) => ({
          setNumber: s.numero,
          homePoints: s.homePoints,
          awayPoints: s.awayPoints,
        })),
      },
    };
    encolar(pendiente);
    setEnvio("enviando");
    const r = await intentarEnviar(pendiente);
    setEnvio(r);
    if (r.estado === "enviado") onEnviado();
  };

  /** Cortar el partido con la serie igualada, sin jugar el set que falta. */
  const cortarEmpatado = () => {
    setPaso("terminado");
    void terminarPartido(planilla, contarSets(planilla));
  };

  /** Reintento a mano, desde el botón. */
  const reintentar = async () => {
    const pendiente = pendienteDe(matchId);
    if (!pendiente) return;
    setEnvio("enviando");
    // Un rechazo anterior no tiene que frenar el reintento que pide la mesa:
    // puede haber cambiado lo que lo causaba.
    const r = await intentarEnviar({ ...pendiente, errorPermanente: undefined });
    setEnvio(r);
    if (r.estado === "enviado") onEnviado();
  };

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
    const cuenta = contarSets(planilla);
    const empatadosEn = cuenta.home;
    const puedeCortarEmpatado =
      permiteEmpate && planilla.setsCerrados.length > 0 && cuenta.home === cuenta.away;
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

          <div className="mt-auto space-y-2">
            <Button className="h-14 w-full text-base" onClick={empezarElSet}>
              Empezar el set
            </Button>
            {/* Los relámpagos de dos y tres días cortan el partido con la serie
                igualada, y es práctica común. Sin esto, la mesa tendría que
                jugar un set que nadie va a jugar o cargar el partido a mano. */}
            {puedeCortarEmpatado && (
              <Button
                variant="outline"
                className="h-12 w-full"
                onClick={cortarEmpatado}
              >
                El partido se corta acá, {empatadosEn}–{empatadosEn}
              </Button>
            )}
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
  // Partido terminado — el resultado sale para el servidor
  // ------------------------------------------------------------------
  if (paso === "terminado") {
    const ganados = contarSets(planilla);
    const empatado = ganados.home === ganados.away;
    const ganador: Lado = ganados.home > ganados.away ? "home" : "away";
    const perdedor: Lado = ganador === "home" ? "away" : "home";
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AvisoSinGuardado visible={sinGuardado} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <Trophy className="h-12 w-12 text-primary" />
          <p className="text-xl font-bold">
            {empatado
              ? `Empataron ${ganados.home}–${ganados.away}`
              : `Ganó ${nombre[ganador]} ${ganados[ganador]}–${ganados[perdedor]}`}
          </p>
          <div className="w-full max-w-sm divide-y rounded-lg border text-sm">
            {planilla.setsCerrados.map((s) => (
              <div key={s.numero} className="flex justify-between px-3 py-2">
                <span className="text-muted-foreground">Set {s.numero}</span>
                <span className="font-semibold tabular-nums">
                  {s.homePoints} – {s.awayPoints}
                </span>
              </div>
            ))}
          </div>
          <EstadoDelEnvio envio={envio} onReintentar={reintentar} />

          <Button
            variant={envio && envio !== "enviando" && envio.estado === "enviado" ? "default" : "outline"}
            className="h-12"
            onClick={onBack}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Volver a los partidos
          </Button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // El marcador
  // ------------------------------------------------------------------
  if (!setActual || !estado) {
    // No debería pasar: el paso "marcador" solo se alcanza con un set abierto.
    // Si pasa, se vuelve a la nómina en vez de dejar la pantalla en blanco.
    setPaso("nomina");
    return null;
  }

  const ganados = contarSets(planilla);
  // Los avisos del parcial (un set que no llega a 25, o ganado por uno) se
  // muestran al cerrar. No bloquean: hay relámpagos que juegan los sets a 21 o
  // a 15, y bloquearlos dejaría al torneo sin poder cargarse.
  const avisosDelSet = cerrando
    ? volleyballSetWarnings(
        [
          ...planilla.setsCerrados.map((s) => ({
            homePoints: s.homePoints,
            awayPoints: s.awayPoints,
          })),
          { homePoints: estado.puntos.home, awayPoints: estado.puntos.away },
        ],
        setsToWin
      ).filter((a) => a.setNumber === setActual.numero)
    : [];

  return (
    <>
      <AvisoSinGuardado visible={sinGuardado} />
      <MarcadorScreen
        tituloArriba={tituloArriba}
        planilla={planilla}
        estado={estado}
        nombre={nombre}
        setsGanados={ganados}
        numeroDeSet={setActual.numero}
        guardando={!sinGuardado}
        onPunto={(equipo) => agregarEvento({ t: "punto", equipo })}
        onDeshacer={deshacer}
        onCambio={(equipo) => setCambioDe(equipo)}
        onTiempo={(equipo) => agregarEvento({ t: "tiempo", equipo })}
        onCerrarSet={() => setCerrando(true)}
        onBack={onBack}
      />

      {cambioDe && (
        <CambioSheet
          lado={cambioDe}
          teamName={nombre[cambioDe]}
          planilla={planilla}
          estado={estado}
          onConfirmar={agregarEvento}
          onAgregarALaNomina={(etiqueta) =>
            actualizar({
              ...planilla,
              nomina: {
                ...planilla.nomina,
                [cambioDe]: [...planilla.nomina[cambioDe], etiqueta],
              },
            })
          }
          onCerrar={() => setCambioDe(null)}
        />
      )}

      {cerrando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-background p-5">
            <div>
              <h2 className="text-lg font-bold">¿Cerramos el set {setActual.numero}?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Después de cerrarlo no se puede seguir anotando en este set.
              </p>
            </div>
            <p className="text-center text-4xl font-bold tabular-nums">
              {estado.puntos.home} – {estado.puntos.away}
            </p>
            {estado.puntos.home === estado.puntos.away ? (
              <div className="flex gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p>Un set no puede terminar empatado. Seguí anotando.</p>
              </div>
            ) : (
              avisosDelSet.map((a) => (
                <div
                  key={a.message}
                  className="flex gap-2 rounded-lg border border-primary/50 bg-primary/10 p-3 text-sm"
                >
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>{a.message} Si en este torneo se juega así, cerralo tranquilo.</p>
                </div>
              ))
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-12 flex-1"
                onClick={() => setCerrando(false)}
              >
                Seguir anotando
              </Button>
              <Button
                className="h-12 flex-1"
                disabled={estado.puntos.home === estado.puntos.away}
                onClick={cerrarSet}
              >
                Cerrar set
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
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

/**
 * Cómo va el envío del resultado, en una sola caja.
 *
 * Los tres finales posibles se ven distintos a propósito: "enviado" es el único
 * que deja a la mesa irse tranquila, "sin red" dice que no hay nada que hacer
 * porque sale solo, y "rechazado" es el único que pide algo de ella.
 */
function EstadoDelEnvio({
  envio,
  onReintentar,
}: {
  envio: ResultadoDelEnvio | "enviando" | null;
  onReintentar: () => void;
}) {
  if (envio === null) return null;

  if (envio === "enviando") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Mandando el resultado...
      </p>
    );
  }

  if (envio.estado === "enviado") {
    return (
      <div className="flex max-w-sm items-center gap-2 rounded-lg border border-green-600/40 bg-green-600/10 p-3 text-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-700 dark:text-green-500" />
        <p>
          <span className="font-semibold">Resultado guardado.</span> El
          organizador ya lo ve.
        </p>
      </div>
    );
  }

  if (envio.estado === "sin-red") {
    return (
      <div className="max-w-sm space-y-3 rounded-lg border border-primary/50 bg-primary/10 p-3 text-sm">
        <div className="flex gap-2">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            <span className="font-semibold">Guardado en el teléfono.</span>{" "}
            {envio.mensaje} Podés cerrar la página: no se pierde.
          </p>
        </div>
        <Button variant="outline" className="h-11 w-full" onClick={onReintentar}>
          Probar de nuevo ahora
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-sm space-y-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
      <div className="flex gap-2">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <p>
          <span className="font-semibold">No se pudo guardar.</span>{" "}
          {envio.mensaje}
        </p>
      </div>
      <Button variant="outline" className="h-11 w-full" onClick={onReintentar}>
        Probar de nuevo
      </Button>
    </div>
  );
}
