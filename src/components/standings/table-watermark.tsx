/**
 * Marca de agua centrada para tablas (posiciones y estadísticas). Va detrás
 * del contenido (z-0; el contenido usa z-10) con opacidad baja para no
 * estorbar la lectura, pero presente en cualquier captura de pantalla.
 *
 * El logo es negro sobre transparente → `dark:invert` lo vuelve blanco en
 * modo oscuro, así un solo asset sirve para ambos temas. El ancho es
 * relativo (w-2/3) para que escale con la tabla y quede siempre centrado.
 */
export function TableWatermark() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/watermark-logo.png"
        alt=""
        className="w-2/3 max-w-[300px] select-none opacity-[0.05] dark:opacity-[0.08] dark:invert"
      />
    </div>
  );
}
