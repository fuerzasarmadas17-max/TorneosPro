// Paleta categórica para distinguir torneos en la agenda del dashboard.
// Validada con el método de dataviz (CVD-safe en su orden). El color es
// SIEMPRE encoding secundario: va acompañado del nombre del torneo, así que
// cumple la "regla de relieve" (los 3 hues de bajo contraste vs superficie son
// legales porque nunca van solos). Los mismos hex funcionan como puntos/acentos
// tanto en tema claro como oscuro.
export const TOURNAMENT_COLORS = [
  "#2a78d6", // azul
  "#eb6834", // naranja
  "#1baf7a", // aqua
  "#eda100", // amarillo
  "#e87ba4", // magenta
  "#008300", // verde
  "#4a3aa7", // violeta
  "#e34948", // rojo
] as const;

/**
 * Asigna un color a cada torneo de forma determinística por su id (orden
 * estable), para que un torneo siempre tenga el mismo color sin importar el
 * orden de render. Con más torneos que colores, el color se repite; el nombre
 * del torneo desambigua.
 */
export function buildTournamentColorMap(
  tournamentIds: string[]
): Map<string, string> {
  const sorted = [...tournamentIds].sort();
  const map = new Map<string, string>();
  sorted.forEach((id, i) => {
    map.set(id, TOURNAMENT_COLORS[i % TOURNAMENT_COLORS.length]);
  });
  return map;
}
