"use client";

import { useWebSocket } from "@/hooks/useWebSocket";

// Componente que inicializa el WebSocket al montar el layout (app)
// No renderiza nada — solo arranca la conexión y el agente global de eventos
export function WebSocketProvider() {
  useWebSocket();
  return null;
}
