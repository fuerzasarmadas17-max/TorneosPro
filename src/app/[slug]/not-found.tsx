import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ProfileNotFound() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h1 className="text-4xl font-bold mb-4">Perfil no encontrado</h1>
      <p className="text-muted-foreground mb-8">
        Esta organizacion no existe o su perfil no esta disponible.
      </p>
      <Button asChild>
        <Link href="/tournaments">Ver Torneos</Link>
      </Button>
    </div>
  );
}
