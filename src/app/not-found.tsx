import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="global-error">
      <span className="eyebrow">404 · A SMALL DETOUR</span>
      <h1>
        This path doesn’t
        <br />
        lead to a <em>connection.</em>
      </h1>
      <p>Let’s take you somewhere with a little more possibility.</p>
      <Link className="button button-primary" href="/">
        Back to Pied Piper
      </Link>
    </main>
  );
}
