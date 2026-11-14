import type { Metadata } from "next";
import { AgentConversations } from "@/components/agents";
export const metadata: Metadata = { title: "Agent Conversations" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const p = await searchParams;
  return <AgentConversations initialId={p.with} />;
}
