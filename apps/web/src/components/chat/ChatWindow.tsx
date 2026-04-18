"use client";

import { useEffect } from "react";

import { useChat } from "@/hooks/useChat";
import { ChatSidebar } from "./ChatSidebar";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";

export function ChatWindow() {
  const { sendMessage, loadHistory, isLoading } = useChat();

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="flex h-full overflow-hidden">
      <ChatSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MessageList />
        <MessageInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
