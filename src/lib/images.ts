/**
 * Redimensionado de imágenes en el cliente, antes de subirlas a Storage.
 *
 * Los logos se subían a resolución original: había logos de 2000x2000 en el
 * bucket que se muestran a 20-32px (`TeamMark`) o ~80px (banner de
 * patrocinadores). El archivo pesaba poco (114KB) pero el browser lo
 * descomprime a resolución completa para pintarlo — 15MB de RAM por logo, en
 * un cuadrito de 32px. En Safari mobile eso mata la pestaña.
 *
 * Como estamos en Supabase Free no hay transformaciones de imagen del lado
 * del servidor (`?width=`), así que la única forma de servir un logo chico es
 * subirlo chico.
 *
 * `resizeImageForUpload` decodifica, escala a `maxDim` (contain — nunca
 * recorta ni agranda) y reencoda a WebP. Si algo falla o no conviene
 * (SVG, formato que el browser no decodifica, resultado más pesado que el
 * original) devuelve el archivo original: preferimos subir de más a fallar
 * la subida.
 */

export interface ResizeOptions {
  /** Lado mayor del resultado, en px. Nunca agranda. */
  maxDim: number;
  /** Calidad de encoding WebP/JPEG (0-1). */
  quality?: number;
  /**
   * Formato de salida. Por defecto WebP, que pesa menos y mantiene
   * transparencia.
   *
   * **Usar `"png"` para toda imagen que vaya a aparecer en una tarjeta de
   * OpenGraph** — hoy los logos de patrocinadores y el logo del organizador.
   * Satori, el motor que genera esas tarjetas, NO decodifica WebP: lanza una
   * excepción y la ruta entera devuelve 500, dejando al torneo sin
   * previsualización en WhatsApp por culpa del logo de un patrocinador.
   *
   * El resto (logos de club, fotos de campeón, banners de publicidad) no
   * entra en ninguna tarjeta OG y sigue en WebP.
   */
  format?: "webp" | "png";
}

export interface ResizedImage {
  blob: Blob;
  /** Extensión que corresponde al blob resultante — el path de Storage debe usar esta, no la del archivo original. */
  ext: string;
}

/** Los vectores ya son chicos y escalan solos: pasarlos por canvas los rasteriza y los empeora. */
function isVector(file: File): boolean {
  return file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
}

function extFor(mime: string, fallback: string): string {
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return fallback;
}

function originalOf(file: File): ResizedImage {
  return { blob: file, ext: file.name.split(".").pop()?.toLowerCase() || "png" };
}

/** Decodifica a un bitmap dibujable. `createImageBitmap` evita el round-trip por el DOM cuando está disponible. */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari viejo no soporta createImageBitmap(Blob) — cae al <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
  } finally {
    // El bitmap ya está decodificado en memoria; el object URL se puede soltar.
    URL.revokeObjectURL(url);
  }
}

function encode(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

export async function resizeImageForUpload(
  file: File,
  { maxDim, quality = 0.85, format = "webp" }: ResizeOptions
): Promise<ResizedImage> {
  // Los SVG salen derecho: Satori los dibuja, así que no rompen las tarjetas
  // OG y rasterizarlos solo los empeoraría.
  if (typeof window === "undefined" || isVector(file)) return originalOf(file);

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(file);
  } catch {
    return originalOf(file);
  }

  try {
    const w = source.width;
    const h = source.height;
    if (!w || !h) return originalOf(file);

    // Contain: el lado mayor llega a maxDim y el otro se escala proporcional.
    // `Math.min(1, ...)` evita agrandar un logo que ya venía chico.
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const targetW = Math.max(1, Math.round(w * scale));
    const targetH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return originalOf(file);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, targetW, targetH);

    // WebP mantiene transparencia (los logos suelen tener fondo alpha) y pesa
    // menos que PNG. Safari lo soporta desde la 14; si toBlob lo ignora,
    // devuelve otro mime y lo respetamos.
    //
    // Con `format: "png"` se va directo a PNG: acá el objetivo no es el peso
    // sino que Satori pueda dibujarlo en la tarjeta OG.
    let mime = format === "png" ? "image/png" : "image/webp";
    let blob = await encode(canvas, mime, quality);
    if (!blob || blob.type !== mime) {
      mime = "image/png";
      blob = await encode(canvas, mime, quality);
    }
    if (!blob) return originalOf(file);

    // Si reencodar no ganó nada y tampoco hubo que escalar, el original ya
    // estaba bien: no lo tocamos.
    //
    // Con `format: "png"` esta salida se desactiva salvo que el original ya
    // sea un formato que Satori dibuje. Si no, subir un .webp de 20 KB
    // devolvería el original —porque el PNG reencodado pesa más— y volvería a
    // romper la tarjeta OG, que es justo lo que este modo viene a evitar.
    const originalSirveParaOg =
      format !== "png" || /image\/(png|jpe?g|gif)/i.test(file.type);
    if (scale === 1 && blob.size >= file.size && originalSirveParaOg) {
      return originalOf(file);
    }

    return { blob, ext: extFor(blob.type, "webp") };
  } finally {
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
      source.close();
    }
  }
}

/**
 * Lados mayores por tipo de imagen. Salen del tamaño real de render (ver
 * `TeamMark`, `SponsorBanner`, `ProfileHeader`) por ~2x para pantallas retina.
 */
export const IMAGE_SIZES = {
  /** Logo de club/equipo: 32px en calendario, ~96px en la grilla de la biblioteca. */
  clubLogo: 256,
  /** Patrocinador: banner de 80px de alto, ~1/6 del container de ancho. */
  sponsor: 512,
  /** Logo de organización: 128px en el header del perfil. */
  orgLogo: 256,
  /** Foto de campeón / banners de ads: son fotos, no logos — se ven a tamaño grande. */
  photo: 1280,
} as const;

/** Límite del archivo ORIGINAL. Alto a propósito: el resize lo achica igual, y una foto de celular pesa varios MB. */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export function isImageFile(file: File): boolean {
  const validExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "heic", "heif"];
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return file.type.startsWith("image/") || validExts.includes(ext);
}
