import type { Metadata } from "next";
import Link from "next/link";
import {
  MONETIZAR_TERMS,
  MONETIZAR_TERMS_VERSION,
} from "@/lib/monetizar-terms";

export const metadata: Metadata = {
  title: "Condiciones del programa de monetización | TorneosPro",
  description:
    "Cómo se calcula, cuándo se paga y qué se exige para monetizar tus torneos con la publicidad de TorneosPro.",
};

/**
 * Los términos, en su propia página.
 *
 * El texto sale de `src/lib/monetizar-terms.ts`, el mismo archivo del que
 * dependen la versión guardada y el diálogo de inscripción. Tenerlo en un solo
 * lugar es lo que hace que "aceptó la versión X" signifique algo: si esta página
 * tuviera su propia copia, tarde o temprano diría algo distinto de lo que el
 * organizador aceptó, y no habría forma de saber cuál valía.
 */
export default function TerminosMonetizacionPage() {
  return (
    <>
      <h1>Condiciones del programa de monetización</h1>
      <p className="!text-muted-foreground text-sm">
        Versión {MONETIZAR_TERMS_VERSION}
      </p>

      <p>
        Estas son las condiciones para participar del programa que reparte con
        los organizadores parte de lo que pagan los anunciantes de TorneosPro.
        Para el tratamiento de tus datos personales, ver la{" "}
        <Link href="/privacidad">Política de Privacidad</Link>.
      </p>

      {MONETIZAR_TERMS.map((section, i) => (
        <section key={section.title}>
          <h2>
            {i + 1}. {section.title}
          </h2>
          {section.body.map((p, j) => (
            <p key={j}>{p}</p>
          ))}
        </section>
      ))}

      <p className="text-sm">
        Dudas sobre el programa:{" "}
        <a href="mailto:legal@torneospro.co">legal@torneospro.co</a>.
      </p>
    </>
  );
}
