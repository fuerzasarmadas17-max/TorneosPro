"use client";

import Link from "next/link";
import { AdminGuard } from "@/components/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  StatTile,
  FilterChips,
  SearchBox,
  ListFooter,
  EmptyState,
  ListSkeleton,
} from "@/components/admin/admin-ui";
import {
  useAdminUsers,
  DIAS_NUEVO,
  type UserFilter,
} from "@/hooks/use-admin-users";
import { toast } from "sonner";
import {
  Users,
  UserCheck,
  UserX,
  ExternalLink,
  Sparkles,
  Trophy,
  CalendarDays,
} from "lucide-react";

/**
 * "hace 3 días" en vez de una fecha. Con correos nuevos llegando, lo que uno
 * quiere saber de un vistazo es qué tan reciente es, no el día exacto.
 */
function antiguedad(iso: string): string {
  const dias = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000)
  );
  if (dias === 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "hace 1 mes" : `hace ${meses} meses`;
}

function UsersContent() {
  const u = useAdminUsers();

  const handleToggle = async (id: string, name: string, activo: boolean) => {
    const ok = await u.toggleActive(id, !activo);
    if (!ok) {
      toast.error("No se pudo cambiar el estado");
      return;
    }
    toast.success(activo ? `${name} desactivado` : `${name} activado`);
  };

  const filtros: { key: UserFilter; label: string; count?: number }[] = [
    { key: "todos", label: "Todos", count: u.counts.total },
    { key: "nuevos", label: `Nuevos (${DIAS_NUEVO}d)`, count: u.counts.nuevos },
    { key: "sin-torneos", label: "Sin torneos", count: u.counts.sinTorneos },
    { key: "activos", label: "Activos", count: u.counts.activos },
    { key: "inactivos", label: "Inactivos", count: u.counts.inactivos },
  ];

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">Usuarios</h1>
        <p className="mt-1 text-muted-foreground">
          Organizadores registrados en la plataforma
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={Users}
          label="Total"
          value={u.counts.total}
          accent="blue"
          onClick={() => u.setFilter("todos")}
          active={u.filter === "todos"}
        />
        <StatTile
          icon={Sparkles}
          label={`Nuevos (${DIAS_NUEVO}d)`}
          value={u.counts.nuevos}
          hint="Registrados esta semana"
          accent="amber"
          onClick={() => u.setFilter("nuevos")}
          active={u.filter === "nuevos"}
        />
        <StatTile
          icon={Trophy}
          label="Sin torneos"
          value={u.counts.sinTorneos}
          hint="Se registraron y no crearon nada"
          accent="default"
          onClick={() => u.setFilter("sin-torneos")}
          active={u.filter === "sin-torneos"}
        />
        <StatTile
          icon={UserX}
          label="Inactivos"
          value={u.counts.inactivos}
          accent={u.counts.inactivos > 0 ? "red" : "default"}
          onClick={() => u.setFilter("inactivos")}
          active={u.filter === "inactivos"}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FilterChips value={u.filter} onChange={u.setFilter} options={filtros} />
          <SearchBox
            value={u.search}
            onChange={u.setSearch}
            placeholder="Buscar por nombre o correo…"
          />
        </div>

        {u.loading ? (
          <ListSkeleton />
        ) : u.rows.length === 0 ? (
          <EmptyState
            text={
              u.search
                ? `Ningún usuario coincide con "${u.search}"`
                : "No hay usuarios en este filtro"
            }
          />
        ) : (
          <div className="space-y-2">
            {u.rows.map((user) => {
              const activo = user.is_active;
              const org = user.organization_profiles;
              return (
                <div
                  key={user.id}
                  className={
                    "flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between " +
                    (activo ? "" : "opacity-60")
                  }
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="min-w-0 max-w-full truncate text-sm font-medium">{user.name}</p>
                        {!activo && (
                          <Badge className="border-red-500/20 bg-red-500/10 text-red-600">
                            Inactivo
                          </Badge>
                        )}
                        {org && !org.is_public && (
                          <Badge variant="outline" className="text-[10px]">
                            Perfil privado
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="size-3 shrink-0" />
                          {antiguedad(user.created_at)}
                        </span>
                        <span
                          className={
                            "flex items-center gap-1 " +
                            (user.tournament_count === 0
                              ? "text-muted-foreground/60"
                              : "font-medium text-foreground")
                          }
                        >
                          <Trophy className="size-3 shrink-0" />
                          {user.tournament_count === 0
                            ? "sin torneos"
                            : user.tournament_count === 1
                              ? "1 torneo"
                              : `${user.tournament_count} torneos`}
                        </span>
                        {org && (
                          <span className="min-w-0 max-w-full truncate">
                            · {org.organization_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                    {org?.slug && (
                      <Button variant="ghost" size="sm" asChild className="h-8">
                        <Link href={`/${org.slug}`} target="_blank">
                          <ExternalLink className="size-3.5" />
                          <span className="sr-only">Ver perfil</span>
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant={activo ? "outline" : "default"}
                      size="sm"
                      className="h-8"
                      onClick={() => handleToggle(user.id, user.name, activo)}
                    >
                      {activo ? (
                        <>
                          <UserX className="mr-1 size-3.5" />
                          Desactivar
                        </>
                      ) : (
                        <>
                          <UserCheck className="mr-1 size-3.5" />
                          Activar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <ListFooter
          shown={u.rows.length}
          total={u.total}
          loading={u.loadingMore}
          onMore={u.loadMore}
          noun="usuarios"
        />
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminGuard>
      <UsersContent />
    </AdminGuard>
  );
}
