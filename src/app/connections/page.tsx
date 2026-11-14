import { Connections } from "@/components/connections";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const p = await searchParams;
  return <Connections initialId={p.with} />;
}
