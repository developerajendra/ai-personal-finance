"use client";

import { Mic, MicOff, X } from "lucide-react";
import { cn } from "@/shared/utils/cn";

type VoiceState = "listening" | "thinking" | "speaking" | "muted" | "idle";

interface VoiceModeViewProps {
  isListening: boolean;
  /** Waiting for the assistant's reply */
  isThinking?: boolean;
  /** Reply is being read aloud */
  isSpeaking?: boolean;
  isMuted?: boolean;
  transcript: string;
  onToggleMute?: () => void;
  onClose: () => void;
}

const STATUS: Record<VoiceState, string> = {
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  muted: "Mic is off",
  idle: "Start speaking",
};

/**
 * Voice conversation screen in the style of ChatGPT's voice mode: a calm, theme-coloured
 * surface with one large animated orb (breathes while listening, shimmers while thinking,
 * pulses while speaking), a status line with live captions, and round mute / end controls.
 */
export function VoiceModeView({ isListening, isThinking = false, isSpeaking = false, isMuted = false, transcript, onToggleMute, onClose }: VoiceModeViewProps) {
  const state: VoiceState = isSpeaking ? "speaking" : isThinking ? "thinking" : isMuted ? "muted" : isListening ? "listening" : "idle";

  return (
    <div className="flex h-full w-full flex-col bg-[var(--dialog-bg)] text-ink">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <span className="text-[13px] font-medium text-muted">Personal Finance AI · Voice</span>
        <span className="text-[12px] text-muted">Finance questions only</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
        <div className="voice-orb" data-state={state} aria-hidden>
          <div className="voice-orb__glow" />
          <div className="voice-orb__core">
            <div className="voice-orb__swirl" />
            <div className="voice-orb__shine" />
          </div>
        </div>

        <div className="min-h-[76px] w-full max-w-[420px] text-center" aria-live="polite">
          <p className="text-[15px] font-semibold">
            {STATUS[state]}
            {(state === "listening" || state === "thinking") && <span className="voice-dots" aria-hidden />}
          </p>
          {transcript && state !== "speaking" ? (
            <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-muted">“{transcript}”</p>
          ) : (
            <p className="mt-2 text-[13px] text-muted">
              {state === "muted" ? "Tap the mic to keep talking" : state === "speaking" ? "Tap the mic to pause listening" : "Ask about your net worth, loans, budget…"}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 pb-7 pt-2">
        {onToggleMute && (
          <button
            type="button"
            onClick={onToggleMute}
            aria-pressed={isMuted}
            aria-label={isMuted ? "Turn mic on" : "Turn mic off"}
            title={isMuted ? "Turn mic on" : "Turn mic off"}
            className={cn(
              "grid h-14 w-14 place-items-center rounded-full transition-colors",
              isMuted ? "bg-loss-bg text-loss" : "bg-tile text-ink hover:bg-[color-mix(in_srgb,var(--color-text)_10%,transparent)]",
            )}>
            {isMuted ? <MicOff className="h-[22px] w-[22px]" /> : <Mic className="h-[22px] w-[22px]" />}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="End voice mode"
          title="End voice mode"
          className="grid h-14 w-14 place-items-center rounded-full bg-[var(--fin-loss)] text-white transition-opacity hover:opacity-90">
          <X className="h-[22px] w-[22px]" />
        </button>
      </div>
    </div>
  );
}
