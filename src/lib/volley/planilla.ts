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
  | { t: "tiempo"; equipo: Lado };

export interface SetEnJuego {
  /** 1 para el primer set. */
  numero: number;
  /** Los que arrancaron en cancha, por equipo. Largo = jugadores en cancha. */
  alineacion: Record<Lado, Alineacion>;
  /** Quién sacó el primer punto del set. */
  saqueInicial: Lado;
  eventos: Evento[];
}

export interface SetCerrado {
  numero: number;
  homePoints: number;
  awayPoints: number;
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
}

/** Recorre la lista de eventos desde el arranque y devuelve cómo está el set
 *  ahora mismo. Es la única fuente de verdad de la pantalla del marcador. */
export function estadoDelSet(set: SetEnJuego): EstadoDelSet {
  const estado: EstadoDelSet = {
    puntos: { home: 0, away: 0 },
    saca: set.saqueInicial,
    enCancha: {
      home: [...set.alineacion.home],
      away: [...set.alineacion.away],
    },
    tiemposUsados: { home: 0, away: 0 },
    cambiosHechos: { home: 0, away: 0 },
    atados: { home: {}, away: {} },
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
    } else if (ev.t === "cambio") {
      const cancha = estado.enCancha[ev.equipo];
      const i = cancha.indexOf(ev.sale);
      if (i >= 0) cancha[i] = ev.entra;
      estado.cambiosHechos[ev.equipo]++;
      estado.atados[ev.equipo][ev.entra] = ev.sale;
      estado.atados[ev.equipo][ev.sale] = ev.entra;
    } else {
      estado.tiemposUsados[ev.equipo]++;
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
