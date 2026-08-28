import { WelcomeDialog } from "@/components/dashboard/welcome-dialog";
import { WhatsappFab } from "@/components/dashboard/whatsapp-fab";

/**
 * Layout del panel del organizador.
 *
 * Acá viven las dos piezas de acompañamiento —la bienvenida y el botón de
 * WhatsApp— para que aparezcan en todo el panel (torneos, ajustes, monetizar,
 * logos) y en ningún lado más. Las páginas públicas de torneo quedan limpias a
 * propósito: son de los espectadores, no del organizador.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <WelcomeDialog />
      <WhatsappFab />
    </>
  );
}
