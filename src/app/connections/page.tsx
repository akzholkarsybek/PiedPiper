import { Connections } from "@/components/connections";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ with?: string; kind?: string }>;
}) {
  const p = await searchParams;
  return <Connections initialId={p.with} initialKind={p.kind} />;
}
