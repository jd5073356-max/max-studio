"use client";

import { useCallback } from "react";
import { toast } from "sonner";

import { useWebSocket, getWsClient } from "@/hooks/useWebSocket";
import { useThreads } from "@/hooks/useThreads";
import { useChatStore } from "@/store/chat";
import { apiFetch } from "@/lib/api";
import type { WsInboundEvent } from "@/types/ws-events";

export function useChat() {
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const onToken = useChatStore((s) => s.onToken);
  const onDone = useChatStore((s) => s.onDone);
  const onError = useChatStore((s) => s.onError);
  const isLoading = useChatStore((s) => s.isLoading);

  const { loadThreads, openThread, newThread } = useThreads();

  // Listener estable — se registra a través de useWebSocket que garantiza
  // que el singleton ya existe cuando se registra el listener
  const handleWsEvent = useCallback(
    (event: WsInboundEvent) => {
      if (event.type === "chat.token") {
        onToken(event.session_id, event.token);
      } else if (event.type === "chat.done") {
        onDone(event.session_id, event.model_used, event.conversation_id);
        void loadThreads();
      } else if (event.type === "chat.error") {
        onError(event.session_id, event.detail);
      } else if (event.type === "task.auto_created") {
        toast.success(`✅ Tarea creada: ${event.title}`, {
          description: `Programada: ${event.schedule}`,
          duration: 5000,
        });
      }
    },
    [onToken, onDone, onError, loadThreads],
  );

  // Esto garantiza que el listener se registra DESPUÉS de que el singleton existe
  useWebSocket(handleWsEvent);

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

  const sendVision = useCallback(
    async (content: string, imageBase64: string, mimeType: string) => {
      if (isLoading) return;
      const text = content.trim() || "Analiza esta imagen";
      addUserMessage(text);
      const sessionId = crypto.randomUUID();
      try {
        const result = await apiFetch<{ content: string; model: string }>("/vision/analyze", {
          method: "POST",
          body: { message: text, image_base64: imageBase64, mime_type: mimeType },
        });
        // Simula el patrón token→done para que el store lo maneje igual
        onToken(sessionId, result.content);
        onDone(sessionId, result.model, `vision-${Date.now()}`);
        void loadThreads();
      } catch (e) {
        onError(sessionId, e instanceof Error ? e.message : "Error al analizar imagen");
      }
    },
    [isLoading, addUserMessage, onToken, onDone, onError, loadThreads],
  );

  return { sendMessage, sendVision, loadHistory, openThread, newThread, isLoading };
}
