"use client";

import { useCallback, useEffect } from "react";

import { getWsClient } from "@/hooks/useWebSocket";
import { useThreads } from "@/hooks/useThreads";
import { useChatStore } from "@/store/chat";
import type { WsInboundEvent } from "@/types/ws-events";

export function useChat() {
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const onToken = useChatStore((s) => s.onToken);
  const onDone = useChatStore((s) => s.onDone);
  const onError = useChatStore((s) => s.onError);
  const isLoading = useChatStore((s) => s.isLoading);

  const { loadThreads, openThread, newThread } = useThreads();

  // Registrar listeners WS para eventos de chat
  useEffect(() => {
    const client = getWsClient();
    if (!client) return;

    const unsub = client.on((event: WsInboundEvent) => {
      if (event.type === "chat.token") {
        onToken(event.session_id, event.token);
      } else if (event.type === "chat.done") {
        onDone(event.session_id, event.model_used, event.conversation_id);
        // Refresh sidebar: el hilo activo creció o se creó uno nuevo
        void loadThreads();
      } else if (event.type === "chat.error") {
        onError(event.session_id, event.detail);
      }
    });

    return unsub;
  }, [onToken, onDone, onError, loadThreads]);

  /**
   * Carga inicial: trae lista de hilos; si existe alguno, abre el más
   * reciente. Si no hay hilos, arranca estado vacío (nuevo hilo).
   */
  const loadHistory = useCallback(async () => {
    const threads = await loadThreads();
    if (threads.length > 0) {
      await openThread(threads[0].id);
    }
  }, [loadThreads, openThread]);

  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) return;
      addUserMessage(trimmed);
      getWsClient()?.send({ type: "chat.send", content: trimmed });
    },
    [addUserMessage, isLoading],
  );

  return { sendMessage, loadHistory, openThread, newThread, isLoading };
}
