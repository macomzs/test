import { productImages, products } from "@app/db";
import { hasPermission, resolveInherited } from "@app/domain";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, ImageOff } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { formatMoney, PRODUCT_KIND_LABELS, PRODUCT_STATUS_LABELS, PRODUCT_STATUS_TONES } from "@/lib/catalog";
import { formatDateTime } from "@/lib/format";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";
import { ProductForm, type InheritedHints } from "./product-form";

export const metadata = { title: "Produkt" };

const cm = (mm: number | null) => (mm === null ? "" : String(mm / 10).replace(".", ","));
const kg = (g: number | null) => (g === null ? "" : String(g / 1000).replace(".", ","));
const price = (p: string | null) => (p === null ? "" : p.replace(".", ","));

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("catalog.read");
  const canWrite = hasPermission(user.permissions, "catalog.write");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = getDb();
  const [product] = await db.select().from(products).where(eq(products.id, id));
  if (!product) notFound();

  const [images, parent, variants] = await Promise.all([
    db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.position)),
    product.parentId ? db.select().from(products).where(eq(products.id, product.parentId)).then((r) => r[0]) : undefined,
    product.kind === "PARENT" ? db.select().from(products).where(eq(products.parentId, id)).orderBy(asc(products.variantLabel)) : [],
  ]);

  const { inherited } = resolveInherited(product, parent);
  const hints: InheritedHints = parent
    ? {
        brand: parent.brand ?? undefined,
        basePrice: parent.basePrice ? price(parent.basePrice) : undefined,
        costPrice: parent.costPrice ? price(parent.costPrice) : undefined,
        lengthCm: cm(parent.lengthMm) || undefined,
        widthCm: cm(parent.widthMm) || undefined,
        heightCm: cm(parent.heightMm) || undefined,
        weightKg: kg(parent.weightG) || undefined,
        materials: parent.materials ?? undefined,
      }
    : {};
  const source = product.sourceData as { title?: string; price?: string; stock?: number; importedAt?: string } | null;

  return (
    <>
      <Link href="/katalog" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="size-4" aria-hidden />Katalog</Link>
      <PageHeader
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={PRODUCT_STATUS_TONES[product.status]}>{PRODUCT_STATUS_LABELS[product.status]}</Badge>
            <span>{PRODUCT_KIND_LABELS[product.kind]}</span>
            {parent ? <span>· wariant produktu <Link className="text-brand-700 hover:underline" href={`/katalog/${parent.id}`}>{parent.name}</Link></span> : null}
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Dane produktu" description={inherited.length ? `Pola dziedziczone z produktu głównego: ${inherited.length}` : undefined} />
          <CardBody>
            <ProductForm
              canWrite={canWrite}
              inherited={hints}
              values={{
                id: product.id,
                kind: product.kind,
                name: product.name,
                variantLabel: product.variantLabel ?? "",
                sku: product.sku ?? "",
                ean: product.ean ?? "",
                brand: product.brand ?? "",
                status: product.status,
                materials: product.materials ?? "",
                basePrice: price(product.basePrice),
                costPrice: price(product.costPrice),
                lengthCm: cm(product.lengthMm),
                widthCm: cm(product.widthMm),
                heightCm: cm(product.heightMm),
                weightKg: kg(product.weightG),
              }}
            />
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Zdjęcia" />
            <CardBody>
              {images.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-sm text-slate-500"><ImageOff className="size-6" aria-hidden />Brak zdjęć</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {images.map((img) => (
                    <a key={img.id} href={img.url} target="_blank" rel="noreferrer" className="block rounded border border-slate-200 bg-white p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.alt ?? ""} className="aspect-square w-full object-contain" />
                    </a>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500">Dodawanie i kolejność zdjęć oraz dokumenty PDF (GPSR) – w kolejnym kroku Etapu 2.</p>
            </CardBody>
          </Card>

          {product.kind !== "PARENT" ? (
            <Card>
              <CardHeader title="Stan magazynowy" />
              <CardBody className="text-sm">
                <p className="text-2xl font-semibold">{product.stockQty ?? "—"} <span className="text-sm font-normal text-slate-500">szt.</span></p>
                <p className="text-slate-500">Aktualizacja: {formatDateTime(product.stockUpdatedAt)}</p>
              </CardBody>
            </Card>
          ) : null}

          {source ? (
            <Card>
              <CardHeader title="Dane z feedu" description="Ostatnie wartości otrzymane podczas importu." />
              <CardBody className="space-y-1 text-sm">
                <p><span className="text-slate-500">Nazwa:</span> {source.title}</p>
                <p><span className="text-slate-500">Cena:</span> {formatMoney(source.price ?? null)}</p>
                <p><span className="text-slate-500">Stan:</span> {source.stock ?? "—"}</p>
                <p><span className="text-slate-500">Import:</span> {formatDateTime(source.importedAt ?? null)}</p>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      {product.kind === "PARENT" ? (
        <Card className="mt-6">
          <CardHeader title={`Warianty (${variants.length})`} description="Puste pola wariantu przyjmują wartości z produktu głównego." />
          <Table>
            <thead><tr><Th>Wariant</Th><Th>EAN</Th><Th>SKU</Th><Th className="text-right">Cena</Th><Th className="text-right">Stan</Th><Th>Status</Th></tr></thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <Td><Link href={`/katalog/${v.id}`} className="font-medium text-brand-700 hover:underline">{v.variantLabel ?? v.name}</Link></Td>
                  <Td className="font-mono text-xs">{v.ean ?? "—"}</Td>
                  <Td className="font-mono text-xs">{v.sku ?? <span className="text-amber-700">brak</span>}</Td>
                  <Td className="text-right">{formatMoney(v.basePrice ?? product.basePrice)}</Td>
                  <Td className="text-right">{v.stockQty ?? "—"}</Td>
                  <Td><Badge tone={PRODUCT_STATUS_TONES[v.status]}>{PRODUCT_STATUS_LABELS[v.status]}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
    </>
  );
}
