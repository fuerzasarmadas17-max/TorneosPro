"use client";

/**
 * La planilla en vivo de vóley: junta los pasos y guarda en el teléfono.
 *
 * El orden que ve la mesa: la rotación de arranque de cada equipo —que es donde
 * también se anotan los números—, quién saca, y de ahí en adelante el marcador.
 *
 * TODO LO QUE SE TOCA SE GUARDA EN EL TELÉFONO, en el momento. Si se recarga la
 * página, se apaga la pantalla o cambian de pestaña, la planilla sigue donde
 * estaba. Al volver a entrar, si el set ya había arrancado, se entra derecho al
 * marcador en vez de volver a preguntar la nómina.
 *
 * Mientras el partido está en juego el RESULTADO no se manda: se manda al
 * terminar. Lo único que sale antes es la foto para el marcador en vivo del
 * público (`use-mandar-en-vivo.ts`), que no es el resultado. Ver
 * `Por hacer/deportes/voley/planilla-en-vivo-volley.md`.
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Loader2, CloudOff, TriangleAlert, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LineupScreen } from "./lineup-screen";
import { MarcadorScreen } from "./marcador-screen";
import { CambioSheet } from "./cambio-sheet";
import { useMandarEnVivo } from "./use-mandar-en-vivo";
import {
  type Alineacion,
  type EstadoAplazado,
  type Etiqueta,
  type Evento,
  type Lado,
  type Planilla,
  alineacionVacia,
  armarAplazado,
  avisoDeCambioDeCancha,
  esSetDecisivo,
  estadoDelSet,
  huecos,
  izquierdaPropuesta,
  planillaDesdeAplazado,
  planillaNueva,
  saquePropuesto,
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
  borrarPlanilla,
  guardarPlanilla,
  leerPlanilla,
} from "@/lib/volley/planilla-storage";

type Paso =
  /** "Este partido venía aplazado": se retoma o se empieza de cero. */
  | "retomar"
  | "rotacion-home"
  | "rotacion-away"
  | "arranque"
  | "marcador"
  | "terminado"
  /** El partido se aplazó y el aplazamiento sale para el servidor. */
  | "aplazado";

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
  /**
   * Por dónde iba el partido la última vez que se aplazó, o `null` si nunca se
   * aplazó. Viene del servidor. Con esto la mesa lo retoma en el marcador que
   * quedó en vez de arrancarlo de cero sin enterarse de que ya se jugó medio
   * set. Ver `Por hacer/deportes/voley/APLAZADO-PLANILLA-URGENTE.md`.
   */
  aplazado?: EstadoAplazado | null;
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
  aplazado,
  permiteEmpate,
  onBack,
  onEnviado,
}: Props) {
  // Lo que había en el teléfono, leído una sola vez al montar. Va en un
  // inicializador y no en un efecto porque esta pantalla recién se monta cuando
  // la mesa toca "Planilla en vivo": nunca se dibuja en el servidor, así que no
  // hay renderizado previo con el que pueda no coincidir.
  const [inicial] = useState(() => {
    const guardada = leerPlanilla(token, matchId);
    // Un partido que venía aplazado arranca con los sets que ya se jugaron y
    // con la pantalla que lo cuenta. Solo si no hay nada en este teléfono: si la
    // mesa ya empezó a anotar hoy, lo de hoy manda y no se le pisa nada.
    const retomando = !guardada && !!aplazado;
    const planilla =
      guardada ??
      (aplazado
        ? planillaDesdeAplazado(matchId, jugadoresEnCancha, aplazado)
        : planillaNueva(matchId, jugadoresEnCancha));
    const paso: Paso = retomando
      ? "retomar"
      : planilla.setActual
        ? "marcador"
        : "rotacion-home";
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
    const pasoConPendiente: Paso =
      pendiente?.tipo === "aplazado" ? "aplazado" : "terminado";
    // El set que se retoma arranca donde lo dejó la lluvia. Si el partido se
    // aplazó justo entre dos sets, no hay nada que retomar y el que sigue
    // arranca 0–0 como cualquiera.
    const enCurso = retomando ? (aplazado?.enCurso ?? null) : null;
    return {
      planilla,
      paso: pendiente ? pasoConPendiente : paso,
      alineaciones,
      // El saque viene marcado: "sacaba Aura" es verdad se juegue donde se
      // juegue. El lado NO, aunque lo tengamos guardado — "izquierda" es la
      // izquierda de la mesa, y la de hoy puede estar sentada en otra punta.
      saque: planilla.setActual?.saqueInicial
        ?? enCurso?.saca
        ?? saquePropuesto(planilla, bestOf),
      izquierda: retomando
        ? null
        : (planilla.setActual?.izquierda ?? izquierdaPropuesta(planilla, bestOf)),
      pendiente,
      vieneDe: enCurso ? { home: enCurso.home, away: enCurso.away } : null,
      yaCambiaronDeCancha: enCurso?.yaCambiaronDeCancha === true,
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
  /** El equipo que arranca el set a la izquierda de la mesa. */
  const [izquierda, setIzquierda] = useState<Lado | null>(inicial.izquierda);
  const [sinGuardado, setSinGuardado] = useState(false);
  /** Equipo cuyo cambio está abierto, o null. */
  const [cambioDe, setCambioDe] = useState<Lado | null>(null);
  /** El "¿cerramos el set?" abierto. */
  const [cerrando, setCerrando] = useState(false);
  /** El "¿aplazamos el partido?" abierto, con el motivo que escribe la mesa. */
  const [aplazando, setAplazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  /**
   * De dónde arranca el marcador del próximo set, cuando el partido viene
   * aplazado. Vive acá y no en la planilla porque el set todavía no existe: se
   * le pega recién al arrancarlo, igual que el saque y los lados.
   */
  const [vieneDe, setVieneDe] = useState<{ home: number; away: number } | null>(
    inicial.vieneDe
  );
  const [yaCambiaronDeCancha, setYaCambiaronDeCancha] = useState(
    inicial.yaCambiaronDeCancha
  );
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

  // El marcador en vivo del público: mientras el partido está en juego. Entre
  // dos sets también cuenta (la mesa está armando la rotación del siguiente).
  // Terminado o aplazado ya no: esas puertas lo sacan del en vivo.
  useMandarEnVivo(
    token,
    matchId,
    planilla,
    paso !== "terminado" && paso !== "aplazado" && paso !== "retomar"
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
      izquierdaAlCerrar: estado.izquierda,
      saqueInicial: setActual.saqueInicial,
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
    // Las dos cosas del sorteo se proponen al revés del set anterior: saca el
    // que recibió y cada uno cruza de cancha. En el decisivo ninguna de las dos
    // se propone, porque se sortea todo de nuevo.
    setSaqueInicial(saquePropuesto(siguiente, bestOf));
    setIzquierda(izquierdaPropuesta(siguiente, bestOf));
    // Lo que venía del aplazamiento se gastó en el set que se acaba de cerrar:
    // el que sigue arranca 0–0 como cualquier otro.
    setVieneDe(null);
    setYaCambiaronDeCancha(false);
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
    if (r.estado === "enviado") listo();
  };

  /** Se guardó: la mesa vuelve sola a sus partidos. Lo que sigue para ella es
   *  el próximo partido, no quedarse mirando esta pantalla. */
  const listo = () => {
    toast.success("Resultado guardado. El organizador ya lo ve.");
    onEnviado();
    onBack();
  };

  const listoAplazado = () => {
    toast.success("Partido aplazado. El organizador ya lo ve en su pestaña.");
    onEnviado();
    onBack();
  };

  /**
   * El partido se fue a la lluvia. Guarda por dónde iba y lo manda a Aplazados.
   *
   * No entra por la puerta del resultado: un 1-0 en un partido a 3 sets no es un
   * resultado de vóley y el servidor lo rechazaría, con razón. Va a una casilla
   * aparte, y el marcador del partido queda vacío hasta que se juegue de verdad.
   */
  const aplazarPartido = async () => {
    const texto = motivo.trim();
    if (!texto) {
      toast.error("Escribí por qué se aplazó el partido.");
      return;
    }
    const pendiente: EnvioPendiente = {
      token,
      matchId,
      tipo: "aplazado",
      creadoEn: new Date().toISOString(),
      cuerpo: {
        scorerName,
        motivo: texto,
        estado: armarAplazado(planilla, estado, texto, scorerName),
      },
    };
    encolar(pendiente);
    // La planilla se borra del teléfono ACÁ, apenas queda encolada, y no cuando
    // el servidor confirme. Si se dejara, la misma mesa con el mismo link
    // volvería a abrir el partido y entraría derecho al marcador viejo, con la
    // rotación de gente que ya no está, salteándose la pantalla que avisa que
    // venía aplazado. Lo anotado no se pierde: la foto ya está en la cola.
    borrarPlanilla(token, matchId);

    setAplazando(false);
    setCerrando(false);
    setPaso("aplazado");
    setEnvio("enviando");
    const r = await intentarEnviar(pendiente);
    setEnvio(r);
    if (r.estado === "enviado") listoAplazado();
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
    if (r.estado === "enviado") {
      if (pendiente.tipo === "aplazado") listoAplazado();
      else listo();
    }
  };

  const empezarElSet = () => {
    if (saqueInicial === null) {
      toast.error("Elegí quién saca primero.");
      return;
    }
    if (izquierda === null) {
      toast.error("Elegí qué equipo queda a la izquierda de la mesa.");
      return;
    }
    actualizar({
      ...planilla,
      setActual: {
        numero: planilla.setsCerrados.length + 1,
        alineacion: alineaciones,
        saqueInicial,
        izquierda,
        // Solo cuando el partido viene aplazado: el set arranca donde lo dejó
        // la lluvia, y si ese día ya se habían cambiado de cancha, el aviso de
        // los 8 puntos no vuelve a saltar.
        ...(vieneDe ? { vieneDe } : {}),
        ...(yaCambiaronDeCancha ? { cambioDeCanchaHecho: true } : {}),
        eventos: [],
      },
    });
    setPaso("marcador");
  };

  // ------------------------------------------------------------------
  // Paso 0 — este partido venía aplazado
  // ------------------------------------------------------------------
  //
  // Va antes de la rotación, que es donde la mesa toca primero. Y es una
  // pregunta y no algo automático a propósito: la mesa de hoy no estaba el día
  // de la lluvia y tiene que poder decir "acá dice 15–10 pero acordamos jugarlo
  // entero".
  if (paso === "retomar" && aplazado) {
    const cuenta = contarSets(planilla);
    const enCurso = aplazado.enCurso;
    const fecha = new Date(aplazado.aplazadoEn).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
    });
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <AvisoSinGuardado visible={sinGuardado} />
        <header className="border-b px-4 py-3">
          <p className="truncate text-sm text-muted-foreground">{tituloArriba}</p>
          <h1 className="truncate font-semibold">
            {homeTeamName} vs {awayTeamName}
          </h1>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="rounded-xl border-2 border-primary/50 bg-primary/10 p-4">
            <p className="flex items-center gap-2 text-lg font-bold">
              <CloudOff className="h-5 w-5 shrink-0 text-primary" />
              Este partido venía aplazado
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Aplazado el {fecha} por {aplazado.motivo}
              {aplazado.mesa ? `, anotaba ${aplazado.mesa}` : ""}.
            </p>
          </div>

          <div className="divide-y rounded-lg border">
            <div className="flex items-baseline justify-between px-3 py-3">
              <span className="text-sm text-muted-foreground">Va</span>
              <span className="text-2xl font-bold tabular-nums">
                {cuenta.home} – {cuenta.away}
              </span>
            </div>
            {planilla.setsCerrados.map((s2) => (
              <div key={s2.numero} className="flex justify-between px-3 py-2 text-sm">
                <span className="text-muted-foreground">Set {s2.numero}</span>
                <span className="font-semibold tabular-nums">
                  {s2.homePoints} – {s2.awayPoints}
                </span>
              </div>
            ))}
            {enCurso && (
              <div className="flex justify-between bg-primary/5 px-3 py-2 text-sm">
                <span className="font-semibold">Set {enCurso.n}, a medias</span>
                <span className="font-bold tabular-nums">
                  {enCurso.home} – {enCurso.away}
                </span>
              </div>
            )}
          </div>

          {enCurso ? (
            <p className="text-sm text-muted-foreground">
              El set {enCurso.n} se retoma en{" "}
              <span className="font-semibold text-foreground">
                {enCurso.home}–{enCurso.away}
              </span>
              . La rotación se carga de cero: pueden jugar otros. Ese día sacaba{" "}
              <span className="font-semibold text-foreground">
                {nombre[enCurso.saca]}
              </span>{" "}
              y{" "}
              <span className="font-semibold text-foreground">
                {nombre[enCurso.izquierda]}
              </span>{" "}
              estaba a la izquierda de la mesa.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Se aplazó justo entre dos sets, así que el set {cuenta.home + cuenta.away + 1}{" "}
              arranca de cero.
            </p>
          )}

          <div className="mt-auto space-y-2">
            <Button
              className="h-14 w-full text-base"
              onClick={() => setPaso("rotacion-home")}
            >
              {enCurso
                ? `Retomar en ${enCurso.home}–${enCurso.away}`
                : "Seguir el partido"}
            </Button>
            {/* La salida para cuando los dos equipos acordaron jugarlo entero
                otra vez. Sin esto, un partido queda condenado a retomarse en
                15–10 para siempre. */}
            <Button
              variant="outline"
              className="h-12 w-full"
              onClick={() => {
                const limpia = planillaNueva(matchId, jugadoresEnCancha);
                actualizar(limpia);
                setVieneDe(null);
                setYaCambiaronDeCancha(false);
                setSaqueInicial(null);
                setIzquierda(null);
                setPaso("rotacion-home");
              }}
            >
              Empezar todo de cero
            </Button>
          </div>
        </div>

        <footer className="border-t p-4">
          <Button variant="outline" className="h-12 w-full text-base" onClick={onBack}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Volver a los partidos
          </Button>
        </footer>
      </div>
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
        {/* Una por equipo: sin la key, React reusa la de local para visitante
            y el teclado arranca con la posición que había quedado abierta. */}
        <LineupScreen
          key={lado}
          tituloArriba={tituloArriba}
          teamName={nombre[lado]}
          rivalName={nombre[lado === "home" ? "away" : "home"]}
          jugadoresEnCancha={jugadoresEnCancha}
          paso={lado === "home" ? "Paso 1 de 2" : "Paso 2 de 2"}
          nomina={planilla.nomina[lado]}
          onNominaChange={(n: Etiqueta[]) =>
            actualizar({ ...planilla, nomina: { ...planilla.nomina, [lado]: n } })
          }
          alineacion={alineaciones[lado]}
          onChange={(alineacion) =>
            setAlineaciones((prev) => ({ ...prev, [lado]: alineacion }))
          }
          onBack={lado === "home" ? onBack : () => setPaso("rotacion-home")}
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
    const numeroDelSet = planilla.setsCerrados.length + 1;
    const decisivo = esSetDecisivo(numeroDelSet, bestOf);
    return (
      <div className="min-h-dvh flex flex-col bg-background">
        <AvisoSinGuardado visible={sinGuardado} />
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-muted-foreground">{tituloArriba}</p>
            <h1 className="truncate font-semibold">Set {planilla.setsCerrados.length + 1}</h1>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          {vieneDe && (
            <div className="rounded-xl border-2 border-primary/50 bg-primary/10 p-3 text-sm">
              <span className="font-semibold">
                El set {numeroDelSet} se retoma en {vieneDe.home}–{vieneDe.away}.
              </span>{" "}
              Viene del día que se aplazó el partido. El marcador arranca ahí y
              no en cero.
            </div>
          )}

          <div>
            <h2 className="text-2xl font-bold">¿Quién saca primero?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Es lo último que falta. De acá en adelante la app lleva sola la
              rotación y el saque.
            </p>
            {decisivo && (
              <p className="mt-2 text-sm font-semibold text-primary">
                Set decisivo: se sortean de nuevo el saque y la cancha.
              </p>
            )}
            {vieneDe && aplazado?.enCurso ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Ya está marcado{" "}
                <span className="font-semibold text-foreground">
                  {nombre[aplazado.enCurso.saca]}
                </span>
                , que era el que sacaba cuando se aplazó. Si hoy saca el otro,
                tocá el otro.
              </p>
            ) : (
              saqueInicial !== null &&
              numeroDelSet > 1 &&
              !decisivo && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Ya está marcado el que recibió en el set anterior. Si sacó
                  otro, tocá el otro.
                </p>
              )
            )}
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

          {/* El otro dato del sorteo: de qué lado queda cada uno. En los sets
              del medio ya viene marcado al revés del anterior. */}
          <div className="space-y-2">
            <h3 className="text-lg font-bold">¿Quién queda a la izquierda de la mesa?</h3>
            {/* Un lado que se decidió desde otra silla no se marca, se cuenta.
                "Izquierda" es la izquierda de LA MESA, y la de hoy puede estar
                sentada en otra punta, en otra cancha o del otro lado del
                coliseo: marcarlo confundiría más de lo que ayuda. */}
            {vieneDe && aplazado?.enCurso ? (
              <p className="text-sm text-muted-foreground">
                Ese día,{" "}
                <span className="font-semibold text-foreground">
                  {nombre[aplazado.enCurso.izquierda]}
                </span>{" "}
                estaba a la izquierda de la mesa. Elegí mirando la cancha de hoy.
              </p>
            ) : (
              izquierda !== null &&
              numeroDelSet > 1 &&
              !decisivo && (
                <p className="text-sm text-muted-foreground">
                  Cambiaron de cancha, ya está marcado al revés del set
                  anterior. Si no cambiaron, tocá el otro.
                </p>
              )
            )}
            <div className="grid grid-cols-2 gap-2">
              {(["home", "away"] as Lado[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setIzquierda(l)}
                  className={`rounded-xl border-2 p-3 text-center transition-colors ${
                    izquierda === l
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-accent"
                  }`}
                >
                  <span className="block truncate font-bold">{nombre[l]}</span>
                </button>
              ))}
            </div>
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
      <div className="flex min-h-dvh flex-col bg-background">
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
          {envio === "enviando" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Mandando el resultado...
            </p>
          ) : (
            <Button variant="outline" className="h-12" onClick={onBack}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Volver a los partidos
            </Button>
          )}
        </div>

        {envio !== null && envio !== "enviando" && envio.estado !== "enviado" && (
          <ModalDelEnvio
            envio={envio}
            onReintentar={reintentar}
            onMasTarde={onBack}
          />
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Partido aplazado — el aplazamiento sale para el servidor
  // ------------------------------------------------------------------
  if (paso === "aplazado") {
    const cuenta = contarSets(planilla);
    const aMedias = planilla.setActual;
    const puntosAMedias = aMedias ? estadoDelSet(aMedias).puntos : null;
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <AvisoSinGuardado visible={sinGuardado} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <CloudOff className="h-12 w-12 text-primary" />
          <div>
            <p className="text-xl font-bold">Partido aplazado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Se retoma en este mismo marcador cuando el organizador lo
              reprograme.
            </p>
          </div>
          <div className="w-full max-w-sm divide-y rounded-lg border text-sm">
            <div className="flex items-baseline justify-between px-3 py-3">
              <span className="text-muted-foreground">Va</span>
              <span className="text-2xl font-bold tabular-nums">
                {cuenta.home} – {cuenta.away}
              </span>
            </div>
            {planilla.setsCerrados.map((s2) => (
              <div key={s2.numero} className="flex justify-between px-3 py-2">
                <span className="text-muted-foreground">Set {s2.numero}</span>
                <span className="font-semibold tabular-nums">
                  {s2.homePoints} – {s2.awayPoints}
                </span>
              </div>
            ))}
            {aMedias && puntosAMedias && (
              <div className="flex justify-between bg-primary/5 px-3 py-2">
                <span className="font-semibold">Set {aMedias.numero}, a medias</span>
                <span className="font-bold tabular-nums">
                  {puntosAMedias.home} – {puntosAMedias.away}
                </span>
              </div>
            )}
          </div>
          {envio === "enviando" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Mandando el aplazamiento...
            </p>
          ) : (
            <Button variant="outline" className="h-12" onClick={onBack}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Volver a los partidos
            </Button>
          )}
        </div>

        {envio !== null && envio !== "enviando" && envio.estado !== "enviado" && (
          <ModalDelEnvio
            envio={envio}
            onReintentar={reintentar}
            onMasTarde={onBack}
          />
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------
  // El marcador
  // ------------------------------------------------------------------
  if (!setActual || !estado) {
    // No debería pasar: el paso "marcador" solo se alcanza con un set abierto.
    // Si pasa, se vuelve a la nómina en vez de dejar la pantalla en blanco.
    setPaso("rotacion-home");
    return null;
  }

  const ganados = contarSets(planilla);
  const avisoCancha = avisoDeCambioDeCancha(setActual, estado, bestOf);
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
        onCambiarDeLado={() => agregarEvento({ t: "cambio-de-cancha" })}
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

      {/* El cambio de cancha del set decisivo. Pregunta y no cambia solo: si
          los lados se dieran vuelta sin aviso, la mesa tocaría el botón del
          equipo equivocado justo en ese punto. */}
      {avisoCancha !== null && !cerrando && !cambioDe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-background p-5 text-center">
            <div>
              <h2 className="text-2xl font-bold">Cambio de cancha</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {nombre[estado.puntos.home >= estado.puntos.away ? "home" : "away"]}{" "}
                llegó a {avisoCancha}. En el set decisivo los equipos cambian de
                lado.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                className="h-14 w-full text-base"
                onClick={() => agregarEvento({ t: "cambio-de-cancha" })}
              >
                Ya cambiaron
              </Button>
              <Button
                variant="outline"
                className="h-12 w-full"
                onClick={() =>
                  actualizar({
                    ...planilla,
                    setActual: {
                      ...setActual,
                      avisosDeCanchaDescartados: [
                        ...(setActual.avisosDeCanchaDescartados ?? []),
                        avisoCancha,
                      ],
                    },
                  })
                }
              >
                No cambian
              </Button>
            </div>
          </div>
        </div>
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
            {/* En el orden de los lados, igual que el marcador de atrás. */}
            <p className="text-center text-4xl font-bold tabular-nums">
              {estado.izquierda === "home"
                ? `${estado.puntos.home} – ${estado.puntos.away}`
                : `${estado.puntos.away} – ${estado.puntos.home}`}
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
            {/* La salida cuando se fue a la lluvia. Va acá, chiquita y abajo,
                por dos razones: al lado de los botones de punto se aprieta sin
                querer y se arruina un partido, y este cartel es la zona de las
                cosas que se hacen una vez. Y va SIEMPRE visible, sin importar
                el marcador: "Cerrar set" se bloquea con el set empatado, así
                que si llueve a 0–0 o a 3–3 por ese camino no habría forma de
                aplazar. */}
            <button
              type="button"
              onClick={() => {
                setCerrando(false);
                setMotivo("");
                setAplazando(true);
              }}
              className="w-full py-1 text-center text-sm text-muted-foreground underline underline-offset-4"
            >
              El partido se aplazó
            </button>
          </div>
        </div>
      )}

      {aplazando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-background p-5">
            <div>
              <h2 className="text-lg font-bold">El partido queda aplazado</h2>
              {/* Decir en palabras lo que se va a guardar, igual que el cambio
                  dice "Entra el 8 por el 9": se lee antes de apretar. */}
              <p className="mt-1 text-sm text-muted-foreground">
                Va{" "}
                <span className="font-semibold text-foreground">
                  {ganados.home}–{ganados.away}
                </span>{" "}
                y el set {setActual.numero} iba{" "}
                <span className="font-semibold text-foreground">
                  {estado.puntos.home}–{estado.puntos.away}
                </span>
                . Cuando se reprograme se retoma justo ahí.
              </p>
            </div>
            <div className="space-y-1">
              <label htmlFor="motivo-aplazo" className="text-sm font-medium">
                ¿Por qué se aplazó?
              </label>
              <Input
                id="motivo-aplazo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Lluvia"
                maxLength={200}
                className="h-12"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-12 flex-1"
                onClick={() => setAplazando(false)}
              >
                Seguir anotando
              </Button>
              <Button
                className="h-12 flex-1"
                disabled={!motivo.trim()}
                onClick={aplazarPartido}
              >
                Guardar
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
 * El envío no salió: qué pasó y qué puede hacer la mesa.
 *
 * Va en un modal y no en una caja al costado porque es lo único que queda por
 * resolver en esa pantalla: el partido ya está anotado y guardado, y si esto se
 * puede pasar por alto, la mesa se va creyendo que el organizador ya lo tiene.
 *
 * Las dos salidas son de verdad salidas. "Volver a intentar" es para cuando la
 * señal volvió mientras leía. "Más tarde" la devuelve a sus partidos y deja el
 * resultado en la cola, que sale solo cuando haya red: no es rendirse, es no
 * tener que quedarse esperando.
 */
function ModalDelEnvio({
  envio,
  onReintentar,
  onMasTarde,
}: {
  envio: Exclude<ResultadoDelEnvio, { estado: "enviado" }>;
  onReintentar: () => void;
  onMasTarde: () => void;
}) {
  const sinRed = envio.estado === "sin-red";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-background p-5">
        <div className="flex gap-3">
          {sinRed ? (
            <CloudOff className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
          ) : (
            <TriangleAlert className="mt-0.5 h-6 w-6 shrink-0 text-destructive" />
          )}
          <div>
            <h2 className="text-lg font-bold">
              {sinRed ? "No hay internet ahora" : "No se pudo guardar"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {sinRed
                ? "El resultado quedó guardado en el teléfono y se manda solo cuando vuelva la señal. No se pierde aunque cierres la página."
                : envio.mensaje}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button className="h-12 w-full text-base" onClick={onReintentar}>
            Volver a intentar
          </Button>
          <Button
            variant="outline"
            className="h-12 w-full text-base"
            onClick={onMasTarde}
          >
            {sinRed ? "Intentar más tarde" : "Seguir con otros partidos"}
          </Button>
        </div>
      </div>
    </div>
  );
}
