"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import { monthLabel } from "@/lib/month-label";
import { personas } from "@/lib/plural";
import type { MyAudienceSummary } from "@/lib/ad-analytics";

/**
 * La audiencia del mes en curso. SIN PLATA, a propósito.
 *
 * Durante el mes el organizador ve cuánta gente vio cada aviso en sus torneos, y
 * nada más. El monto aparece cuando el mes cierra, en el histórico, y ahí ya es
 * definitivo.
 *
 * Antes esta pantalla mostraba una proyección en pesos con la etiqueta
 * "estimado". El problema es que un número con pesos adelante se lee como
 * promesa, y ese número BAJA cuando otro organizador suma audiencia a la misma
 * campaña. Mostrar $47.300 el día 10 y $31.000 el día 20 rompe la confianza
 * aunque las dos cifras estén perfectamente calculadas.
 */
export function AudienceThisMonth({ data }: { data: MyAudienceSummary }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (data.campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Todavía no hay avisos mostrados en tus torneos este mes. Cuando los
          haya, acá vas a ver cuánta gente los vio.
        </CardContent>
      </Card>
    );
  }

  const social = data.campaigns.filter((c) => c.nonprofit).length;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">
          Los avisos que salieron en tus torneos
        </p>
        <p className="text-sm text-muted-foreground">
          {monthLabel(data.month)} · el monto se calcula cuando termina el mes
        </p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            {/* "Vieron el aviso", no "tu audiencia": es una cuenta POR CAMPAÑA y
                no es la misma que el requisito de audiencia de abajo, que se mide
                sobre las visitas a los torneos. Dos etiquetas parecidas
                invitarían a comparar dos números que nunca van a coincidir. */}
            <TableRow>
              <TableHead>Campaña</TableHead>
              <TableHead className="text-right">Vieron el aviso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.campaigns.map((c) => {
              const open = openId === c.campaignId;
              return [
                <TableRow
                  key={c.campaignId}
                  className="cursor-pointer"
                  onClick={() => setOpenId(open ? null : c.campaignId)}
                >
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {open ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span>
                        {c.advertiserName ?? "Campaña eliminada"}
                        {c.nonprofit && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            Campaña social · no genera pago
                          </span>
                        )}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {personas(c.myPersonDays)}
                  </TableCell>
                </TableRow>,

                open ? (
                  <TableRow
                    key={c.campaignId + ":detalle"}
                    className="hover:bg-transparent"
                  >
                    <TableCell colSpan={2} className="bg-muted/40">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        En qué torneos tuyos salió
                      </p>
                      <ul className="space-y-1 text-sm">
                        {c.tournaments.map((t) => (
                          <li
                            key={t.tournamentId}
                            className="flex justify-between gap-3"
                          >
                            <span>{t.tournamentName ?? "Torneo eliminado"}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {personas(t.personDays)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {/* Las personas de los torneos pueden sumar MÁS que la
                          audiencia de la campaña: quien vio el mismo aviso el
                          mismo día en dos torneos cuenta una sola vez arriba y
                          una en cada torneo acá. Sin este aviso, la resta no
                          cuadra y parece un error. */}
                      {c.tournaments.reduce((a, t) => a + t.personDays, 0) >
                        c.myPersonDays && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Si alguien vio el aviso el mismo día en dos de tus
                          torneos, aparece en los dos pero se cuenta una sola vez
                          en el total.
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : null,
              ];
            })}
          </TableBody>
        </Table>
      </Card>

      {social > 0 && (
        // La pregunta que sigue a "no genera pago" es siempre la misma: ¿me
        // están quitando algo? Conviene contestarla antes de que la haga.
        <p className="text-xs text-muted-foreground">
          {social === 1
            ? "Una campaña social no genera pago porque no se cobra."
            : `${social} campañas sociales no generan pago porque no se cobran.`}{" "}
          No te quita nada de lo que ganás con las demás, y esa audiencia igual te
          cuenta para los requisitos del mes.
        </p>
      )}

      <details className="group">
        <summary className="cursor-pointer list-none text-xs text-muted-foreground underline underline-offset-2">
          ¿Y cuánto es en plata?
        </summary>
        <div className="mt-2 space-y-2 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">Se sabe al cerrar el mes.</strong>{" "}
            Lo que paga cada campaña se reparte entre todos los organizadores
            donde se mostró, así que mientras el mes corra el número se mueve: si
            otro organizador suma audiencia a la misma campaña, la parte de cada
            uno cambia. Cuando el mes termina se congela y te lo mostramos en
            Histórico.
          </p>
          <p>
            Cada fila cuenta las personas que vieron <em>ese</em> aviso, y no se
            suman entre sí: si alguien vio dos campañas el mismo día, aparece en
            las dos. Es una cuenta distinta de la de tus requisitos, que mira
            cuánta gente entró a tus torneos, vea avisos o no.
          </p>
        </div>
      </details>
    </div>
  );
}
