import { prisma } from "@/lib/db/prisma";

type NotificationInput = {
  userId?: string | null;
  type: string;
  title: string;
  message: string;
};

export async function createNotification(input: NotificationInput) {
  if (!input.userId) return null;
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message
    }
  });
}

export async function createManyNotifications(inputs: NotificationInput[]) {
  const filtered = inputs.filter(
    (input): input is NotificationInput & { userId: string } => typeof input.userId === "string" && input.userId.length > 0
  );
  if (filtered.length === 0) return { count: 0 };
  return prisma.notification.createMany({
    data: filtered.map((input) => ({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message
    }))
  });
}
