import { Tournament, Team, getSportCategory } from "@/types";
import { StatLeaderboard, CardEntry, BaseballPlayerStats } from "@/hooks/use-tournament-stats";
import { BASEBALL_LEADERBOARD_ORDER } from "@/lib/baseball-order";

const fmt = (v: number) => v.toFixed(3).replace(/^0/, "");

export interface StatsPdfOptions {
  /** Si está seteado, el PDF lleva solo las stats de este equipo y
   *  todas sus filas (ignora topN). Si es null/undefined, es el PDF
   *  general del torneo limitado a `topN` filas por leaderboard. */
  filterTeamId?: string | null;
  /** Top N a incluir por cada leaderboard cuando NO hay filtro de
   *  equipo. Con filtro este valor se ignora. */
  topN?: number;
}

interface StatsData {
  leaderboards: StatLeaderboard[];
  cardEntries: CardEntry[];
  baseballPlayerStats: BaseballPlayerStats[];
}

/**
 * Genera y descarga un PDF con las estadísticas del torneo.
 *
 * El PDF tiene:
 *   1. Header: nombre del torneo + fecha + filtro de equipo si aplica.
 *   2. Tabla individual de béisbol (si el deporte lo amerita y hay datos).
 *   3. Una tabla por cada leaderboard (goles, asistencias, etc.).
 *   4. Tabla de sanciones (si hay).
 *   5. Footer con fecha de generación.
 *
 * Cuando hay `filterTeamId`, las tablas SOLO incluyen filas de ese equipo
 * y se muestran completas (sin slice). Sin filtro, cada tabla se corta
 * en `topN` filas.
 */
export async function downloadStatsPdf(
  tournament: Tournament,
  data: StatsData,
  teamsById: Map<string, Team>,
  options: StatsPdfOptions = {}
): Promise<void> {
  // Lazy-load de jspdf y jspdf-autotable: estas libs son pesadas (~300KB
  // gz juntas) y solo se necesitan cuando el organizador hace click en
  // "Descargar PDF". Cargarlas inline rompía el initial bundle de toda
  // la app porque jspdf accede a `window`/`navigator` al evaluarse —
  // bien para el cliente pero costoso en bundle. Con dynamic import
  // queda code-split en un chunk aparte que solo se baja al click.
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;

  const { filterTeamId, topN = 10 } = options;
  const hasFilter = !!filterTeamId;
  const teamName = filterTeamId ? teamsById.get(filterTeamId)?.name ?? "" : "";

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let cursorY = margin;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`Estadísticas - ${tournament.name}`, margin, cursorY);
  cursorY += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  const subtitleLines: string[] = [];
  if (hasFilter && teamName) {
    subtitleLines.push(`Equipo: ${teamName}`);
  } else {
    subtitleLines.push(`Top ${topN} por estadística`);
  }
  subtitleLines.push(
    `Generado: ${new Date().toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`
  );
  for (const line of subtitleLines) {
    doc.text(line, margin, cursorY);
    cursorY += 5;
  }
  doc.setTextColor(0);
  cursorY += 3;

  // Helper para escribir un section heading
  const writeSection = (title: string) => {
    // Auto-saltar de página si quedan menos de 30mm
    if (cursorY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      cursorY = margin;
    }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin, cursorY);
    cursorY += 2;
  };

  // ============================================================
  // 1. Tabla individual de béisbol (si aplica)
  // ============================================================

  const baseballRows = hasFilter
    ? data.baseballPlayerStats.filter((p) => p.teamId === filterTeamId)
    : data.baseballPlayerStats.slice(0, topN);

  if (baseballRows.length > 0) {
    writeSection("Estadísticas individuales");
    autoTable(doc, {
      startY: cursorY + 2,
      head: [
        [
          "#",
          "Jugador",
          "Equipo",
          "AB",
          "H",
          "2B",
          "3B",
          "HR",
          "BB",
          "K",
          "RBI",
          "R",
          "PA",
          "AVG",
          "OBP",
          "SLG",
          "OPS",
        ],
      ],
      body: baseballRows.map((p, i) => [
        String(i + 1),
        p.playerName,
        teamsById.get(p.teamId)?.name ?? p.teamId,
        String(p.ab),
        String(p.h),
        String(p.doubles),
        String(p.triples),
        String(p.hr),
        String(p.bb),
        String(p.k),
        String(p.rbi),
        String(p.r),
        String(p.pa),
        fmt(p.avg),
        fmt(p.obp),
        fmt(p.slg),
        fmt(p.ops),
      ]),
      styles: { fontSize: 7, cellPadding: 1.2 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 7 },
      margin: { left: margin, right: margin },
      theme: "grid",
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ============================================================
  // 2. Leaderboards no-card (goles, asistencias, etc.)
  // ============================================================

  const nonCardLeaderboards = data.leaderboards.filter(
    (lb) =>
      lb.statKey !== "yellow_card" &&
      lb.statKey !== "red_card" &&
      lb.statKey !== "ejection" &&
      lb.statKey !== "blue_card"
  );

  // Mismo orden de cards que la vista del tab Estadisticas para que el
  // PDF coincida visualmente con lo que ve el organizador en pantalla.
  const isBaseball = getSportCategory(tournament.sport) === "baseball";
  const orderedLeaderboards = isBaseball
    ? [...nonCardLeaderboards].sort((a, b) => {
        const aIdx = BASEBALL_LEADERBOARD_ORDER.indexOf(a.statKey);
        const bIdx = BASEBALL_LEADERBOARD_ORDER.indexOf(b.statKey);
        const aOrder = aIdx === -1 ? BASEBALL_LEADERBOARD_ORDER.length : aIdx;
        const bOrder = bIdx === -1 ? BASEBALL_LEADERBOARD_ORDER.length : bIdx;
        return aOrder - bOrder;
      })
    : nonCardLeaderboards;

  for (const lb of orderedLeaderboards) {
    if (lb.computed) {
      const allRows = hasFilter
        ? lb.teamLeaders.filter((t) => t.teamId === filterTeamId)
        : lb.teamLeaders;
      const rows = hasFilter ? allRows : allRows.slice(0, topN);
      if (rows.length === 0) continue;

      writeSection(lb.pluralLabel);
      autoTable(doc, {
        startY: cursorY + 2,
        head: [["#", "Equipo", "PJ", lb.label]],
        body: rows.map((r, i) => [
          String(i + 1),
          teamsById.get(r.teamId)?.name ?? r.teamId,
          String(r.matchesPlayed),
          String(r.value),
        ]),
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [30, 30, 30], textColor: 255 },
        margin: { left: margin, right: margin },
        theme: "grid",
      });
      cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    } else {
      const allRows = hasFilter
        ? lb.leaders.filter((l) => l.teamId === filterTeamId)
        : lb.leaders;
      const rows = hasFilter ? allRows : allRows.slice(0, topN);
      if (rows.length === 0) continue;

      writeSection(lb.pluralLabel);
      autoTable(doc, {
        startY: cursorY + 2,
        head: [["#", "Jugador", "Equipo", lb.label]],
        body: rows.map((r, i) => [
          String(i + 1),
          r.playerName,
          teamsById.get(r.teamId)?.name ?? r.teamId,
          String(r.count),
        ]),
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [30, 30, 30], textColor: 255 },
        margin: { left: margin, right: margin },
        theme: "grid",
      });
      cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }
  }

  // ============================================================
  // 3. Sanciones (cards)
  // ============================================================

  const cardRows = hasFilter
    ? data.cardEntries.filter((c) => c.teamId === filterTeamId)
    : data.cardEntries;

  if (cardRows.length > 0) {
    writeSection("Sanciones");
    autoTable(doc, {
      startY: cursorY + 2,
      head: [["Jugador", "Equipo", "Tipo", "Estado"]],
      body: cardRows.map((c) => {
        const typeLabel =
          c.type === "yellow_card"
            ? "Amarilla"
            : c.type === "red_card"
            ? "Roja"
            : c.type === "blue_card"
            ? "Azul"
            : "Expulsión";
        return [
          c.playerName,
          teamsById.get(c.teamId)?.name ?? c.teamId,
          typeLabel,
          c.paid ? "Pagado" : "Sin pagar",
        ];
      }),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255 },
      margin: { left: margin, right: margin },
      theme: "grid",
    });
  }

  // ============================================================
  // Footer (en cada página)
  // ============================================================

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    const footer = `Página ${i} de ${pageCount} · Torneos Pro`;
    doc.text(footer, pageWidth / 2, doc.internal.pageSize.getHeight() - 6, {
      align: "center",
    });
  }

  // Filename: torneo_filtro_fecha.pdf
  const safeName = tournament.name.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 40);
  const datePart = new Date().toISOString().slice(0, 10);
  const teamPart = hasFilter ? `_${(teamName || "equipo").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 20)}` : "";
  doc.save(`stats_${safeName}${teamPart}_${datePart}.pdf`);
}
