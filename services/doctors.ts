import "server-only";
import { prisma } from "@/lib/db/prisma";

export async function listVerifiedDoctors(filters: { specialtyId?: string; hospitalId?: string; city?: string; query?: string }) {
  return prisma.doctor.findMany({
    where: {
      verificationStatus: "VERIFIED",
      ...(filters.specialtyId ? { specialtyId: filters.specialtyId } : {}),
      ...(filters.hospitalId ? { hospitalId: filters.hospitalId } : {}),
      ...(filters.city ? { hospital: { city: filters.city } } : {}),
      ...(filters.query
        ? {
            OR: [
              { fullName: { contains: filters.query, mode: "insensitive" } },
              { subSpecialty: { contains: filters.query, mode: "insensitive" } }
            ]
          }
        : {})
    },
    include: { specialty: true, hospital: true },
    orderBy: [{ rating: "desc" }, { fullName: "asc" }]
  });
}
