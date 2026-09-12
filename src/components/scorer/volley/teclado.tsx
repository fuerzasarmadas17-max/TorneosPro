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
 *
 * LAS LETRAS OCUPAN LO MISMO QUE LOS NÚMEROS. Las 26 de un saque eran nueve
 * filas: el teclado empujaba el botón de Agregar fuera de la pantalla, y había
 * que bajar a tocar la letra y volver a subir a agregar. Ahora van de a nueve,
 * en el mismo cuadrado de cuatro filas que los números, con una tecla que pasa
 * al grupo siguiente. La A queda donde se llega con el pulgar, que es la que se
 * usa casi siempre.
 */

import { useState } from "react";
import { Delete } from "lucide-react";

/** Las letras de a nueve, para que el teclado no crezca. */
const GRUPOS_DE_LETRAS = [
  ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
  ["J", "K", "L", "M", "N", "Ñ", "O", "P", "Q"],
  ["R", "S", "T", "U", "V", "W", "X", "Y", "Z"],
];

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
  const [grupo, setGrupo] = useState(0);

  const siguienteGrupo = (grupo + 1) % GRUPOS_DE_LETRAS.length;

  return (
    <div className={`grid grid-cols-3 gap-2 ${className ?? ""}`}>
      {letras ? (
        <>
          {GRUPOS_DE_LETRAS[grupo].map((l) => (
            <Tecla key={l} onClick={() => onTecla(l)}>
              {l}
            </Tecla>
          ))}
          <Tecla tenue onClick={() => setLetras(false)}>
            123
          </Tecla>
          <Tecla
            tenue
            onClick={() => setGrupo(siguienteGrupo)}
            aria-label="Más letras"
          >
            <span className="text-base">
              {GRUPOS_DE_LETRAS[siguienteGrupo][0]}–
              {GRUPOS_DE_LETRAS[siguienteGrupo][8]}
            </span>
          </Tecla>
          <Tecla tenue onClick={onBorrar} aria-label="Borrar">
            <Delete className="mx-auto h-6 w-6" />
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
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  tenue?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-16 rounded-lg border bg-card text-2xl font-bold transition-colors active:bg-accent ${
        tenue ? "text-muted-foreground" : ""
      }`}
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
