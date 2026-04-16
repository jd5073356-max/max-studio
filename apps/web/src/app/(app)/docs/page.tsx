import { FileText } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <FileText className="h-10 w-10 text-muted-foreground" aria-hidden />
      <div>
        <h2 className="text-base font-semibold">Documentos generados</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pendiente Step 13 — grid de PDFs/XLSX/DOCX generados por MAX.
        </p>
      </div>
    </div>
  );
}
