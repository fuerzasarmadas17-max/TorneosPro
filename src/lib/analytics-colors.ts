/**
 * Colores de las series de analítica.
 *
 * Los mismos hex identifican una métrica en TODOS lados: el punto del KPI, la
 * línea del gráfico y la leyenda. Es lo que deja leer el gráfico sin volver a
 * la leyenda cada vez.
 *
 * Salen de la paleta categórica del proyecto (`lib/tournament-colors.ts`), en
 * su orden. Los pasos oscuros NO son los claros aclarados: son propios, porque
 * los del modo claro caen fuera de la banda de luminosidad contra el fondo
 * oscuro. Validados con el método de dataviz contra las dos superficies de
 * tarjeta (#ffffff y #0e1626): banda, croma, separación para daltonismo y
 * contraste pasan en ambos modos.
 *
 * El color nunca va solo: cada serie lleva además su nombre en la leyenda y en
 * el tooltip, que es lo que exige el aqua por quedar apenas por debajo de 3:1
 * sobre el fondo claro.
 */
export const ANALYTICS_SERIES = {
  visitas: { light: "#2a78d6", dark: "#3987e5", label: "Visitas" },
  personasDia: { light: "#eb6834", dark: "#d95926", label: "Personas-día" },
  personas: { light: "#1baf7a", dark: "#199e70", label: "Personas" },
} as const;

export type AnalyticsSeriesKey = keyof typeof ANALYTICS_SERIES;

/**
 * Punto de color de una serie. Toma el paso claro u oscuro según el tema, que
 * en CSS puro no se puede elegir entre dos valores arbitrarios sin variables.
 */
export function seriesDotStyle(key: AnalyticsSeriesKey): React.CSSProperties {
  const c = ANALYTICS_SERIES[key];
  return {
    // La variable la consume el `background` de abajo; el bloque `.dark` de
    // globals.css no puede reescribir un hex inline, así que se resuelve con
    // `light-dark()`, soportado por todos los navegadores objetivo.
    background: `light-dark(${c.light}, ${c.dark})`,
  };
}
