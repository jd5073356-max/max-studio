"use client";

import { useEffect, useRef } from "react";

import { WebSocketClient } from "@/lib/ws";
import { useWsStore } from "@/store/ws";
import { getToken } from "@/store/auth";
import { useSettingsStore } from "@/store/settings";
import type { WsInboundEvent } from "@/types/ws-events";

// Singleton — una sola instancia por sesión de la app
let clientInstance: WebSocketClient | null = null;

/** Construye la URL del WS con el token como query param */
function buildWsUrl(): string {
  const override = useSettingsStore.getState().gatewayUrlOverride;
  const base = override || process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8003";
  // Convertir http(s) → ws(s) si el override es una URL http
  const wsBase = base.replace(/^http/, "ws").replace(/\/$/, "");
  const token = getToken();
  return token ? `${wsBase}/ws?token=${token}` : `${wsBase}/ws`;
}

/** Accede al cliente WS activo sin pasar por el hook (para useChat, etc.) */
export function getWsClient(): WebSocketClient | null {
  return clientInstance;
}

export function useWebSocket(
  listener?: (event: WsInboundEvent) => void,
) {
  const { setStatus, setAgentOnline } = useWsStore();
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    // Crear el cliente singleton la primera vez
    if (!clientInstance) {
      // Pasamos buildWsUrl como factory — reconstruye URL (con token fresco) en cada reconexión
      clientInstance = new WebSocketClient(buildWsUrl, setStatus);
      clientInstance.connect();
    }

    // Listener global: agent.status
    const unsubAgent = clientInstance.on((event) => {
      if (event.type === "agent.status") {
        setAgentOnline(event.online);
      }
    });

    return () => {
      unsubAgent();
    };
  }, [setStatus, setAgentOnline]);

  // Listener opcional del componente que llama este hook
  useEffect(() => {
    if (!listener || !clientInstance) return;
    const unsub = clientInstance.on((event) => listenerRef.current?.(event));
    return unsub;
  }, [listener]);

  return {
    send: (event: Parameters<WebSocketClient["send"]>[0]) =>
      clientInstance?.send(event),
    status: useWsStore.getState().status,
  };
}
