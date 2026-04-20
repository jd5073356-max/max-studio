"use client";

import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";

import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";

export function PushToggle() {
  const { state, loading, subscribe, unsubscribe } = usePushNotifications();

  // No mostrar nada si el dispositivo no soporta push
  if (state === "unsupported") return null;

  const handleClick = () => {
    if (state === "subscribed") {
      void unsubscribe();
    } else {
      void subscribe();
    }
  };

  const icon = () => {
    if (loading) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (state === "subscribed") return <BellRing className="h-4 w-4 text-primary" />;
    if (state === "denied") return <BellOff className="h-4 w-4 text-destructive" />;
    return <Bell className="h-4 w-4" />;
  };

  const label = () => {
    if (state === "subscribed") return "Desactivar notificaciones push";
    if (state === "denied") return "Notificaciones bloqueadas en el navegador";
    return "Activar notificaciones push";
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={handleClick}
      disabled={loading || state === "denied"}
      aria-label={label()}
      title={label()}
    >
      {icon()}
    </Button>
  );
}
