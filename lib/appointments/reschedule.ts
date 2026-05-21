import type { Prisma, PrismaClient } from "@prisma/client";

type TxClient = PrismaClient | Prisma.TransactionClient;

export async function findNextAvailableSlot(
  tx: TxClient,
  doctorId: string,
  fromDate = new Date()
) {
  return tx.availabilitySlot.findFirst({
    where: {
      doctorId,
      isActive: true,
      startsAt: { gte: fromDate },
      appointment: null
    },
    orderBy: { startsAt: "asc" }
  });
}
