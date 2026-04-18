import type { ReactNode } from "react";

import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { SystemPoller } from "@/components/system/SystemPoller";
import { WebSocketProvider } from "@/components/ws/WebSocketProvider";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <WebSocketProvider />
      <SystemPoller />
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <InstallPrompt />
    </div>
  );
}
