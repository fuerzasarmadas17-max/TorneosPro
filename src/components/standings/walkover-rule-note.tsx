import { getWalkoverRule } from "@/lib/walkover";
import { getSportCategory, getWinPoints, type Sport } from "@/types";

/**
 * Bloque "Partido ganado por W" dentro del diálogo de Sistema de Puntos de
 * cada deporte. Lee la regla de `lib/walkover.ts`, la misma que aplican el
 * organizador, el anotador con link y la descalificación — así lo que se le
 * promete al público es literalmente lo que el sistema hace.
 */
export function WalkoverRuleNote({
  sport,
  bestOf,
}: {
  sport: Sport;
  bestOf?: 3 | 5;
}) {
  const rule = getWalkoverRule(sport, bestOf);
  // El vóley no usa `getWinPoints`: reparte según lo limpia que fue la
  // victoria (ver use-volleyball-standings). Como una W siempre es un
  // marcador sin sets para el ausente, cuenta como victoria limpia — los
  // puntos de victoria apretada no pueden darse en un walkover.
  const isVolleyball = getSportCategory(sport) === "volleyball";
  const winPoints = isVolleyball ? 3 : getWinPoints(sport);

  return (
    <div>
      <h4 className="font-semibold mb-2">Partido ganado por W</h4>
      <p className="text-muted-foreground">
        Cuando un equipo no se presenta —o es descalificado y le quedaban
        partidos por jugar— el rival gana por W con marcador de{" "}
        <span className="font-medium text-foreground">{rule.description}</span>.
      </p>
      <p className="text-muted-foreground mt-2">
        La W otorga{" "}
        <span className="font-medium text-foreground">
          {winPoints} {winPoints === 1 ? "punto" : "puntos"}
        </span>
        {isVolleyball
          ? `: al no ceder ningún set cuenta como victoria limpia (${rule.winnerScore}-0), igual que ganarla en la cancha.`
          : ", lo mismo que cualquier otra victoria."}{" "}
        El partido no registra estadísticas de jugadores.
      </p>
    </div>
  );
}
