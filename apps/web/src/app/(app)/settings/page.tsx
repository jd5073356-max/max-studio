import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Settings className="h-10 w-10 text-muted-foreground" aria-hidden />
      <div>
        <h2 className="text-base font-semibold">Ajustes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pendiente Step 16 — modelo default, push, theme, logout.
        </p>
      </div>
    </div>
  );
}
