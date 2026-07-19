import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type LogAdminActionInput = {
  action: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

/**
 * Records a destructive/financial admin action. Pass a `tx` when the log
 * entry must commit atomically with the mutation it's recording (e.g. inside
 * the same transaction as a delete or a manual journal entry); omit it for
 * actions that aren't already transactional.
 */
export async function logAdminAction(
  input: LogAdminActionInput,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma;
  await client.adminAuditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
