import { MedicalMedal } from "@prisma/client";
import { redirect } from "next/navigation";
import { ObsidianDashboardClient } from "@/components/platform/DashboardClients";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function ObsidianDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=required");

  if (user.role === "PATIENT") redirect("/dashboard/patient");
  if (user.role === "ADMIN" || user.role === "STAFF") redirect("/dashboard/admin");
  if (user.role !== "DOCTOR") redirect("/");

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { medal: true }
  });

  if (doctor?.medal !== MedicalMedal.obsidiana) {
    redirect("/dashboard/doctor");
  }

  return <ObsidianDashboardClient />;
}
