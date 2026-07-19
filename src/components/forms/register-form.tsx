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
import { POLICIES_VERSION } from "@/lib/policies";
import { toast } from "sonner";

export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name || !email || !password || !confirmPassword) {
      setError("Todos los campos son obligatorios");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (!acceptedPolicies) {
      setError("Debes aceptar la Política de Privacidad y la de Tratamiento de Datos");
      return;
    }

    setLoading(true);
    const result = await register(name, email, password, POLICIES_VERSION);
    setLoading(false);

    if (result.success) {
      if (result.needsEmailConfirmation) {
        setEmailSent(true);
      } else {
        toast.success("Cuenta creada correctamente");
        router.push("/dashboard");
      }
    } else {
      setError(result.error || "Error al registrarse");
    }
  };

  if (emailSent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Revisa tu correo</CardTitle>
          <CardDescription>
            Hemos enviado un enlace de confirmación a <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Haz clic en el enlace del correo para activar tu cuenta. Una vez confirmado, podrás iniciar sesión.
          </p>
          <p className="text-sm text-muted-foreground">
            ¿No lo ves? Revisa tu carpeta de spam.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">Ir a Iniciar Sesión</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Registrarse</CardTitle>
        <CardDescription>
          Crea una cuenta para empezar a organizar torneos
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
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
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
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={acceptedPolicies}
              onChange={(e) => setAcceptedPolicies(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
            />
            <span>
              He leído y acepto la{" "}
              <Link href="/privacidad" target="_blank" className="text-primary hover:underline">
                Política de Privacidad
              </Link>{" "}
              y la{" "}
              <Link href="/tratamiento-de-datos" target="_blank" className="text-primary hover:underline">
                Política de Tratamiento de Datos
              </Link>
              .
            </span>
          </label>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-6">
          <Button type="submit" className="w-full" disabled={loading || !acceptedPolicies}>
            {loading ? "Registrando..." : "Registrarse"}
          </Button>
          <p className="text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Inicia Sesión
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
