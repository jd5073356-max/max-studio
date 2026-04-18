"use client";

import { useSystemStatus } from "@/hooks/useSystemStatus";

/**
 * Monta polling global de /system/status para mantener el dot del header
 * y el estado del agente en tiempo real desde cualquier página.
 * No renderiza nada visible.
 */
export function SystemPoller() {
  useSystemStatus(true);
  return null;
}
