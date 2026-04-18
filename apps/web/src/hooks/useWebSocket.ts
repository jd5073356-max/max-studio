"use client";

import { useEffect, useRef } from "react";

import { WebSocketClient } from "@/lib/ws";
import { useWsStore } from "@/store/ws";
import type { WsInboundEvent } from "@/types/ws-events";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8003/ws";

// Singleton — una sola instancia por sesión de la app
let clientInstance: WebSocketClient | null = null;

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
      clientInstance = new WebSocketClient(WS_URL, setStatus);
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
