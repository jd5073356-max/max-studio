import { MessageSquare } from "lucide-react";

export default function ChatPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <MessageSquare className="h-10 w-10 text-muted-foreground" aria-hidden />
      <div>
        <h2 className="text-base font-semibold">Chat con MAX</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pendiente Step 6 — streaming WebSocket + render markdown/mermaid.
        </p>
      </div>
    </div>
  );
}
