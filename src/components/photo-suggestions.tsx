"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, ImageOff, LoaderCircle, X } from "lucide-react";
import { Button } from "./ui/button";
import { useGeminiStatus } from "./ai-status";
import { suggestionSchema, type Suggestion } from "@/lib/enrichment";

type Photo = { id: string; url: string; file: File };
const MAX_PHOTOS = 3,
  MAX_BYTES = 2 * 1024 * 1024;
const allowed = ["image/jpeg", "image/png", "image/webp"];

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("The photo could not be read."));
    reader.readAsDataURL(file);
  });
}

/**
 * Optional photos of the person's own activities. Previews stay in this
 * browser tab's memory only (never saved). Analysis runs only when the server
 * operator enabled it for a suitable provider configuration AND the person
 * confirms the photos are theirs and consents. Results are pending questions.
 */
export function PhotoSuggestions({
  existing,
  onSuggestions,
}: {
  existing: { interests: string[] };
  onSuggestions: (s: Suggestion[], message: string) => void;
}) {
  const status = useGeminiStatus() as
    (ReturnType<typeof useGeminiStatus> & { photoAnalysis?: boolean }) | null;
  const enabled = !!status?.photoAnalysis;
  const [photos, setPhotos] = useState<Photo[]>([]),
    [own, setOwn] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  // Release object URLs when the component goes away.
  useEffect(
    () => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)),
    [],
  );
  function add(files: FileList | null) {
    setError("");
    const next = [...photos];
    for (const file of Array.from(files ?? [])) {
      if (next.length >= MAX_PHOTOS) {
        setError(`Up to ${MAX_PHOTOS} photos at a time.`);
        break;
      }
      if (!allowed.includes(file.type)) {
        setError("Use JPEG, PNG or WebP photos.");
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError("Each photo must be under 2 MB.");
        continue;
      }
      next.push({
        id: crypto.randomUUID(),
        url: URL.createObjectURL(file),
        file,
      });
    }
    setPhotos(next);
  }
  function remove(id: string) {
    const p = photos.find((x) => x.id === id);
    if (p) URL.revokeObjectURL(p.url);
    setPhotos(photos.filter((x) => x.id !== id));
  }
  async function analyze() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/enrich-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: await Promise.all(
            photos.map(async (p) => ({
              mimeType: p.file.type,
              data: await toBase64(p.file),
            })),
          ),
          existing,
          ownPhotosConfirmed: true,
          adultConfirmed: true,
          processingConsent: true,
          mode: "demo",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Photo suggestions failed.");
      const suggestions = (data.suggestions as unknown[]).map((s) =>
        suggestionSchema.parse(s),
      );
      onSuggestions(
        suggestions,
        `${suggestions.length} photo suggestion${suggestions.length === 1 ? "" : "s"} to confirm. Your photos were not stored.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo suggestions failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="photo-picker">
      <div className="field-label">
        <Camera size={14} /> Photos of your own activities{" "}
        <small>(optional)</small>
      </div>
      <p className="fine-print">
        {enabled
          ? "Piper can suggest ordinary activities it sees (like hiking or a guitar) for you to confirm. It never judges looks or infers anything personal. Photos are processed once and not stored."
          : "Photo analysis is off on this server: the free-tier Gemini setup isn’t suitable for personal photos. You can still preview photos here; they never leave this device."}
      </p>
      <input
        type="file"
        accept={allowed.join(",")}
        multiple
        aria-label="Choose photos of your own activities"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      {!!photos.length && (
        <div className="photo-thumbs">
          {photos.map((p) => (
            <figure key={p.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt="Your photo (preview, stays on this device)"
              />
              <figcaption>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => remove(p.id)}
                >
                  <X size={11} /> Remove
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {enabled && !!photos.length && (
        <>
          <label className="check-label">
            <input
              type="checkbox"
              checked={own}
              onChange={(e) => setOwn(e.target.checked)}
            />
            These are my own photos, I’m an adult, and I consent to sending them
            to Gemini once for suggestions.
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={!own || busy}
            onClick={() => void analyze()}
          >
            {busy ? (
              <LoaderCircle className="spin" size={14} />
            ) : (
              <Camera size={14} />
            )}
            Suggest from my photos
          </Button>
        </>
      )}
      {!enabled && !!photos.length && (
        <small className="muted">
          <ImageOff size={12} /> Not analyzed. Remove them any time.
        </small>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </div>
  );
}
