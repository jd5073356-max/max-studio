"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/Sidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { AgentStatusDot } from "@/components/layout/AgentStatusDot";

const TITLES: Record<string, string> = {
  "/chat": "Chat",
  "/tasks": "Tareas programadas",
  "/tasks/new": "Nueva tarea",
  "/system": "Sistema",
  "/memory/conversations": "Conversaciones",
  "/memory/knowledge": "Knowledge",
  "/docs": "Documentos",
  "/settings": "Ajustes",
};

function resolveTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/chat/")) return "Chat";
  if (pathname.startsWith("/tasks/")) return "Tareas programadas";
  if (pathname.startsWith("/memory/")) return "Memoria";
  return "MAX Studio";
}

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const title = resolveTitle(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:hidden"
              aria-label="Abrir menú"
            />
          }
        >
          <Menu className="h-4 w-4" />
        </SheetTrigger>
        <SheetContent side="left" className="w-60 border-r border-sidebar-border bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navegación MAX Studio</SheetTitle>
          </SheetHeader>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <h1 className="flex-1 truncate text-sm font-medium">{title}</h1>

      <div className="flex items-center gap-1">
        <AgentStatusDot online={false} />
        <ThemeToggle />
      </div>
    </header>
  );
}
