const MODEL_LABELS: Record<string, string> = {
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-opus-4-6": "Opus 4.6",
  "claude-haiku-4-5-20251001": "Haiku 4.5",
  "claude-3-5-sonnet-20241022": "Sonnet 3.5",
  deepseek: "DeepSeek",
  "gpt-oss": "OSS 120b",
};

interface Props {
  model: string;
}

export function ModelBadge({ model }: Props) {
  const label = MODEL_LABELS[model] ?? model.split("/").pop() ?? model;
  return (
    <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
      {label}
    </span>
  );
}
