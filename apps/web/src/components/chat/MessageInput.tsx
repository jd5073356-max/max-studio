"use client";

import { useRef, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";

interface Props {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const content = ref.current?.value.trim();
    if (!content || disabled) return;
    onSend(content);
    if (ref.current) {
      ref.current.value = "";
      ref.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleInput = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  return (
    <div className="border-t border-border bg-background px-4 py-3">
      <div className="flex items-end gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:ring-1 focus-within:ring-primary/50">
        <textarea
          ref={ref}
          rows={1}
          placeholder="Escribe un mensaje… (Enter envía · Shift+Enter nueva línea)"
          disabled={disabled}
          className="max-h-[200px] flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          aria-label="Mensaje"
        />
        <Button
          size="icon"
          className="h-7 w-7 shrink-0 rounded-lg"
          disabled={disabled}
          onClick={submit}
          aria-label="Enviar mensaje"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
        MAX puede cometer errores · verifica información importante
      </p>
    </div>
  );
}
