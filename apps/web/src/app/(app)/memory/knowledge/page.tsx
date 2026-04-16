import { BookOpen } from "lucide-react";

export default function KnowledgePage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <BookOpen className="h-10 w-10 text-muted-foreground" aria-hidden />
      <div>
        <h2 className="text-base font-semibold">Knowledge</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pendiente Step 12 — editor de filas knowledge.
        </p>
      </div>
    </div>
  );
}
