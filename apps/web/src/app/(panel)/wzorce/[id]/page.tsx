import { offerTemplates, products, templateSections } from "@app/db";
import { hasPermission, SECTION_LABELS, SECTION_TYPES, type SectionType } from "@app/domain";
import { loadProductContext, renderBase } from "@app/services";
import { asc, eq, or, inArray } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";
import { deleteTemplateAction } from "../actions";
import { EditTemplateForm, VariablesHelp } from "../forms";
import { RenderedText } from "@/components/rendered-text";

export const metadata = { title: "Wzorzec oferty" };

export default async function TemplatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ produkt?: string }> }) {
  const user = await requirePermission("templates.read");
  const canWrite = hasPermission(user.permissions, "templates.write");
  const { id } = await params;
  const { produkt } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = getDb();
  const [template] = await db.select().from(offerTemplates).where(eq(offerTemplates.id, id));
  if (!template) notFound();
  const secs = await db.select().from(templateSections).where(eq(templateSections.templateId, id));
  const sections = Object.fromEntries(secs.map((s) => [s.type, s.content])) as Partial<Record<SectionType, string>>;

  // Produkty używające wzorca (bezpośrednio lub przez produkt główny) – do podglądu.
  const direct = await db.select({ id: products.id }).from(products).where(eq(products.templateId, id));
  const directIds = direct.map((d) => d.id);
  const usable = directIds.length
    ? await db
        .select({ id: products.id, name: products.name, kind: products.kind })
        .from(products)
        .where(or(inArray(products.id, directIds), inArray(products.parentId, directIds)))
        .orderBy(asc(products.name))
    : [];
  const previewable = usable.filter((p) => p.kind !== "PARENT");
  const previewId = previewable.find((p) => p.id === produkt)?.id ?? previewable[0]?.id;
  const ctx = previewId ? await loadProductContext(db, previewId) : null;
  const rendered = ctx ? renderBase(ctx) : {};

  return (
    <>
      <Link href="/wzorce" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="size-4" aria-hidden />Wzorce</Link>
      <PageHeader
        title={template.name}
        description={`Używany przez produktów: ${directIds.length} (wraz z ich wariantami: ${usable.length}).`}
        actions={
          canWrite ? (
            <form action={deleteTemplateAction}>
              <input type="hidden" name="id" value={template.id} />
              <Button variant="secondary" size="sm" type="submit">Usuń wzorzec</Button>
            </form>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Treść wzorca (PL)" />
          <CardBody><EditTemplateForm template={template} sections={sections} canWrite={canWrite} /></CardBody>
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Podgląd na produkcie" description="Po zapisaniu wzorca odśwież podgląd." />
            <CardBody className="space-y-4">
              {previewable.length === 0 ? (
                <Alert tone="info">Przypisz ten wzorzec do produktu (karta produktu → „Treść oferty”), aby zobaczyć podgląd.</Alert>
              ) : (
                <form className="flex gap-2">
                  <Select name="produkt" defaultValue={previewId}>
                    {previewable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                  <Button type="submit" variant="secondary">Pokaż</Button>
                </form>
              )}
              {SECTION_TYPES.filter((t) => rendered[t]).map((t) => (
                <div key={t}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{SECTION_LABELS[t]}</p>
                  <RenderedText type={t} result={rendered[t]!} />
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Dostępne zmienne" description="Wpisz w treści wzorca, np. {{wymiary}}." />
            <CardBody><VariablesHelp /></CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
