import { getDb } from "@app/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Prosty test działania aplikacji i bazy – używany przez hosting do monitorowania. */
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
