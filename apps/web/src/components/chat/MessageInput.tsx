"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModelSelector } from "@/components/chat/ModelSelector";

interface Props {
  onSend: (content: string) => void;
  onSendWithImage?: (content: string, imageBase64: string, mimeType: string) => void;
  disabled?: boolean;
}

interface ImageAttachment {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

export function MessageInput({ onSend, onSendWithImage, disabled }: Props) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<ImageAttachment | null>(null);

  const submit = () => {
    const content = textRef.current?.value.trim() ?? "";
    if (disabled) return;
    if (!content && !image) return;

    if (image && onSendWithImage) {
      onSendWithImage(content || "Analiza esta imagen", image.base64, image.mimeType);
    } else if (content) {
      onSend(content);
    }

    // Reset
    if (textRef.current) {
      textRef.current.value = "";
      textRef.current.style.height = "auto";
    }
    clearImage();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleInput = () => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Máx 10MB
    if (file.size > 10 * 1024 * 1024) {
      alert("La imagen no puede superar los 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      // dataUrl = "data:image/jpeg;base64,XXXX"
      const [meta, base64] = dataUrl.split(",");
      const mimeType = meta.split(":")[1].split(";")[0];
      setImage({ base64, mimeType, previewUrl: dataUrl });
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const clearImage = () => {
    setImage(null);
  };

  const canSendImage = !!onSendWithImage;

  return (
    <div className="border-t border-border bg-background px-4 py-3">
      {/* Preview de imagen adjunta */}
      {image && (
        <div className="mb-2 flex items-start gap-2">
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.previewUrl}
              alt="Imagen adjunta"
              className="h-20 w-20 rounded-lg object-cover border border-border"
            />
            <button
              onClick={clearImage}
              className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-white"
              aria-label="Quitar imagen"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">
            Kimi K2.6 analizará esta imagen
          </span>
        </div>
      )}

      <div className="flex items-end gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:ring-1 focus-within:ring-primary/50">
        {/* Botón adjuntar imagen */}
        {canSendImage && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={disabled}
              aria-label="Adjuntar imagen"
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <ImagePlus className="h-4 w-4" />
            </button>
          </>
        )}

        <textarea
          ref={textRef}
          rows={1}
          placeholder={image ? "Añade un mensaje (opcional)…" : "Escribe un mensaje…"}
          disabled={disabled}
          className="max-h-[200px] flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          aria-label="Mensaje"
        />

        <Button
          size="icon"
          className="h-7 w-7 shrink-0 rounded-lg"
          disabled={disabled || (!textRef.current?.value.trim() && !image)}
          onClick={submit}
          aria-label="Enviar mensaje"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-1 flex items-center justify-between px-1">
        <ModelSelector />
        <p className="hidden text-center text-[10px] text-muted-foreground md:block">
          MAX · texto vía gpt-120 · imágenes vía Kimi K2.6
        </p>
      </div>
    </div>
  );
}
