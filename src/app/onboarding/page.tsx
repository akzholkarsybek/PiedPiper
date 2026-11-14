import { Onboarding } from "@/components/onboarding";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const params = await searchParams;
  return <Onboarding demoEntry={params.demo === "1"} />;
}
