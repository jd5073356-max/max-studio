import { create } from "zustand";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model_used?: string;
  created_at: string;
};

export type ChatThread = {
  id: string; // ISO timestamp del primer mensaje
  title: string;
  first_message_at: string;
  last_message_at: string;
  message_count: number;
};

type ChatStore = {
  messages: ChatMessage[];
  /** Mensaje del asistente en construcción (streaming en curso). */
  streaming: { sessionId: string; content: string } | null;
  /** true mientras esperamos el primer token o guardando usuario. */
  isLoading: boolean;

  /** Lista de hilos del historial (sidebar). */
  threads: ChatThread[];
  /** Hilo abierto actualmente. null = hilo nuevo sin mensajes. */
  activeThreadId: string | null;

  setMessages: (msgs: ChatMessage[]) => void;
  setThreads: (threads: ChatThread[]) => void;
  setActiveThread: (id: string | null) => void;
  setLoading: (v: boolean) => void;
  startNewThread: () => void;

  addUserMessage: (content: string) => void;
  onToken: (sessionId: string, token: string) => void;
  onDone: (sessionId: string, modelUsed: string, dbId: string) => void;
  onError: (sessionId: string, detail: string) => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  streaming: null,
  isLoading: false,
  threads: [],
  activeThreadId: null,

  setMessages: (messages) => set({ messages }),
  setThreads: (threads) => set({ threads }),
  setActiveThread: (activeThreadId) => set({ activeThreadId }),
  setLoading: (isLoading) => set({ isLoading }),

  startNewThread: () =>
    set({
      messages: [],
      activeThreadId: null,
      streaming: null,
      isLoading: false,
    }),

  addUserMessage: (content) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: `user-${Date.now()}`,
          role: "user",
          content,
          created_at: new Date().toISOString(),
        },
      ],
      isLoading: true,
      streaming: null,
    })),

  onToken: (sessionId, token) =>
    set((s) => {
      if (!s.streaming || s.streaming.sessionId !== sessionId) {
        return { streaming: { sessionId, content: token }, isLoading: false };
      }
      return {
        streaming: { ...s.streaming, content: s.streaming.content + token },
      };
    }),

  onDone: (sessionId, modelUsed, dbId) =>
    set((s) => {
      if (!s.streaming || s.streaming.sessionId !== sessionId) {
        return { isLoading: false };
      }
      return {
        messages: [
          ...s.messages,
          {
            id: dbId || sessionId,
            role: "assistant",
            content: s.streaming.content,
            model_used: modelUsed,
            created_at: new Date().toISOString(),
          },
        ],
        streaming: null,
        isLoading: false,
      };
    }),

  onError: (sessionId, detail) =>
    set((s) => {
      const content =
        s.streaming?.sessionId === sessionId && s.streaming.content
          ? `${s.streaming.content}\n\n_Error: ${detail}_`
          : `_Error: ${detail}_`;
      return {
        messages: [
          ...s.messages,
          {
            id: sessionId,
            role: "assistant",
            content,
            created_at: new Date().toISOString(),
          },
        ],
        streaming: null,
        isLoading: false,
      };
    }),
}));
