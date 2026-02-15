"use client";

import { AdminGuard } from "@/components/auth-guard";
import { useTournaments } from "@/context/tournament-context";
import { useAuth } from "@/context/auth-context";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { formatCOP } from "@/lib/pricing";
import { MOCK_USERS } from "@/data/users";

function FinancesContent() {
  const { tournaments } = useTournaments();

  const paidTournaments = tournaments.filter((t) => t.plan === "paid" && t.monthlyCost);

  // Active = not completed (upcoming or in-progress)
  const activePaid = paidTournaments.filter((t) => t.status !== "completed");
  const completedPaid = paidTournaments.filter((t) => t.status === "completed");

  const expectedMonthly = activePaid.reduce((sum, t) => sum + (t.monthlyCost || 0), 0);
  const totalHistorical = paidTournaments.reduce((sum, t) => sum + (t.monthlyCost || 0), 0);

  // Simulated: assume completed tournaments have been paid, active ones are pending
  const received = completedPaid.reduce((sum, t) => sum + (t.monthlyCost || 0), 0);
  const pending = expectedMonthly;

  const getOwnerName = (userId: string) => {
    const user = MOCK_USERS.find((u) => u.id === userId);
    return user?.organizationProfile?.organizationName || user?.name || "Desconocido";
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Finanzas</h1>
        <p className="text-muted-foreground mt-1">
          Resumen financiero de la plataforma
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Esperado este mes</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCOP(expectedMonthly)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recibido (completados)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{formatCOP(received)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pendiente por cobrar</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-500">{formatCOP(pending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Torneos pagos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{paidTournaments.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Active tournaments - expected revenue */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Torneos activos (ingreso mensual)</h2>
        {activePaid.length === 0 ? (
          <p className="text-muted-foreground text-sm">No hay torneos activos con plan pago</p>
        ) : (
          <div className="space-y-2">
            {activePaid.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between border rounded-lg p-4"
              >
                <div className="space-y-1">
                  <p className="font-medium">{t.name}</p>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>{getOwnerName(t.createdBy)}</span>
                    <span>· {t.teamIds.length} equipos</span>
                    <Badge
                      className={
                        t.status === "in-progress"
                          ? "bg-green-500/10 text-green-500"
                          : "bg-blue-500/10 text-blue-500"
                      }
                    >
                      {t.status === "in-progress" ? "En Curso" : "Proximo"}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{formatCOP(t.monthlyCost || 0)}</p>
                  <p className="text-xs text-muted-foreground">/mes</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed tournaments - historical revenue */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Torneos completados (historial)</h2>
        {completedPaid.length === 0 ? (
          <p className="text-muted-foreground text-sm">No hay torneos completados</p>
        ) : (
          <div className="space-y-2">
            {completedPaid.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between border rounded-lg p-4 opacity-70"
              >
                <div className="space-y-1">
                  <p className="font-medium">{t.name}</p>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>{getOwnerName(t.createdBy)}</span>
                    <span>· {t.teamIds.length} equipos</span>
                    <Badge className="bg-zinc-500/10 text-zinc-500">Completado</Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-green-500">{formatCOP(t.monthlyCost || 0)}</p>
                  <p className="text-xs text-green-600">Pagado</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminFinancesPage() {
  return (
    <AdminGuard>
      <FinancesContent />
    </AdminGuard>
  );
}
