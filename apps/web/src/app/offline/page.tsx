// Fallback que muestra el service worker cuando el usuario está offline
// y Next no puede responder. Pública, sin auth.

export const metadata = {
  title: "Sin conexión — MAX Studio",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15 text-primary text-2xl font-bold">
          M
        </div>
        <h1 className="text-xl font-semibold">Sin conexión</h1>
        <p className="text-sm text-muted-foreground">
          MAX necesita conexión para responder. Reconecta y recarga la página.
        </p>
      </div>
    </main>
  );
}
