"use client";

import { useState } from "react";
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
import { MOCK_USERS } from "@/data/users";
import { toast } from "sonner";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const router = useRouter();

  const quickLogin = (userEmail: string, userPassword: string) => {
    const result = login(userEmail, userPassword);
    if (result.success) {
      toast.success("Sesion iniciada correctamente");
      router.push("/dashboard");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Todos los campos son obligatorios");
      return;
    }

    const result = login(email, password);
    if (result.success) {
      toast.success("Sesion iniciada correctamente");
      router.push("/dashboard");
    } else {
      setError(result.error || "Error al iniciar sesion");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Iniciar Sesion</CardTitle>
        <CardDescription>
          Ingresa tus credenciales para acceder a tu cuenta
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Quick login buttons */}
          <div className="space-y-2">
            <Label>Acceso rapido</Label>
            <div className="grid gap-2">
              {MOCK_USERS.map((u) => (
                <Button
                  key={u.id}
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => quickLogin(u.email, u.password)}
                >
                  <span className="font-medium">{u.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {u.email}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">o ingresa manualmente</span>
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contrasena</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full">
            Iniciar Sesion
          </Button>
          <p className="text-sm text-muted-foreground">
            No tienes cuenta?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Registrate
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
