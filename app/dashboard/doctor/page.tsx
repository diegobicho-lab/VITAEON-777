import { MedicalMedal } from "@prisma/client";
import { redirect } from "next/navigation";
import { DoctorDashboardClient } from "@/components/platform/DashboardClients";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function DoctorDashboardPage() {
  const user = await getCurrentUser();
  if (user?.role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: user.id },
      select: { medal: true }
    });

    if (doctor?.medal === MedicalMedal.obsidiana) {
      redirect("/dashboard/obsidiana");
    }
  }

  return <DoctorDashboardClient />;
}
