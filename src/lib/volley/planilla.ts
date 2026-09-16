/**
 * El modelo de la planilla en vivo de vóley.
 *
 * Acá no hay pantallas ni base de datos: solo el dato y las cuentas que salen
 * de él. Las pantallas lo dibujan y el almacenamiento lo guarda, pero la verdad
 * de lo que pasó en el set vive en este archivo.
 *
 * LA DECISIÓN QUE ORDENA TODO: el estado del set es la LISTA DE EVENTOS, no un
 * par de numeritos. El marcador, quién saca, quién está en cada posición, los
 * tiempos que quedan y quién está atado con quién NO se guardan: se calculan
 * leyendo la lista desde el arranque. Dos razones:
 *
 *   1. Nada se puede desincronizar. Si el marcador y los seis en cancha salieran
 *      de dos lugares distintos, tarde o temprano dirían cosas distintas, y una
 *      planilla que se contradice a sí misma no la usa nadie dos veces.
 *   2. Deshacer es quitar el último evento. Sin esto, deshacer sería revertir a
 *      mano una rotación, un marcador y un saque, que es donde viven los bugs.
 *
 * El costo es recorrer la lista en cada dibujo. Un set son unos 50 eventos: no
 * es un problema ni de lejos.
 *
 * LAS ETIQUETAS NO SON JUGADORES. Un jugador acá es el texto que la mesa ve en
 * la camiseta: "7", "12", o una letra si no tiene dorsal. No se relaciona con la
 * nómina del torneo (decisión del dueño, 2026-09-06). Por eso todo es `string` y
 * nunca un id: el día que se quieran estadísticas por jugador habrá que atarlas,
 * y ese día se agrega un campo al lado sin romper lo viejo.
 *
 * Ver `Por hacer/planilla-en-vivo-volley.md`.
 */

/** El número de camiseta como lo ve la mesa. Puede ser una letra. */
export type Etiqueta = string;

export type Lado = "home" | "away";

/** Las posiciones de la cancha, en orden de rotación: el índice 0 es la
 *  posición 1, la que saca. Un hueco es una posición que arrancó vacía porque
 *  al equipo le faltó gente. */
export type Alineacion = (Etiqueta | null)[];

/**
 * Lo que puede pasar dentro de un set, en orden.
 *
 * Un punto no dice el marcador: el marcador se cuenta. Un cambio no dice la
 * posición: la posición se busca. Cada evento guarda lo mínimo que no se puede
 * deducir, porque todo lo que se guarda de más es algo que puede contradecir al
 * resto.
 */
export type Evento =
  | { t: "punto"; equipo: Lado }
  | { t: "cambio"; equipo: Lado; sale: Etiqueta; entra: Etiqueta }
  | { t: "tiempo"; equipo: Lado }
  /** El que llegó tarde ocupa una posición que arrancó vacía. NO es un cambio:
   *  no gasta cambio y no ata a nadie con nadie. Guarda la posición y no a
   *  quién reemplaza, justamente porque no reemplaza a nadie. */
  | { t: "completar"; equipo: Lado; posicion: number; entra: Etiqueta }
  /** Los equipos se cambiaron de cancha en medio del set (el decisivo, a los 8).
   *  Solo cambia qué equipo se dibuja a la izquierda de la mesa: la rotación y
   *  el saque no se tocan. Es un evento y no un dato suelto para que Deshacer
   *  lo revierta igual que un punto. */
  | { t: "cambio-de-cancha" };

export interface SetEnJuego {
  /** 1 para el primer set. */
  numero: number;
  /** Los que arrancaron en cancha, por equipo. Largo = jugadores en cancha. */
  alineacion: Record<Lado, Alineacion>;
  /** Quién sacó el primer punto del set. */
  saqueInicial: Lado;
  /**
   * De dónde arranca el marcador de este set. Solo lo tiene un set que se
   * retoma de un partido aplazado; en un set normal no existe y arranca 0–0.
   *
   * Es un punto de partida y NO una lista de puntos inventados: los puntos de
   * antes de la lluvia no son eventos de este set. Por eso Deshacer no puede
   * bajar de acá (correcto: eso pasó otro día), el historial no muestra puntos
   * que nadie anotó, y la rotación gira desde la rotación de hoy en vez de dar
   * veinticinco vueltas con jugadores que no estaban.
   */
  vieneDe?: { home: number; away: number };
  /** Los equipos ya se cambiaron de cancha en este set decisivo, aunque el
   *  cambio no esté en la lista de eventos: pasó antes de que se aplazara. Sin
   *  esto, el aviso de los 8 puntos vuelve a saltar al retomar. */
  cambioDeCanchaHecho?: boolean;
  /**
   * El equipo que arrancó el set a la izquierda de la mesa. Opcional porque las
   * planillas guardadas antes del 2026-09-13 no lo tienen: ahí es el local.
   */
  izquierda?: Lado;
  /** Los avisos de cambio de cancha que la mesa contestó "No cambian", por
   *  puntaje (8, 13). No es un evento a propósito: Deshacer quita puntos, no
   *  tiene que volver a abrir un aviso ya contestado. */
  avisosDeCanchaDescartados?: number[];
  eventos: Evento[];
}

export interface SetCerrado {
  numero: number;
  homePoints: number;
  awayPoints: number;
  /** Quién estaba a la izquierda al terminar. De acá sale la propuesta del set
   *  siguiente, que es al revés. No viaja al servidor. */
  izquierdaAlCerrar?: Lado;
  /** Quién sacó el primer punto de este set. De acá sale la propuesta de saque
   *  del set siguiente: saca el que recibió. Opcional porque las planillas
   *  guardadas antes del 2026-09-15 no lo tienen; ahí no se propone nada y la
   *  mesa lo elige como siempre. No viaja al servidor. */
  saqueInicial?: Lado;
}

export interface Planilla {
  /** Sube cuando cambia la forma del dato guardado. Ver `planilla-storage`. */
  version: 1;
  matchId: string;
  /** Cuántos juegan por equipo en este torneo (4, 5 o 6). */
  jugadoresEnCancha: number;
  /** Todos los que pueden entrar hoy, titulares y banco, en orden de anotación. */
  nomina: Record<Lado, Etiqueta[]>;
  setsCerrados: SetCerrado[];
  /** El set que se está jugando, o `null` si todavía no arrancó ninguno. */
  setActual: SetEnJuego | null;
}

// ============================================================
// La cancha: qué posición va dónde
// ============================================================

/**
 * Las dos filas de la cancha, como las ve la mesa parada detrás de la línea de
 * fondo: arriba la red, abajo el fondo. Devuelve números de posición en el
 * orden en que se dibujan, de izquierda a derecha.
 *
 * La posición 1 es la que saca y va abajo a la derecha. De ahí para atrás, el
 * fondo de derecha a izquierda es 1, 6, 5 y el frente de derecha a izquierda es
 * 2, 3, 4 — que es la vuelta completa de la rotación.
 *
 * Con menos de seis, el frente se queda con las posiciones 2, 3 y 4 que haya y
 * el resto va al fondo con la 1. El fondo nunca baja de dos: el que saca no
 * puede quedar solo atrás.
 *
 *   6 jugadores → frente 4 3 2 · fondo 5 6 1
 *   5 jugadores → frente 4 3 2 · fondo 5 1
 *   4 jugadores → frente   3 2 · fondo 4 1
 */
export function filasDeLaCancha(jugadoresEnCancha: number): {
  frente: number[];
  fondo: number[];
} {
  // La última del frente es la 4, pero nunca la última de todas: si con cuatro
  // jugadores el frente se llevara la 2, la 3 y la 4, atrás quedaría solo el
  // que saca y la cancha se dibujaría 3 contra 1.
  const ultimaDelFrente = Math.min(4, jugadoresEnCancha - 1);
  const frente: number[] = [];
  for (let pos = 2; pos <= ultimaDelFrente; pos++) frente.push(pos);
  const fondo: number[] = [1];
  for (let pos = jugadoresEnCancha; pos > ultimaDelFrente; pos--) fondo.push(pos);
  // Las dos filas se arman de derecha a izquierda, que es como se cuenta la
  // rotación. Se dan vuelta para dibujarlas de izquierda a derecha.
  return { frente: frente.reverse(), fondo: fondo.reverse() };
}

/** El índice dentro de la alineación que le corresponde a una posición. La
 *  posición 1 es el índice 0. */
export function indiceDePosicion(posicion: number): number {
  return posicion - 1;
}

// ============================================================
// La rotación
// ============================================================

/**
 * Rota una vez. El de la posición 2 pasa a la 1, el de la 1 pasa a la última, y
 * así — o sea, correr el arreglo un lugar hacia adelante.
 *
 * Los huecos rotan como uno más: una posición vacía tiene que dar la vuelta
 * igual que un jugador, porque si se quedara quieta el equipo terminaría con
 * dos jugadores en la misma posición.
 */
export function rotar(alineacion: Alineacion): Alineacion {
  if (alineacion.length === 0) return alineacion;
  return [...alineacion.slice(1), alineacion[0]];
}

// ============================================================
// El estado del set, leído de la lista de eventos
// ============================================================

export interface EstadoDelSet {
  puntos: Record<Lado, number>;
  /** Quién tiene el saque ahora. */
  saca: Lado;
  /** Quién está en cada posición ahora, ya rotado. */
  enCancha: Record<Lado, Alineacion>;
  /** Tiempos pedidos en este set. El tope son dos por equipo. */
  tiemposUsados: Record<Lado, number>;
  /** Cambios hechos en este set. Hoy no hay tope (decisión del 2026-09-12),
   *  pero el número se muestra. */
  cambiosHechos: Record<Lado, number>;
  /**
   * Quién quedó atado con quién por un cambio, en los dos sentidos: si el 8
   * entró por el 10, acá están `8 → 10` y `10 → 8`.
   *
   * Sirve para AVISAR, no para bloquear: el dueño decidió el 2026-09-12 que la
   * mesa puede hacer el cambio igual y la pantalla advierte. Hay ligas que no
   * aplican esta regla, y una planilla que le dice "no" a la mesa en media
   * cancha es peor que una que le avisa.
   */
  atados: Record<Lado, Record<Etiqueta, Etiqueta>>;
  /** El equipo que está ahora a la izquierda de la mesa. */
  izquierda: Lado;
}

/** Recorre la lista de eventos desde el arranque y devuelve cómo está el set
 *  ahora mismo. Es la única fuente de verdad de la pantalla del marcador. */
export function estadoDelSet(set: SetEnJuego): EstadoDelSet {
  const estado: EstadoDelSet = {
    // Un set normal arranca en 0–0; uno que se retoma de un partido aplazado
    // arranca donde lo dejó la lluvia.
    puntos: { home: set.vieneDe?.home ?? 0, away: set.vieneDe?.away ?? 0 },
    saca: set.saqueInicial,
    enCancha: {
      home: [...set.alineacion.home],
      away: [...set.alineacion.away],
    },
    tiemposUsados: { home: 0, away: 0 },
    cambiosHechos: { home: 0, away: 0 },
    atados: { home: {}, away: {} },
    izquierda: set.izquierda ?? "home",
  };

  for (const ev of set.eventos) {
    if (ev.t === "punto") {
      estado.puntos[ev.equipo]++;
      // Se rota solo cuando el punto lo gana el que NO estaba sacando: ahí
      // recupera el saque y da la vuelta. El que ya sacaba sigue igual.
      if (ev.equipo !== estado.saca) {
        estado.enCancha[ev.equipo] = rotar(estado.enCancha[ev.equipo]);
        estado.saca = ev.equipo;
      }
    } else if (ev.t === "completar") {
      estado.enCancha[ev.equipo][indiceDePosicion(ev.posicion)] = ev.entra;
    } else if (ev.t === "cambio") {
      const cancha = estado.enCancha[ev.equipo];
      const i = cancha.indexOf(ev.sale);
      if (i >= 0) cancha[i] = ev.entra;
      estado.cambiosHechos[ev.equipo]++;
      estado.atados[ev.equipo][ev.entra] = ev.sale;
      estado.atados[ev.equipo][ev.sale] = ev.entra;
    } else if (ev.t === "tiempo") {
      estado.tiemposUsados[ev.equipo]++;
    } else {
      estado.izquierda = otroLado(estado.izquierda);
    }
  }

  return estado;
}

/** Los que están en el banco: la nómina menos los que están en cancha. */
export function enElBanco(
  planilla: Planilla,
  estado: EstadoDelSet,
  lado: Lado
): Etiqueta[] {
  const cancha = new Set(estado.enCancha[lado].filter((e): e is Etiqueta => e !== null));
  return planilla.nomina[lado].filter((e) => !cancha.has(e));
}

// ============================================================
// Armar y validar
// ============================================================

export const TIEMPOS_POR_SET = 2;

// ============================================================
// Los lados de la cancha
// ============================================================
//
// La mesa ve a un equipo a su izquierda y al otro a su derecha, y la pantalla
// tiene que dibujarlos igual: si no, se toca el botón del lado equivocado.
// Reglas que trajo el dueño el 2026-09-13:
//
//   - Set 1: lo define el sorteo, lo dice la mesa.
//   - Sets del medio: cambian de cancha al terminar cada set. La app lo propone
//     al revés del anterior y la mesa lo puede corregir.
//   - Set decisivo (el 3.º de 3, el 5.º de 5): sorteo otra vez, y a mitad de set
//     cambian de cancha.
//
// El saque va igual (dueño, 2026-09-15): en el set 1 lo dice la mesa, en los del
// medio saca el que recibió en el anterior —o sea, al revés, como la cancha— y
// en el decisivo se sortea de nuevo junto con el lado.

export function otroLado(lado: Lado): Lado {
  return lado === "home" ? "away" : "home";
}

/** El último set posible del partido: el que se sortea de nuevo. */
export function esSetDecisivo(numero: number, bestOf: number): boolean {
  return numero === bestOf;
}

/**
 * Cuándo se avisa el cambio de cancha en el set decisivo. A los 8 es el set a
 * 15; a los 13 es para los torneos que juegan el decisivo a 25. La app no sabe a
 * cuánto se juega (lo cierra la mesa), así que pregunta a los 8 y, si le dicen
 * que no cambian, vuelve a preguntar a los 13.
 */
export const PUNTOS_PARA_CAMBIO_DE_CANCHA = [8, 13];

/**
 * El lado que se propone para el set que sigue, o `null` si hay que preguntarlo
 * (el primero y el decisivo, que se sortean). Sale al revés de como terminó el
 * set anterior.
 */
export function izquierdaPropuesta(planilla: Planilla, bestOf: number): Lado | null {
  const numero = planilla.setsCerrados.length + 1;
  if (numero === 1 || esSetDecisivo(numero, bestOf)) return null;
  const anterior = planilla.setsCerrados[planilla.setsCerrados.length - 1];
  return anterior?.izquierdaAlCerrar ? otroLado(anterior.izquierdaAlCerrar) : null;
}

/**
 * Quién se propone que saque primero en el set que sigue, o `null` si hay que
 * preguntarlo (el primero y el decisivo, que se sortean).
 *
 * Saca el que recibió en el set anterior, así que sale al revés igual que el
 * lado. Es una propuesta y no una imposición: la mesa la puede corregir de un
 * toque, como la de la cancha.
 */
export function saquePropuesto(planilla: Planilla, bestOf: number): Lado | null {
  const numero = planilla.setsCerrados.length + 1;
  if (numero === 1 || esSetDecisivo(numero, bestOf)) return null;
  const anterior = planilla.setsCerrados[planilla.setsCerrados.length - 1];
  return anterior?.saqueInicial ? otroLado(anterior.saqueInicial) : null;
}

/**
 * El puntaje del aviso de cambio de cancha que hay que mostrar ahora, o `null`.
 *
 * Solo en el set decisivo, y solo mientras no se hayan cambiado todavía: un
 * cambio de cancha ya anotado —por el aviso o por el botón— lo apaga.
 */
export function avisoDeCambioDeCancha(
  set: SetEnJuego,
  estado: EstadoDelSet,
  bestOf: number
): number | null {
  if (!esSetDecisivo(set.numero, bestOf)) return null;
  if (set.cambioDeCanchaHecho) return null;
  if (set.eventos.some((e) => e.t === "cambio-de-cancha")) return null;
  const maximo = Math.max(estado.puntos.home, estado.puntos.away);
  const descartados = set.avisosDeCanchaDescartados ?? [];
  return (
    PUNTOS_PARA_CAMBIO_DE_CANCHA.find((p) => maximo >= p && !descartados.includes(p)) ??
    null
  );
}

/** Una planilla vacía, antes de anotar a nadie. */
export function planillaNueva(matchId: string, jugadoresEnCancha: number): Planilla {
  return {
    version: 1,
    matchId,
    jugadoresEnCancha,
    nomina: { home: [], away: [] },
    setsCerrados: [],
    setActual: null,
  };
}

// ============================================================
// Aplazar a mitad de camino
// ============================================================
//
// Un partido que se va a la lluvia en el segundo set no es un resultado: un 1-0
// en un partido a 3 sets no existe, y `validateVolleyballSets` lo rechaza a
// propósito. Por eso lo que va quedando no se escribe en el marcador del
// partido sino en una casilla aparte (`matches.volley_partial_state`), que leen
// solo la pestaña de Aplazados y la planilla el día que se reprograme.
//
// Es lo mismo que se hace en papel: la hoja a medio llenar va a una carpeta, no
// al acta del torneo. Ver `Por hacer/APLAZADO-PLANILLA-URGENTE.md`.

/** Cómo iba un partido la última vez que se aplazó. Es lo que viaja al servidor
 *  y lo que vuelve el día que se juegue. */
export interface EstadoAplazado {
  setsCerrados: { n: number; home: number; away: number }[];
  /** El set que se estaba jugando. `null` si se aplazó justo entre dos sets. */
  enCurso: {
    n: number;
    home: number;
    away: number;
    /** Quién estaba sacando. El día que se retome viene marcado: es un dato
     *  absoluto, no depende de dónde se siente la mesa. */
    saca: Lado;
    /** Quién estaba a la izquierda de la mesa ESE día. Se guarda para
     *  mostrarlo, no para marcarlo: la mesa de hoy puede estar sentada en otra
     *  punta, y un lado decidido desde otra silla confunde más de lo que ayuda. */
    izquierda: Lado;
    yaCambiaronDeCancha: boolean;
  } | null;
  motivo: string;
  aplazadoEn: string;
  /** Quién estaba anotando ese día, para que el organizador sepa a quién
   *  preguntarle. */
  mesa: string;
}

/** Arma la foto de cómo va el partido, para mandarla al aplazarlo. */
export function armarAplazado(
  planilla: Planilla,
  estado: EstadoDelSet | null,
  motivo: string,
  mesa: string
): EstadoAplazado {
  const set = planilla.setActual;
  return {
    setsCerrados: planilla.setsCerrados.map((s) => ({
      n: s.numero,
      home: s.homePoints,
      away: s.awayPoints,
    })),
    enCurso:
      set && estado
        ? {
            n: set.numero,
            home: estado.puntos.home,
            away: estado.puntos.away,
            saca: estado.saca,
            izquierda: estado.izquierda,
            // Se pierde el matiz de "la mesa dijo que no cambiaban a los 8 pero
            // todavía falta preguntarle a los 13". Es un aviso, no un dato del
            // partido, y no vale una vuelta más de complejidad.
            yaCambiaronDeCancha:
              set.cambioDeCanchaHecho === true ||
              set.eventos.some((e) => e.t === "cambio-de-cancha"),
          }
        : null,
    motivo,
    aplazadoEn: new Date().toISOString(),
    mesa,
  };
}

/**
 * La planilla con la que arranca el día que el partido se retoma.
 *
 * Trae los sets ya cerrados y nada más: la nómina y la rotación se cargan de
 * cero porque probablemente no vayan los mismos jugadores. El marcador del set
 * a medias no va acá — va en `vieneDe` cuando la mesa arranque el set, después
 * de elegir el saque y los lados.
 */
export function planillaDesdeAplazado(
  matchId: string,
  jugadoresEnCancha: number,
  aplazado: EstadoAplazado
): Planilla {
  return {
    version: 1,
    matchId,
    jugadoresEnCancha,
    nomina: { home: [], away: [] },
    setsCerrados: aplazado.setsCerrados.map((s) => ({
      numero: s.n,
      homePoints: s.home,
      awayPoints: s.away,
    })),
    setActual: null,
  };
}

/**
 * Limpia una etiqueta escrita por la mesa. Sin espacios y en mayúscula, para
 * que "a" y "A" no entren como dos jugadores distintos.
 */
export function normalizarEtiqueta(texto: string): Etiqueta {
  return texto.trim().toUpperCase();
}

/** Devuelve el error, o `null` si la etiqueta se puede agregar. El mensaje se
 *  le muestra tal cual a la mesa. */
export function validarEtiqueta(
  etiqueta: Etiqueta,
  yaAnotados: Etiqueta[]
): string | null {
  if (etiqueta.length === 0) return "Escribí un número o una letra.";
  if (etiqueta.length > 3) return "Máximo 3 caracteres.";
  if (yaAnotados.includes(etiqueta)) return `El ${etiqueta} ya está anotado.`;
  return null;
}

/** Una alineación vacía del largo que corresponda. */
export function alineacionVacia(jugadoresEnCancha: number): Alineacion {
  return Array.from({ length: jugadoresEnCancha }, () => null);
}

/** Cuántas posiciones quedaron sin llenar. Cero es lo normal; más de cero es el
 *  equipo que arranca con menos gente de la que corresponde. */
export function huecos(alineacion: Alineacion): number {
  return alineacion.filter((e) => e === null).length;
}

// ============================================================
// Contar sets
// ============================================================

/**
 * Quién ganó el set con ese marcador, o `null` si están iguales.
 *
 * No dice si el set está TERMINADO: eso no se puede saber sin las reglas de
 * cada liga. Hay relámpagos que juegan los sets a 21 o a 15, y el decisivo casi
 * siempre es más corto, así que el que cierra el set es la mesa y no la app.
 */
export function ganadorDelSet(homePoints: number, awayPoints: number): Lado | null {
  if (homePoints === awayPoints) return null;
  return homePoints > awayPoints ? "home" : "away";
}

/** Sets ganados por cada lado, contando los ya cerrados. */
export function setsGanados(planilla: Planilla): Record<Lado, number> {
  const cuenta: Record<Lado, number> = { home: 0, away: 0 };
  for (const s of planilla.setsCerrados) {
    const g = ganadorDelSet(s.homePoints, s.awayPoints);
    if (g) cuenta[g]++;
  }
  return cuenta;
}

// ============================================================
// El historial: los últimos puntos, como los lee la mesa
// ============================================================

export interface LineaDelHistorial {
  /** Dónde está este evento en la lista. El último es el que deshace el botón. */
  indice: number;
  puntos: Record<Lado, number>;
  evento: Evento;
  /** Si el equipo que ganó el punto rotó (o sea, recuperó el saque). */
  roto: boolean;
  /** Quién quedó sacando después de este evento, y con qué jugador. */
  saca: Lado;
  sacador: Etiqueta | null;
}

/**
 * Vuelve a recorrer el set y arma una línea por evento, con el marcador como
 * quedó en ese momento.
 *
 * Existe para que la mesa pueda mirar atrás y darse cuenta de un punto mal
 * cargado antes de que se le escape: sin esto, el único dato en pantalla es el
 * marcador de ahora, y un error de hace tres puntos ya no se ve.
 */
export function historial(set: SetEnJuego): LineaDelHistorial[] {
  const lineas: LineaDelHistorial[] = [];
  // Mismo arranque que `estadoDelSet`: si el set se retoma de un partido
  // aplazado, el historial de hoy cuenta desde ahí y no desde 0–0.
  const puntos: Record<Lado, number> = {
    home: set.vieneDe?.home ?? 0,
    away: set.vieneDe?.away ?? 0,
  };
  let saca = set.saqueInicial;
  const cancha: Record<Lado, Alineacion> = {
    home: [...set.alineacion.home],
    away: [...set.alineacion.away],
  };

  set.eventos.forEach((ev, indice) => {
    let roto = false;
    if (ev.t === "punto") {
      puntos[ev.equipo]++;
      if (ev.equipo !== saca) {
        cancha[ev.equipo] = rotar(cancha[ev.equipo]);
        saca = ev.equipo;
        roto = true;
      }
    } else if (ev.t === "cambio") {
      const i = cancha[ev.equipo].indexOf(ev.sale);
      if (i >= 0) cancha[ev.equipo][i] = ev.entra;
    } else if (ev.t === "completar") {
      cancha[ev.equipo][indiceDePosicion(ev.posicion)] = ev.entra;
    }
    lineas.push({
      indice,
      puntos: { ...puntos },
      evento: ev,
      roto,
      saca,
      sacador: cancha[saca][0],
    });
  });

  return lineas;
}
