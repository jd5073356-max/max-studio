"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

// Tipos mínimos de la API beforeinstallprompt (Chrome/Edge/Android).
// No está en lib.dom.d.ts todavía, así que declaramos lo que usamos.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "max.pwa.install.dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari legacy.
  const iosStandalone = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone;
  if (iosStandalone) return true;
  // Chrome / moderno.
  return window.matchMedia("(display-mode: standalone)").matches;
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
}

/**
 * Banner no intrusivo que aparece cuando la PWA es instalable.
 * - Android/Chrome/Edge: usa beforeinstallprompt para mostrar nativo.
 * - iOS Safari: muestra instrucciones manuales (Compartir → Añadir a pantalla de inicio).
 * - Si ya está instalada o el usuario rechazó, no se muestra.
 */
export function InstallPrompt() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return; // ya instalado
    if (localStorage.getItem(DISMISSED_KEY) === "1") return;

    // Android / Chrome
    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS: no hay evento nativo; mostramos instrucción manual.
    if (isIOS()) {
      // Delay pequeño para no tapar el primer paint.
      const t = setTimeout(() => setShowIOSHint(true), 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    const installed = () => {
      setPromptEvent(null);
      setShowIOSHint(false);
    };
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setPromptEvent(null);
    setShowIOSHint(false);
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      setPromptEvent(null);
    }
  };

  if (!promptEvent && !showIOSHint) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-lg border border-border bg-card p-4 shadow-lg md:bottom-6 md:right-6">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Download className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-sm font-medium">Instalar MAX Studio</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {promptEvent
                ? "Arráncala desde tu escritorio como una app nativa."
                : "Safari: toca "}
              {!promptEvent && (
                <>
                  <Share className="inline-block h-3 w-3 align-[-2px]" />
                  {" → “Añadir a pantalla de inicio”."}
                </>
              )}
            </p>
          </div>
          {promptEvent && (
            <div className="flex gap-2">
              <Button size="sm" onClick={install}>
                Instalar
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Ahora no
              </Button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar"
          className="rounded p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
