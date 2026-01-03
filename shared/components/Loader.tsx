"use client";

import { Loader2 } from "lucide-react";

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
  fullScreen?: boolean;
}

export function Loader({ size = "md", className = "", text, fullScreen = false }: LoaderProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const loader = (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600`} />
      {text && <p className="text-sm text-gray-600">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
        {loader}
      </div>
    );
  }

  return loader;
}

interface InlineLoaderProps {
  className?: string;
}

export function InlineLoader({ className = "" }: InlineLoaderProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
      <span className="text-sm text-gray-600">Loading...</span>
    </div>
  );
}

interface ButtonLoaderProps {
  className?: string;
}

export function ButtonLoader({ className = "" }: ButtonLoaderProps) {
  return <Loader2 className={`w-4 h-4 animate-spin ${className}`} />;
}

