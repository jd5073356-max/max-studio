"use client";

import { useEffect, useState } from "react";
import { LayoutList, MessageSquarePlus } from "lucide-react";

import { useChat } from "@/hooks/useChat";
import { useThreads } from "@/hooks/useThreads";
import { useChatStore } from "@/store/chat";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ChatSidebar } from "./ChatSidebar";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";

/** Barra móvil encima del chat: hilo activo + botón de hilos */
function MobileChatBar() {
  const [open, setOpen] = useState(false);
  const threads = useChatStore((s) => s.threads);
  const activeThreadId = useChatStore((s) => s.activeThreadId);
  const { newThread } = useThreads();
  const active = threads.find((t) => t.id === activeThreadId);

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-background px-3 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Conversaciones" />
          }
        >
          <LayoutList className="h-4 w-4" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-r border-border bg-background p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Conversaciones</SheetTitle>
          </SheetHeader>
          {/* Reutilizamos el sidebar completo dentro del drawer */}
          <ChatSidebar forceVisible onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <span className="flex-1 truncate text-xs text-muted-foreground">
        {active?.title ?? "Nueva conversación"}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label="Nueva conversación"
        onClick={() => { newThread(); setOpen(false); }}
      >
        <MessageSquarePlus className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function ChatWindow() {
  const { sendMessage, loadHistory, isLoading } = useChat();

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar visible solo en desktop */}
      <ChatSidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Barra de hilos solo en móvil */}
        <MobileChatBar />

        <MessageList />
        <MessageInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
