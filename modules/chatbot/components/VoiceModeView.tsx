"use client";

import { useEffect, useRef } from "react";
import { X, Keyboard } from "lucide-react";

interface VoiceModeViewProps {
  isListening: boolean;
  transcript: string;
  onClose: () => void;
  onSwitchToText: () => void;
  userName?: string;
}

export function VoiceModeView({
  isListening,
  transcript,
  onClose,
  onSwitchToText,
  userName = "User",
}: VoiceModeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    let animationId: number;
    let time = 0;

    const drawWaveform = () => {
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerY = canvas.height / 2;
      const bars = 50;
      const barWidth = canvas.width / bars;
      const maxHeight = canvas.height * 0.4;

      for (let i = 0; i < bars; i++) {
        const x = i * barWidth;
        const barHeight = isListening
          ? Math.sin((time + i * 0.1) * 0.05) * maxHeight * 0.5 +
            Math.sin((time + i * 0.2) * 0.03) * maxHeight * 0.3 +
            maxHeight * 0.2
          : maxHeight * 0.1;

        // Create gradient for each bar
        const gradient = ctx.createLinearGradient(x, centerY - barHeight, x, centerY + barHeight);
        
        // Color scheme: teal, blue, magenta
        const colors = [
          { offset: 0, color: "rgba(20, 184, 166, 0.8)" }, // teal
          { offset: 0.5, color: "rgba(59, 130, 246, 0.8)" }, // blue
          { offset: 1, color: "rgba(219, 39, 119, 0.8)" }, // magenta
        ];

        colors.forEach(({ offset, color }) => {
          gradient.addColorStop(offset, color);
        });

        ctx.fillStyle = gradient;
        ctx.fillRect(x, centerY - barHeight / 2, barWidth - 2, barHeight);
      }

      // Add particle effects
      if (isListening) {
        for (let i = 0; i < 20; i++) {
          const x = (time * 2 + i * 50) % canvas.width;
          const y = centerY + Math.sin(time * 0.02 + i) * 30;
          const size = Math.random() * 3 + 1;
          
          ctx.fillStyle = `rgba(219, 39, 119, ${0.3 + Math.random() * 0.3})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      time += 1;
      animationId = requestAnimationFrame(drawWaveform);
    };

    drawWaveform();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isListening]);

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-purple-900 to-blue-900 flex flex-col relative">
      {/* Background wave patterns */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 50%),
                           radial-gradient(circle at 80% 80%, rgba(219, 39, 119, 0.3) 0%, transparent 50%),
                           radial-gradient(circle at 40% 20%, rgba(20, 184, 166, 0.3) 0%, transparent 50%)`,
        }} />
      </div>

      {/* Header */}
      <div className="relative z-10 p-3 flex items-center justify-between">
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        <h2 className="text-white text-base font-semibold">Voice Search</h2>
        <button
          onClick={onSwitchToText}
          className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
          title="Switch to text mode"
        >
          <Keyboard className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 relative z-10 overflow-y-auto">
        {/* Greeting */}
        <div className="text-center mb-4">
          <p className="text-gray-300 text-xs mb-1">Hi, {userName}</p>
          <h1 className="text-white text-xl font-bold mb-2">
            How can I help you? 👋
          </h1>
        </div>

        {/* Waveform Visualization */}
        <div className="w-full mb-4">
          <canvas
            ref={canvasRef}
            className="w-full h-32 rounded-xl"
            style={{ background: "rgba(255, 255, 255, 0.05)" }}
          />
        </div>

        {/* Transcript */}
        {transcript && (
          <div className="w-full text-center px-2">
            <p className="text-white text-sm">
              <span className="opacity-70">{transcript.slice(0, -10)}</span>
              <span className="opacity-100">{transcript.slice(-10)}</span>
            </p>
          </div>
        )}

        {/* Listening indicator */}
        {isListening && !transcript && (
          <div className="mt-4">
            <p className="text-gray-300 text-xs animate-pulse">Listening...</p>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="relative z-10 p-4 flex items-center justify-center gap-4">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Voice Assistant Button */}
        <button
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
            isListening
              ? "bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 shadow-xl shadow-purple-500/50 scale-110"
              : "bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-lg"
          }`}
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
            <div className="relative w-6 h-6 bg-white rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full" />
            </div>
          </div>
        </button>

        <button
          onClick={onSwitchToText}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
          title="Switch to text mode"
        >
          <Keyboard className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}

