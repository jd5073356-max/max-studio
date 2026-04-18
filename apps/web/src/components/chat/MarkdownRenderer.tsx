"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import type { ComponentPropsWithoutRef } from "react";

// Tema de highlight.js para bloques de código
import "highlight.js/styles/github-dark.css";

interface Props {
  content: string;
}

type CodeProps = ComponentPropsWithoutRef<"code"> & { inline?: boolean };

export function MarkdownRenderer({ content }: Props) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight, rehypeRaw]}
      components={{
        // Bloques pre/code — estilo MAX Studio
        pre: ({ children }) => (
          <pre className="overflow-x-auto rounded-md bg-card p-3 font-mono text-xs ring-1 ring-border">
            {children}
          </pre>
        ),
        code: ({ inline, className, children, ...props }: CodeProps) =>
          inline ? (
            <code
              className="rounded bg-card px-1.5 py-0.5 font-mono text-xs ring-1 ring-border"
              {...props}
            >
              {children}
            </code>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          ),
        // Tablas
        table: ({ children }) => (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border px-3 py-1.5 text-left font-semibold text-foreground">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border px-3 py-1.5 text-muted-foreground">
            {children}
          </td>
        ),
        // Blockquote
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary pl-4 text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        // Headings
        h1: ({ children }) => (
          <h1 className="text-base font-semibold text-foreground">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-semibold text-foreground">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-medium text-foreground">{children}</h3>
        ),
        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {children}
          </a>
        ),
        // Listas
        ul: ({ children }) => (
          <ul className="list-disc space-y-1 pl-5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal space-y-1 pl-5">{children}</ol>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
