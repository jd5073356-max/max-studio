"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  FileText,
  MessageSquare,
  Brain,
  Settings,
  Sparkles,
  CalendarClock,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  matchPrefix?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/tasks", label: "Tareas", icon: CalendarClock, matchPrefix: "/tasks" },
  { href: "/system", label: "Sistema", icon: Activity },
  { href: "/memory/conversations", label: "Memoria", icon: Brain, matchPrefix: "/memory" },
  { href: "/docs", label: "Documentos", icon: FileText },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Sparkles className="h-5 w-5 text-primary" aria-hidden />
        <span className="text-sm font-semibold tracking-tight">MAX Studio</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-3" aria-label="Navegación principal">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.matchPrefix
              ? pathname.startsWith(item.matchPrefix)
              : pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-3 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>v0.1.0</span>
          <span className="font-mono">single-user</span>
        </div>
      </div>
    </aside>
  );
}
