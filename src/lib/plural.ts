/**
 * "1 persona" / "3 personas".
 *
 * Existe porque `${n} personas` sale por todos lados en la sección Monetizar y
 * un "1 personas" en una pantalla donde se habla de plata deja la impresión de
 * que nadie la revisó.
 */
export function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

export function personas(n: number): string {
  return plural(n, "persona", "personas");
}
