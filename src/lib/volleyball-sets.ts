/**
 * La regla de los sets de vóley, en un solo lugar.
 *
 * En vóley el marcador del partido ES la cuenta de sets ganados: un 2-1 son
 * exactamente tres sets, dos de uno y uno del otro. Si el resultado y los sets
 * no dicen lo mismo, uno de los dos está mal — y como la tabla de posiciones
 * desempata por ratio de sets y de puntos, un partido cargado a medias
 * desordena todo el torneo sin que nadie note por qué.
 *
 * Vive suelto acá porque lo usan TRES lugares y tienen que decir exactamente lo
 * mismo: el formulario del organizador, la pantalla del planillero externo, y
 * la ruta del servidor que recibe de ese link. Los dos primeros son comodidad;
 * el tercero es el que de verdad protege, porque un link de planillero es un
 * endpoint público y no se le puede creer nada al navegador.
 */

export interface SetScore {
  homePoints: number;
  awayPoints: number;
}

/**
 * Devuelve el mensaje de error, o `null` si está todo bien.
 *
 * El mensaje se le muestra tal cual a quien está cargando, así que dice qué
 * pasó y con qué números, no "datos inválidos".
 */
export function validateVolleyballSets(
  homeScore: number,
  awayScore: number,
  sets: SetScore[]
): string | null {
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) ||
      homeScore < 0 || awayScore < 0) {
    return "El resultado del partido tiene que ser dos números.";
  }

  const total = homeScore + awayScore;

  if (total === 0) {
    return "Cargá el resultado del partido en sets (por ejemplo 2-1).";
  }

  if (sets.length === 0) {
    return "Falta el marcador de cada set. En vóley el resultado no se puede guardar sin ellos.";
  }

  for (let i = 0; i < sets.length; i++) {
    const s = sets[i];
    if (
      !Number.isInteger(s.homePoints) || !Number.isInteger(s.awayPoints) ||
      s.homePoints < 0 || s.awayPoints < 0
    ) {
      return `Set ${i + 1}: faltan los puntos de alguno de los dos equipos.`;
    }
    if (s.homePoints === s.awayPoints) {
      return `Set ${i + 1}: un set no puede terminar empatado (${s.homePoints}-${s.awayPoints}).`;
    }
  }

  // El caso que más se equivoca: cargar un 2-0 y dejar tres sets escritos, o
  // un 2-1 con solo dos. La cuenta no admite interpretación.
  if (sets.length !== total) {
    return `Un ${homeScore}-${awayScore} son ${total} ${total === 1 ? "set" : "sets"}, y cargaste ${sets.length}.`;
  }

  const homeWon = sets.filter((s) => s.homePoints > s.awayPoints).length;
  const awayWon = sets.length - homeWon;

  if (homeWon !== homeScore || awayWon !== awayScore) {
    return `Los sets que cargaste dan ${homeWon}-${awayWon}, pero el resultado dice ${homeScore}-${awayScore}. Tienen que coincidir.`;
  }

  return null;
}
