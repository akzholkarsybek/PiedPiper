"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  recognitionConstructor,
  speechError,
  type Recognizer,
} from "@/lib/speech";

export function VoiceInput({
  value,
  onChange,
  onRecordingChange,
  disabled = false,
  reply,
}: {
  value: string;
  onChange: (value: string) => void;
  onRecordingChange: (active: boolean) => void;
  disabled?: boolean;
  reply: string;
}) {
  const [micConsent, setMicConsent] = useState(false),
    [recording, setRecording] = useState(false),
    [interim, setInterim] = useState(""),
    [error, setError] = useState(""),
    [spoken, setSpoken] = useState(false);
  const recognition = useRef<Recognizer | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef(value),
    change = useRef(onChange),
    recordingChange = useRef(onRecordingChange);
  useEffect(() => {
    current.current = value;
    change.current = onChange;
    recordingChange.current = onRecordingChange;
  }, [value, onChange, onRecordingChange]);
  useEffect(
    () => () => {
      const r = recognition.current;
      if (r) {
        r.onresult = null;
        r.onerror = null;
        r.onend = null;
        r.abort();
      }
      if (timer.current) clearTimeout(timer.current);
      window.speechSynthesis?.cancel();
    },
    [],
  );
  // Opt-in playback only for the latest Piper reply. Never speak the transcript.
  useEffect(() => {
    if (
      !spoken ||
      !reply ||
      recording ||
      disabled ||
      !("speechSynthesis" in window)
    )
      return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(reply);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [reply, spoken, recording, disabled]);
  function stop() {
    recognition.current?.stop();
    if (timer.current) clearTimeout(timer.current);
  }
  function clear() {
    const r = recognition.current;
    recognition.current = null;
    if (r) {
      r.onresult = null;
      r.onerror = null;
      r.onend = null;
      r.abort();
    }
    if (timer.current) clearTimeout(timer.current);
    setRecording(false);
    onRecordingChange(false);
    setInterim("");
    setError("");
    onChange("");
    current.current = "";
  }
  function start() {
    setError("");
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      setError(
        "Speech recognition is not available in this browser. Continue in the text box below; your conversation stays intact.",
      );
      return;
    }
    if (!window.isSecureContext) {
      setError(
        "Microphone input needs HTTPS or localhost. You can continue by typing.",
      );
      return;
    }
    window.speechSynthesis?.cancel();
    const r = new Constructor();
    recognition.current = r;
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = true;
    // Rebuild from result indices: services may revise earlier interim results.
    const prefix = current.current.trim();
    let captured = "",
      latest = "";
    r.onresult = (event) => {
      const final: string[] = [],
        pending: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        (result.isFinal ? final : pending).push(result[0].transcript);
      }
      captured = final.join(" ").trim();
      latest = pending.join(" ").trim();
      setInterim(latest);
      change.current(
        [prefix, captured].filter(Boolean).join(" ").slice(0, 2500),
      );
    };
    r.onerror = (event) => {
      if (recognition.current !== r) return;
      setError(speechError(event.error));
      r.onend?.();
      r.abort();
    };
    r.onend = () => {
      if (recognition.current !== r) return;
      recognition.current = null;
      if (latest)
        change.current(
          [prefix, captured, latest].filter(Boolean).join(" ").slice(0, 2500),
        );
      setRecording(false);
      recordingChange.current(false);
      setInterim("");
      if (timer.current) clearTimeout(timer.current);
    };
    try {
      r.start();
      setRecording(true);
      onRecordingChange(true);
      timer.current = setTimeout(() => {
        r.stop();
        setError(
          "Recording stopped at 90 seconds. Review your transcript and continue when ready.",
        );
      }, 90000);
    } catch {
      recognition.current = null;
      setError(
        "The microphone could not start. Please try again or type your answer.",
      );
    }
  }
  return (
    <section className="voice-input" aria-label="Voice onboarding">
      <label className="check-label">
        <input
          type="checkbox"
          checked={micConsent}
          disabled={recording}
          onChange={(e) => setMicConsent(e.target.checked)}
        />
        I consent to microphone use and my browser’s speech service processing
        fictional speech.
      </label>
      <div className="inline-actions">
        <Button
          type="button"
          variant={recording ? "destructive" : "secondary"}
          disabled={disabled || !micConsent}
          onClick={recording ? stop : start}
        >
          {recording ? <Square size={16} /> : <Mic size={17} />}{" "}
          {recording ? "Stop recording" : "Talk to Piper"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          disabled={disabled}
          onClick={clear}
        >
          Clear transcript
        </Button>
      </div>
      {recording && (
        <p role="status" className="recording-status">
          <span className="status-dot" />
          Recording · speak naturally · stop to review before sending
        </p>
      )}
      {interim && (
        <p className="voice-interim" aria-live="polite">
          Live transcript (not final): {interim}
        </p>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <p className="fine-print">
        Review and correct the text below, then press Send. Nothing is
        automatically sent to Gemini. Your browser may send audio to its speech
        provider. This app does not retain raw audio.
      </p>
      <label className="check-label">
        <input
          type="checkbox"
          checked={spoken}
          onChange={(e) => setSpoken(e.target.checked)}
        />
        <Volume2 size={14} />
        Read Piper’s responses aloud (browser voice)
      </label>
      {spoken && (
        <button
          type="button"
          className="text-link"
          onClick={() => window.speechSynthesis?.cancel()}
        >
          Stop spoken response
        </button>
      )}
    </section>
  );
}
