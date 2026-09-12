"use client";

/**
 * El teclado de la planilla. Propio, no el del teléfono.
 *
 * En la cancha se anota de a un número por vez y las teclas grandes se aciertan
 * sin mirar. El del sistema ocupa media pantalla, tapa la lista de lo anotado, y
 * en muchos Android no trae una tecla de "listo" que sirva para agregar.
 *
 * La tecla ABC está porque hay ligas donde alguien no tiene dorsal y se lo anota
 * como "A".
 */

import { useState } from "react";
import { Delete } from "lucide-react";

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function Teclado({
  onTecla,
  onBorrar,
  className,
}: {
  onTecla: (t: string) => void;
  onBorrar: () => void;
  className?: string;
}) {
  const [letras, setLetras] = useState(false);

  return (
    <div className={`grid grid-cols-3 gap-2 ${className ?? ""}`}>
      {letras ? (
        <>
          {LETRAS.map((l) => (
            <Tecla key={l} chica onClick={() => onTecla(l)}>
              {l}
            </Tecla>
          ))}
          <Tecla chica tenue onClick={() => setLetras(false)}>
            123
          </Tecla>
          <Tecla chica tenue onClick={onBorrar} aria-label="Borrar">
            <Delete className="mx-auto h-5 w-5" />
          </Tecla>
        </>
      ) : (
        <>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <Tecla key={n} onClick={() => onTecla(n)}>
              {n}
            </Tecla>
          ))}
          <Tecla tenue onClick={() => setLetras(true)}>
            ABC
          </Tecla>
          <Tecla onClick={() => onTecla("0")}>0</Tecla>
          <Tecla tenue onClick={onBorrar} aria-label="Borrar">
            <Delete className="mx-auto h-6 w-6" />
          </Tecla>
        </>
      )}
    </div>
  );
}

function Tecla({
  children,
  onClick,
  tenue,
  chica,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  tenue?: boolean;
  chica?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border bg-card font-bold transition-colors active:bg-accent ${
        chica ? "h-12 text-lg" : "h-16 text-2xl"
      } ${tenue ? "text-muted-foreground" : ""}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** La casilla donde se ve lo que se está escribiendo. */
export function Visor({ texto }: { texto: string }) {
  return (
    <div
      className={`flex h-14 flex-1 items-center rounded-lg border-2 px-4 text-2xl font-bold ${
        texto ? "border-primary" : "border-input text-muted-foreground"
      }`}
    >
      {texto || <span className="text-base font-normal">Tocá el teclado</span>}
    </div>
  );
}
