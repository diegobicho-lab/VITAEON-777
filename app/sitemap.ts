import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/prisma";
import { publicDoctorWhere } from "@/lib/doctors/public-doctor-filter";
import { slugify } from "@/lib/seo/slug";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/aviso-de-privacidad",
    "/terminos",
    "/politica-cancelaciones",
    "/politica-reembolsos",
    "/consentimiento-datos",
    "/urgencias",
    "/soporte"
  ].map((path) => ({ url: `${baseUrl}${path}`, lastModified: new Date() }));

  if (process.env.npm_lifecycle_event === "build") return staticRoutes;

  try {
    const [specialties, doctors] = await Promise.all([
      prisma.specialty.findMany({
        select: {
          name: true,
          updatedAt: true,
          doctors: { where: publicDoctorWhere, select: { id: true }, take: 1 }
        }
      }),
      prisma.doctor.findMany({
        where: publicDoctorWhere,
        select: { slug: true, updatedAt: true }
      })
    ]);

    return [
      ...staticRoutes,
      ...specialties
        .filter((specialty) => specialty.doctors.length > 0)
        .map((specialty) => ({
          url: `${baseUrl}/especialidades/${slugify(specialty.name)}`,
          lastModified: specialty.updatedAt
        })),
      ...doctors.map((doctor) => ({
        url: `${baseUrl}/medicos/${doctor.slug}`,
        lastModified: doctor.updatedAt
      }))
    ];
  } catch {
    return staticRoutes;
  }
}
