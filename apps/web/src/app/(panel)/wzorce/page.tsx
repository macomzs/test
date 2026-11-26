import { offerTemplates, products } from "@app/db";
import { hasPermission } from "@app/domain";
import { asc, count, eq } from "drizzle-orm";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyRow, Table, Td, Th } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";
import { CreateTemplateForm } from "./forms";

export const metadata = { title: "Wzorce ofert" };

export default async function TemplatesPage() {
  const user = await requirePermission("templates.read");
  const db = getDb();
  const rows = await db
    .select({ t: offerTemplates, used: count(products.id) })
    .from(offerTemplates)
    .leftJoin(products, eq(products.templateId, offerTemplates.id))
    .groupBy(offerTemplates.id)
    .orderBy(asc(offerTemplates.name));

  return (
    <>
      <PageHeader
        title="Wzorce ofert"
        description="Wzorzec to szablon treści oferty po polsku: tytuł, punkty korzyści, opis, zawartość zestawu i bezpieczeństwo. Zmienne typu {{wymiary}} są uzupełniane danymi produktu."
      />
      {hasPermission(user.permissions, "templates.write") ? (
        <Card className="mb-6"><CardBody><CreateTemplateForm /></CardBody></Card>
      ) : null}
      <Card>
        <CardHeader title="Wzorce" />
        <Table>
          <thead><tr><Th>Nazwa</Th><Th>Opis</Th><Th className="text-right">Produkty</Th><Th>Zmieniono</Th></tr></thead>
          <tbody>
            {rows.length === 0 ? <EmptyRow colSpan={4}>Brak wzorców. Utwórz pierwszy, np. „Kabiny prysznicowe”.</EmptyRow> : null}
            {rows.map(({ t, used }) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <Td><Link href={`/wzorce/${t.id}`} className="font-medium text-brand-700 hover:underline">{t.name}</Link></Td>
                <Td className="text-slate-600">{t.description}</Td>
                <Td className="text-right">{used}</Td>
                <Td className="text-slate-500">{formatDateTime(t.updatedAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
