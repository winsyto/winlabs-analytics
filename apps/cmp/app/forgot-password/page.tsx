import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wla/ui/components/card";
import { Button } from "@wla/ui/components/button";
import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            WinLabs Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Console interno</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recuperar contraseña</CardTitle>
            <CardDescription>
              Esta funcionalidad estará disponible próximamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              El envío de emails de recuperación se habilitará cuando se
              configure Resend. Por ahora, contactá a un administrador de
              WinLabs para resetear tu contraseña.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Volver al login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
