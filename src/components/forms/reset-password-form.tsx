"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type Status = "checking" | "ready" | "invalid";

export function ResetPasswordForm() {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { updatePassword, logout } = useAuth();
  const router = useRouter();

  // The recovery link drops the user here with a Supabase session attached to
  // the URL (hash or PKCE code). detectSessionInUrl (default true) processes
  // it and fires PASSWORD_RECOVERY. We accept either that event or an existing
  // session as a green light to allow the password change.
  useEffect(() => {
    let resolved = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        resolved = true;
        setStatus("ready");
      }
    });

    // Some browsers fire INITIAL_SESSION before our listener mounts.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (resolved) return;
      if (session) {
        resolved = true;
        setStatus("ready");
      }
    });

    // If nothing landed in 4s, treat the link as invalid/expired.
    const timer = setTimeout(() => {
      if (!resolved) setStatus("invalid");
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password || !confirmPassword) {
      setError("Completa los dos campos");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contrasenas no coinciden");
      return;
    }
    if (password.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    const result = await updatePassword(password);
    if (!result.success) {
      setLoading(false);
      setError(result.error || "Error al actualizar la contrasena");
      return;
    }

    // Force a fresh login with the new password — safer than carrying the
    // recovery session into the dashboard.
    await logout();
    setLoading(false);
    toast.success("Contrasena actualizada. Inicia sesion nuevamente.");
    router.push("/login");
  };

  if (status === "checking") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Verificando enlace...</CardTitle>
          <CardDescription>Esto toma unos segundos.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === "invalid") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Enlace invalido o expirado</CardTitle>
          <CardDescription>
            El enlace para restablecer la contrasena no es valido o ya expiro. Solicita uno nuevo.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-2 pt-6">
          <Button className="w-full" asChild>
            <Link href="/forgot-password">Solicitar nuevo enlace</Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">Volver a Iniciar Sesion</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Nueva contrasena</CardTitle>
        <CardDescription>
          Elegi una contrasena nueva para tu cuenta.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">Nueva contrasena</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar contrasena</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </CardContent>
        <CardFooter className="pt-6">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Guardando..." : "Guardar contrasena"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
