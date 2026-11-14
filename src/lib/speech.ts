// Small typed adapter for the prefixed/unprefixed Web Speech API.
// Audio is managed by the browser's recognition service; we never store it.
export type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
export type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
};
export type Recognizer = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
export type RecognitionConstructor = new () => Recognizer;
export function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}
export function speechError(code: string) {
  if (["not-allowed", "service-not-allowed"].includes(code))
    return "Microphone or speech-service permission was denied. You can enable it in browser settings, or continue by typing.";
  if (code === "audio-capture")
    return "No working microphone was found. Check your microphone, or continue by typing.";
  if (code === "no-speech")
    return "No speech was detected. Your existing text is safe. Try again or type your answer.";
  if (code === "network")
    return "The browser speech service could not be reached. Your existing text is safe; continue by typing or try again.";
  return "Speech recognition stopped. Review the captured text or continue by typing.";
}
