"use client";

import { ImageOff } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Table, Td, Th } from "@/components/ui/table";
import { formatMoney } from "@/lib/catalog";
import { importFeedAction, previewFeedAction, type ImportResult, type PreviewItem } from "./actions";

export function ImportWizard({ defaultUrl }: { defaultUrl: string }) {
  const [url, setUrl] = useState(defaultUrl);
  const [items, setItems] = useState<PreviewItem[] | null>(null);
  const [issues, setIssues] = useState<{ key: string; message: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [eanList, setEanList] = useState("");
  const [groupVariants, setGroupVariants] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, startLoading] = useTransition();
  const [importing, startImporting] = useTransition();

  const visible = useMemo(() => {
    if (!items) return [];
    const f = filter.trim().toLocaleLowerCase("pl");
    return f ? items.filter((i) => i.title.toLocaleLowerCase("pl").includes(f) || (i.ean ?? "").includes(f)) : items;
  }, [items, filter]);

  const load = () =>
    startLoading(async () => {
      setError(null);
      setResult(null);
      const res = await previewFeedAction(url);
      if (!res.ok) {
        setItems(null);
        setError(res.error);
        return;
      }
      setItems(res.items);
      setIssues(res.issues);
      setSelected(new Set());
    });

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selectVisible = (on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of visible) on ? next.add(i.key) : next.delete(i.key);
      return next;
    });

  const selectByList = () => {
    if (!items) return;
    const codes = new Set(eanList.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean));
    const known = new Set(items.map((i) => i.key));
    const missing = [...codes].filter((c) => !known.has(c));
    setSelected((prev) => new Set([...prev, ...[...codes].filter((c) => known.has(c))]));
    setError(missing.length ? `Nie znaleziono w feedzie kodów: ${missing.join(", ")}` : null);
  };

  const runImport = () =>
    startImporting(async () => {
      setError(null);
      const res = await importFeedAction(url, [...selected], groupVariants);
      setResult(res);
      if (res.ok) {
        const refreshed = await previewFeedAction(url);
        if (refreshed.ok) setItems(refreshed.items);
        setSelected(new Set());
      }
    });

  const selectedIssues = issues.filter((i) => selected.has(i.key));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="1. Źródło danych" description="Adres feedu XML z produktami. Obsługiwany format: <post> z polami Title, EAN, Stock, Price, Image." />
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="min-w-80 flex-1">
            <Field label="Adres URL feedu" htmlFor="url"><Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/produkty.xml" /></Field>
          </div>
          <Button type="button" onClick={load} disabled={loading || !url}>{loading ? "Pobieranie…" : items ? "Odśwież podgląd" : "Pobierz podgląd"}</Button>
        </CardBody>
      </Card>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {result?.ok === false ? <Alert tone="error">{result.error}</Alert> : null}
      {result?.ok ? (
        <Alert tone="success">
          <p className="font-medium">Import zakończony: dodano {result.created}, zaktualizowano {result.updated}{result.parentsCreated ? `, utworzono produktów głównych z wariantami: ${result.parentsCreated}` : ""}.</p>
          {result.issues.length ? <ul className="mt-2 list-disc pl-5">{result.issues.map((i, n) => <li key={n}>{i.message}</li>)}</ul> : null}
          <Link href="/katalog" className="mt-2 inline-block font-medium underline">Przejdź do katalogu →</Link>
        </Alert>
      ) : null}

      {items ? (
        <Card>
          <CardHeader
            title={`2. Wybierz produkty (${items.length} w feedzie, ${items.filter((i) => i.exists).length} już w katalogu)`}
            description="Zaznacz produkty na liście albo wklej listę kodów EAN."
          />
          <CardBody className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Field label="Filtruj listę" htmlFor="filter"><Input id="filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Nazwa lub EAN" /></Field>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => selectVisible(true)}>Zaznacz widoczne ({visible.length})</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => selectVisible(false)}>Odznacz widoczne</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Field label="Lub wklej kody EAN (każdy w nowej linii)" htmlFor="eanList"><Textarea id="eanList" value={eanList} onChange={(e) => setEanList(e.target.value)} className="min-h-20" /></Field>
                <Button type="button" size="sm" variant="secondary" onClick={selectByList} disabled={!eanList.trim()}>Zaznacz z listy</Button>
              </div>
            </div>
            <div className="max-h-[480px] overflow-y-auto rounded border border-slate-200">
              <Table>
                <thead className="sticky top-0"><tr><Th className="w-10"></Th><Th className="w-14"></Th><Th>Nazwa</Th><Th>EAN</Th><Th className="text-right">Cena</Th><Th className="text-right">Stan</Th><Th>W katalogu</Th></tr></thead>
                <tbody>
                  {visible.map((i) => (
                    <tr key={i.key} className={selected.has(i.key) ? "bg-brand-50" : "hover:bg-slate-50"} onClick={() => toggle(i.key)}>
                      <Td><input type="checkbox" aria-label={`Zaznacz ${i.title}`} checked={selected.has(i.key)} onChange={() => toggle(i.key)} onClick={(e) => e.stopPropagation()} className="size-4 accent-brand-600" /></Td>
                      <Td>
                        {i.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.image} alt="" loading="lazy" className="size-10 rounded border border-slate-200 bg-white object-contain" />
                        ) : <ImageOff className="size-4 text-slate-400" aria-label="Brak zdjęcia" />}
                      </Td>
                      <Td>{i.title}{i.variantBase ? <span className="block text-xs text-slate-500">wariant: {i.variantBase}</span> : null}</Td>
                      <Td className="font-mono text-xs">{i.ean}</Td>
                      <Td className="whitespace-nowrap text-right">{formatMoney(i.price)}</Td>
                      <Td className="text-right">{i.stock ?? "—"}</Td>
                      <Td>{i.exists ? <Badge tone="info">Tak – zaktualizuje</Badge> : <Badge>Nowy</Badge>}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {items ? (
        <Card>
          <CardHeader title="3. Import" />
          <CardBody className="space-y-4">
            <Checkbox
              checked={groupVariants}
              onChange={(e) => setGroupVariants(e.target.checked)}
              label="Łącz warianty po nazwie – „Kabina Tomar 90 (bez brodzika)” i „Kabina Tomar 90 (z brodzikiem)” staną się wariantami jednego produktu głównego"
            />
            {selectedIssues.length ? (
              <Alert tone="warning">
                <p className="font-medium">Uwagi do zaznaczonych produktów ({selectedIssues.length}):</p>
                <ul className="mt-1 list-disc pl-5">{selectedIssues.slice(0, 10).map((i, n) => <li key={n}>{i.message}</li>)}</ul>
              </Alert>
            ) : null}
            <p className="text-sm text-slate-600">Nowe produkty trafią do katalogu ze statusem „Szkic”. Istniejące: zaktualizowana zostanie cena i stan; nazwa tylko, jeśli nie była zmieniana ręcznie.</p>
            <Button type="button" onClick={runImport} disabled={importing || selected.size === 0}>{importing ? "Importowanie…" : `Importuj zaznaczone (${selected.size})`}</Button>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
