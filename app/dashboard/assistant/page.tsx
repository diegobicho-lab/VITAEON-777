import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AssistantDashboardClient } from "@/components/platform/AssistantDashboard";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Panel de asistente | VITAEON",
  robots: { index: false, follow: false }
};

export default async function AssistantDashboardPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ASSISTANT") {
    redirect("/?auth=required");
  }

  return <AssistantDashboardClient />;
}
