"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminGuard } from "@/components/auth-guard";
import { useAuth } from "@/context/auth-context";
import { User } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { UserCheck, UserX } from "lucide-react";

type SafeUser = Omit<User, "password">;

function UsersContent() {
  const { getAllUsers, toggleUserActive } = useAuth();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    const data = await getAllUsers();
    setUsers(data);
    setLoading(false);
  }, [getAllUsers]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleToggle = async (userId: string) => {
    await toggleUserActive(userId);
    await loadUsers();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gestion de Usuarios</h1>
        <p className="text-muted-foreground mt-1">
          Administra los usuarios de la plataforma
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{users.length}</p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Activos</p>
          <p className="text-2xl font-bold text-green-500">
            {users.filter((u) => u.isActive !== false).length}
          </p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">Inactivos</p>
          <p className="text-2xl font-bold text-red-500">
            {users.filter((u) => u.isActive === false).length}
          </p>
        </div>
      </div>

      {/* Users list */}
      <div className="space-y-3">
        {users.map((user) => {
          const isActive = user.isActive !== false;
          return (
            <Card key={user.id} className={!isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-base">{user.name}</CardTitle>
                      <CardDescription>{user.email}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        isActive
                          ? "bg-green-500/10 text-green-500"
                          : "bg-red-500/10 text-red-500"
                      }
                    >
                      {isActive ? "Activo" : "Inactivo"}
                    </Badge>
                    <Button
                      variant={isActive ? "outline" : "default"}
                      size="sm"
                      onClick={() => handleToggle(user.id)}
                    >
                      {isActive ? (
                        <>
                          <UserX className="h-4 w-4 mr-1" />
                          Desactivar
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4 mr-1" />
                          Activar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {user.organizationProfile && (
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>Org: {user.organizationProfile.organizationName}</span>
                    {user.organizationProfile.slug && (
                      <span>· /{user.organizationProfile.slug}</span>
                    )}
                    {user.organizationProfile.location && (
                      <span>· {user.organizationProfile.location}</span>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {user.organizationProfile.isPublic ? "Público" : "Privado"}
                    </Badge>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
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
