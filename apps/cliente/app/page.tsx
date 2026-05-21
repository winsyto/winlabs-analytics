import { Button } from "@wla/ui";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-foreground">WinLabs Analytics</h1>
        <p className="text-muted-foreground">App de Clientes</p>
        <div className="flex gap-2 justify-center">
          <Button>Primario</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secundario</Button>
        </div>
      </div>
    </main>
  );
}
