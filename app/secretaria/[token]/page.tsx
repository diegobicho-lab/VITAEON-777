import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { SecretaryPortalClient } from "@/components/platform/SecretaryPortal";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;

  const link = await prisma.doctorSecretaryLink.findUnique({
    where: { token },
    select: {
      isActive: true,
      doctor: { select: { fullName: true } }
    }
  });

  if (!link?.isActive) {
    return { title: "Enlace no válido · VITAEON" };
  }

  return {
    title: `Secretaría · ${link.doctor.fullName} · VITAEON`,
    robots: { index: false, follow: false }
  };
}

export default async function SecretaryPage({ params }: Props) {
  const { token } = await params;

  const link = await prisma.doctorSecretaryLink.findUnique({
    where: { token },
    select: {
      isActive: true,
      doctor: { select: { fullName: true } }
    }
  });

  if (!link || !link.isActive) {
    notFound();
  }

  return (
    <SecretaryPortalClient
      token={token}
      doctorName={link.doctor.fullName}
    />
  );
}
