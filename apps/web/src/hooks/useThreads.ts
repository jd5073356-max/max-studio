"use client";

import { useCallback } from "react";

import { apiFetch } from "@/lib/api";
import { useChatStore, type ChatMessage, type ChatThread } from "@/store/chat";

export function useThreads() {
  const setThreads = useChatStore((s) => s.setThreads);
  const setMessages = useChatStore((s) => s.setMessages);
  const setActiveThread = useChatStore((s) => s.setActiveThread);
  const startNewThread = useChatStore((s) => s.startNewThread);

  const loadThreads = useCallback(async () => {
    try {
      const threads = await apiFetch<ChatThread[]>("/chat/threads");
      setThreads(threads);
      return threads;
    } catch {
      setThreads([]);
      return [];
    }
  }, [setThreads]);

  const openThread = useCallback(
    async (threadId: string) => {
      try {
        const msgs = await apiFetch<ChatMessage[]>(
          `/chat/threads/${encodeURIComponent(threadId)}/messages`,
        );
        setMessages(msgs);
        setActiveThread(threadId);
      } catch {
        setMessages([]);
        setActiveThread(threadId);
      }
    },
    [setMessages, setActiveThread],
  );

  const newThread = useCallback(() => {
    startNewThread();
  }, [startNewThread]);

  return { loadThreads, openThread, newThread };
}
