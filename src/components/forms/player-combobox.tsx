"use client";

import { useEffect, useRef, useState } from "react";

interface PlayerComboboxProps {
  /** Nombres candidatos (roster + historial), ya deduplicados y ordenados. */
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Clases extra para el input (alto / tamaño de fuente por contexto). */
  className?: string;
  maxLength?: number;
}

const BASE_INPUT =
  "w-full rounded-md border border-input bg-background px-2 outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Dropdown de selección de jugador con búsqueda. A diferencia de un
 * `<datalist>` nativo (que en mobile aparece como sugerencia del teclado),
 * esto es una lista estilizada y controlada. Acepta texto libre: si el
 * nombre no está en `options` se guarda igual como lo escribe el usuario,
 * así que sirve tanto con roster cargado como sin él.
 */
export function PlayerCombobox({
  options,
  value,
  onChange,
  placeholder,
  className,
  maxLength,
}: PlayerComboboxProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const query = value.trim().toLowerCase();
  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query))
    : options;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        // Corta la sugerencia nativa del teclado/browser: la selección se
        // hace desde el dropdown de abajo, no desde el autocompletado del SO.
        autoComplete="off"
        maxLength={maxLength}
        className={`${BASE_INPUT} ${className ?? ""}`}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-md border bg-popover shadow-md">
          {filtered.map((name) => (
            <button
              key={name}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent cursor-pointer"
              onMouseDown={(e) => {
                // onMouseDown (no onClick) para ganarle al blur del input y
                // que la selección registre antes de cerrar por click-outside.
                e.preventDefault();
                onChange(name);
                setOpen(false);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
