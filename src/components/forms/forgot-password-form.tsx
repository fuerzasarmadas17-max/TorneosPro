"use client";

import { useState } from "react";
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

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { requestPasswordReset } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Ingresa tu email");
      return;
    }

    setLoading(true);
    const result = await requestPasswordReset(email);
    setLoading(false);

    if (result.success) {
      // Always show the same confirmation regardless of whether the email
      // exists — prevents account enumeration.
      setSent(true);
    } else {
      setError(result.error || "Error al solicitar el restablecimiento");
    }
  };

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Revisa tu correo</CardTitle>
          <CardDescription>
            Si <strong>{email}</strong> esta asociado a una cuenta, te enviamos un enlace para restablecer la contrasena.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            El enlace expira en una hora. No lo ves? Revisa tu carpeta de spam.
          </p>
        </CardContent>
        <CardFooter>
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
        <CardTitle className="text-2xl">Recuperar contrasena</CardTitle>
        <CardDescription>
          Ingresa tu email y te enviaremos un enlace para crear una nueva contrasena.
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
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-6">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enviando..." : "Enviar enlace"}
          </Button>
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              Volver a iniciar sesion
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
