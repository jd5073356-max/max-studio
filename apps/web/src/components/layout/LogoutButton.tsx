"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { logout } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    try {
      await logout();
      router.replace("/login");
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo cerrar sesión";
      toast.error(message);
      setPending(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={handleClick}
      disabled={pending}
      aria-label="Cerrar sesión"
    >
      <LogOut className="h-4 w-4" />
    </Button>
  );
}
