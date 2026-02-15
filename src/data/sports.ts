import { SportInfo } from "@/types";

export const SPORTS: SportInfo[] = [
  { key: "futbol", label: "Futbol", emoji: "\u26bd", scoringUnit: "goles" },
  { key: "beisbol", label: "Beisbol", emoji: "\u26be", scoringUnit: "carreras" },
  { key: "softball", label: "Softball", emoji: "\ud83e\udd4e", scoringUnit: "carreras" },
  { key: "wiffleball", label: "Wiffleball", emoji: "\ud83c\udfcf", scoringUnit: "carreras" },
  { key: "volleyball", label: "Volleyball", emoji: "\ud83c\udfd0", scoringUnit: "sets" },
  { key: "basketball", label: "Basketball", emoji: "\ud83c\udfc0", scoringUnit: "puntos" },
  { key: "padel", label: "Padel", emoji: "\ud83c\udfbe", scoringUnit: "sets" },
  { key: "ping-pong", label: "Ping Pong", emoji: "\ud83c\udfd3", scoringUnit: "sets" },
  { key: "tenis", label: "Tenis", emoji: "\ud83c\udfbe", scoringUnit: "sets" },
];

export function getSportInfo(key: string): SportInfo | undefined {
  return SPORTS.find((s) => s.key === key);
}
