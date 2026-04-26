"use client";

import { useAuth } from "@/firebase";
import { Lock } from "lucide-react";
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RequirePermissionProps {
  action: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RequirePermission({ action, children, fallback }: RequirePermissionProps) {
  const { userProfile } = useAuth();

  const isAuthorized = userProfile?.role === "admin" || userProfile?.role === "manager";

  if (isAuthorized) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative cursor-not-allowed opacity-60 select-none pointer-events-none">
            {children}
            <div className="absolute top-1 right-1 bg-slate-950 border border-slate-800 p-1 rounded-full shadow-lg">
              <Lock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-slate-950 text-slate-50 border-slate-800 text-xs font-medium">
          Permiso denegado. Esta acción requiere credenciales de Dueño.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
