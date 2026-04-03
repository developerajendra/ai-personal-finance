"use client";

import { useSession } from "next-auth/react";
import { ReactNode } from "react";
import { Loader2, LogIn } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

interface SessionGateProps {
  children: ReactNode;
}

const PUBLIC_PATHS = ["/auth/signin", "/auth/register"];

export function SessionGate({ children }: SessionGateProps) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPage = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin");
    return null;
  }

  return <>{children}</>;
}
