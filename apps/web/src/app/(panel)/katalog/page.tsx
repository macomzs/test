import { productImages, products } from "@app/db";
import { hasPermission } from "@app/domain";
import { and, asc, count, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { ImageOff, Layers } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { EmptyRow, Table, Td, Th } from "@/components/ui/table";
import { formatMoney, PRODUCT_STATUS_LABELS, PRODUCT_STATUS_TONES } from "@/lib/catalog";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";

export const metadata = { title: "Katalog produktów" };
const PAGE_SIZE = 50;

type Status = keyof typeof PRODUCT_STATUS_LABELS;

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; strona?: string }> }) {
  const user = await requirePermission("catalog.read");
  const canWrite = hasPermission(user.permissions, "catalog.write");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = (Object.keys(PRODUCT_STATUS_LABELS) as Status[]).includes(sp.status as Status) ? (sp.status as Status) : undefined;
  const page = Math.max(1, Number(sp.strona) || 1);
  const db = getDb();

  // Na liście pokazujemy produkty główne i proste; warianty – pod swoim produktem głównym.
  // Przy wyszukiwaniu trafienie w wariant pokazuje jego produkt główny.
  const filters: SQL[] = [isNull(products.parentId)];
  if (status) filters.push(eq(products.status, status));
  if (q) {
    const term = `%${q.replace(/[%_]/g, "")}%`;
    const match = or(ilike(products.name, term), ilike(products.ean, term), ilike(products.sku, term))!;
    filters.push(
      or(match, sql`exists (select 1 from products v where v.parent_id = ${products.id} and (v.name ilike ${term} or v.ean ilike ${term} or v.sku ilike ${term}))`)!,
    );
  }
  const where = and(...filters);

  const [rows, [total]] = await Promise.all([
    db.select().from(products).where(where).orderBy(asc(products.name)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(products).where(where),
  ]);
  const ids = rows.map((r) => r.id);
  const [variants, images] = await Promise.all([
    ids.length ? db.select().from(products).where(inArray(products.parentId, ids)).orderBy(asc(products.variantLabel)) : [],
    ids.length
      ? db.selectDistinctOn([productImages.productId], { productId: productImages.productId, url: productImages.url }).from(productImages).where(inArray(productImages.productId, ids)).orderBy(productImages.productId, asc(productImages.position))
      : [],
  ]);
  const variantsByParent = new Map<string, typeof variants>();
  for (const v of variants) variantsByParent.set(v.parentId!, [...(variantsByParent.get(v.parentId!) ?? []), v]);
  const imageBy = new Map(images.map((i) => [i.productId, i.url]));
  const pages = Math.max(1, Math.ceil((total?.n ?? 0) / PAGE_SIZE));
  const qs = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), strona: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Katalog produktów"
        description="Produkty główne, warianty, ceny i zdjęcia. Warianty dziedziczą brakujące dane z produktu głównego."
        actions={canWrite ? <ButtonLink href="/katalog/import">Importuj z feedu XML</ButtonLink> : null}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" placeholder="Szukaj: nazwa, EAN lub SKU" defaultValue={q} className="w-80" />
        <Select name="status" defaultValue={status ?? ""} className="w-48">
          <option value="">Wszystkie statusy</option>
          {Object.entries(PRODUCT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Button type="submit" variant="secondary">Szukaj</Button>
        {q || status ? <ButtonLink href="/katalog" variant="ghost">Wyczyść</ButtonLink> : null}
      </form>
      <Card>
        <Table>
          <thead>
            <tr><Th className="w-16"></Th><Th>Nazwa</Th><Th>EAN</Th><Th>SKU</Th><Th className="text-right">Cena bazowa</Th><Th className="text-right">Stan</Th><Th>Status</Th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={7}>
                {q || status ? "Brak produktów spełniających kryteria." : <>Katalog jest pusty. {canWrite ? <Link href="/katalog/import" className="text-brand-700 underline">Zaimportuj produkty z feedu XML</Link> : null}</>}
              </EmptyRow>
            ) : null}
            {rows.map((p) => {
              const vs = variantsByParent.get(p.id) ?? [];
              return [
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td><Thumb url={imageBy.get(p.id)} /></Td>
                  <Td>
                    <Link href={`/katalog/${p.id}`} className="font-medium text-brand-700 hover:underline">{p.name}</Link>
                    {p.kind === "PARENT" ? <span className="ml-2 inline-flex items-center gap-1 text-xs text-slate-500"><Layers className="size-3" aria-hidden />{vs.length} warianty</span> : null}
                  </Td>
                  <Td className="font-mono text-xs">{p.ean ?? "—"}</Td>
                  <Td className="font-mono text-xs">{p.sku ?? <span className="text-amber-700">brak</span>}</Td>
                  <Td className="text-right whitespace-nowrap">{p.kind === "PARENT" && p.basePrice ? <span className="text-slate-500">od </span> : null}{formatMoney(p.basePrice, p.currency)}</Td>
                  <Td className="text-right">{p.kind === "PARENT" ? "" : (p.stockQty ?? "—")}</Td>
                  <Td><Badge tone={PRODUCT_STATUS_TONES[p.status]}>{PRODUCT_STATUS_LABELS[p.status]}</Badge></Td>
                </tr>,
                ...vs.map((v) => (
                  <tr key={v.id} className="bg-slate-50/50 hover:bg-slate-50">
                    <Td></Td>
                    <Td className="pl-8"><Link href={`/katalog/${v.id}`} className="text-brand-700 hover:underline">↳ {v.variantLabel ?? v.name}</Link></Td>
                    <Td className="font-mono text-xs">{v.ean ?? "—"}</Td>
                    <Td className="font-mono text-xs">{v.sku ?? <span className="text-amber-700">brak</span>}</Td>
                    <Td className="text-right whitespace-nowrap">{formatMoney(v.basePrice ?? p.basePrice, v.currency)}</Td>
                    <Td className="text-right">{v.stockQty ?? "—"}</Td>
                    <Td><Badge tone={PRODUCT_STATUS_TONES[v.status]}>{PRODUCT_STATUS_LABELS[v.status]}</Badge></Td>
                  </tr>
                )),
              ];
            })}
          </tbody>
        </Table>
      </Card>
      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>Pozycji: {total?.n ?? 0}</span>
        <div className="flex items-center gap-2">
          {page > 1 ? <Link className="hover:underline" href={qs(page - 1)}>← Poprzednia</Link> : null}
          <span>Strona {page} z {pages}</span>
          {page < pages ? <Link className="hover:underline" href={qs(page + 1)}>Następna →</Link> : null}
        </div>
      </div>
    </>
  );
}

function Thumb({ url }: { url?: string }) {
  if (!url) return <div className="flex size-12 items-center justify-center rounded border border-slate-200 bg-slate-50"><ImageOff className="size-4 text-slate-400" aria-label="Brak zdjęcia" /></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" className="size-12 rounded border border-slate-200 bg-white object-contain" />;
}
