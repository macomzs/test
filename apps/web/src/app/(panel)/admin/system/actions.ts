"use server";

import { writeAudit } from "@app/platform";
import { getQueue, QUEUES } from "@app/platform/queue";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/auth";
import type { ActionState } from "@/server/action-state";
import { getDb } from "@/server/db";

export async function sendPingAction(): Promise<ActionState> {
  const user = await requirePermission("system.manage");
  const boss = await getQueue();
  const jobId = await boss.send(QUEUES.systemPing, { requestedBy: user.email });
  await writeAudit(getDb(), { actorId: user.id, action: "system.ping.requested", entityType: "job", entityId: jobId ?? undefined });
  revalidatePath("/admin/system");
  return { success: "Zadanie testowe dodane do kolejki. Odśwież stronę za kilka sekund, aby zobaczyć wynik." };
}
