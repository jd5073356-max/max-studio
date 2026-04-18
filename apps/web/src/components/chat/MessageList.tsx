"use client";

import { useEffect, useRef } from "react";

import { useChatStore } from "@/store/chat";
import { MessageBubble } from "./MessageBubble";

export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const streaming = useChatStore((s) => s.streaming);
  const isLoading = useChatStore((s) => s.isLoading);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al fondo con cada token nuevo o mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streaming?.content]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">Chat con MAX</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Escribe un mensaje para comenzar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto py-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* Mensaje del asistente en construcción */}
      {streaming && (
        <MessageBubble
          message={{
            id: streaming.sessionId,
            role: "assistant",
            content: streaming.content,
            created_at: new Date().toISOString(),
          }}
          isStreaming
        />
      )}

      {/* Indicador "pensando" — antes del primer token */}
      {isLoading && !streaming && (
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            M
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
