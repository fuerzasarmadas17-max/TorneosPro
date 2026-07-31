import { BarChart3, Target, Trophy, Users } from "lucide-react";

// La franja que reemplaza la sección "Todo lo que necesitas": cuatro
// promesas cortas en vez de tres párrafos de features.
const VALUES = [
  {
    icon: Target,
    title: "COMPITE",
    text: "Demuestra tu talento en cada partido",
  },
  {
    icon: Users,
    title: "CONECTA",
    text: "Forma parte de la comunidad deportiva",
  },
  {
    icon: BarChart3,
    title: "CRECE",
    text: "Mejora, entrena y alcanza tu mejor nivel",
  },
  {
    icon: Trophy,
    title: "DISFRUTA",
    text: "Vive la pasión del deporte en cada torneo",
  },
];

export function ValuesStrip() {
  return (
    <div className="grid gap-6 rounded-xl border bg-card p-6 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:gap-0">
      {VALUES.map(({ icon: Icon, title, text }) => (
        <div key={title} className="flex items-center gap-4 lg:px-6">
          <div className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-primary/40 text-primary">
            <Icon className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-bold tracking-wide">{title}</p>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
