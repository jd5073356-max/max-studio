import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/store/chat";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ModelBadge } from "./ModelBadge";
import { StreamingCursor } from "./StreamingCursor";

interface Props {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex w-full gap-3 px-4 py-1.5", isUser && "justify-end")}>
      {/* Avatar MAX */}
      {!isUser && (
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          M
        </div>
      )}

      <div className={cn("flex max-w-[82%] flex-col gap-1", isUser && "items-end")}>
        {/* Contenido */}
        {isUser ? (
          <div className="rounded-2xl rounded-tr-sm bg-primary/10 px-4 py-2.5 text-sm text-foreground ring-1 ring-inset ring-primary/20">
            {message.content}
          </div>
        ) : (
          <div className="text-sm text-foreground">
            <MarkdownRenderer content={message.content} />
            {isStreaming && <StreamingCursor />}
          </div>
        )}

        {/* Badge modelo */}
        {message.model_used && (
          <div className="mt-0.5">
            <ModelBadge model={message.model_used} />
          </div>
        )}
      </div>

      {/* Avatar usuario */}
      {isUser && (
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
          JD
        </div>
      )}
    </div>
  );
}
