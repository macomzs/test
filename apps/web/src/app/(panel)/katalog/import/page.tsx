import { importRuns, importSources, users } from "@app/db";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyRow, Table, Td, Th } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";
import { ImportWizard } from "./import-wizard";

export const metadata = { title: "Import produktów" };

export default async function ImportPage() {
  await requirePermission("catalog.write");
  const db = getDb();
  const [[source], runs] = await Promise.all([
    db.select().from(importSources).orderBy(desc(importSources.lastRunAt)).limit(1),
    db
      .select({ run: importRuns, userName: users.name })
      .from(importRuns)
      .leftJoin(users, eq(users.id, importRuns.userId))
      .orderBy(desc(importRuns.startedAt))
      .limit(10),
  ]);

  return (
    <>
      <Link href="/katalog" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="size-4" aria-hidden />Katalog</Link>
      <PageHeader title="Import produktów z feedu XML" description="Pobierz feed, wybierz produkty i zaimportuj je do katalogu. Ponowny import aktualizuje ceny i stany." />
      <ImportWizard defaultUrl={source?.url ?? ""} />
      <Card className="mt-6">
        <CardHeader title="Historia importów" />
        <Table>
          <thead><tr><Th>Data</Th><Th>Kto</Th><Th className="text-right">Dodano</Th><Th className="text-right">Zaktualizowano</Th><Th className="text-right">Uwagi</Th></tr></thead>
          <tbody>
            {runs.length === 0 ? <EmptyRow colSpan={5}>Nie było jeszcze importów.</EmptyRow> : null}
            {runs.map(({ run, userName }) => (
              <tr key={run.id}>
                <Td>{formatDateTime(run.startedAt)}</Td>
                <Td>{userName ?? "System"}</Td>
                <Td className="text-right">{run.createdCount}</Td>
                <Td className="text-right">{run.updatedCount}</Td>
                <Td className="text-right">{run.issues.length}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
