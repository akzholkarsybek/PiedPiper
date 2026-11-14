"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="global-error">
      <h1>A little pause.</h1>
      <p>Something didn’t load as expected. Please try again.</p>
      <div className="inline-actions" style={{ justifyContent: "center" }}>
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </main>
  );
}
