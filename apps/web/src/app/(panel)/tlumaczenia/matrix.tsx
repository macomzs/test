"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, Td, Th } from "@/components/ui/table";
import { STATUS_TONES, TRANSLATION_STATUS_LABELS } from "@/lib/translations";
import { BulkTranslate } from "./bulk-form";

export interface MatrixCell {
  status: "AI_DRAFT" | "PENDING_REVIEW" | "APPROVED" | null;
  jobState: "QUEUED" | "RUNNING" | "FAILED" | "DONE" | null;
  jobError: string | null;
  stale: boolean;
  warnings: number;
}

export interface MatrixRow {
  id: string;
  name: string;
  ean: string | null;
  templateName: string;
  cells: Record<string, MatrixCell>;
}

function Cell({ cell }: { cell: MatrixCell | undefined }) {
  if (!cell) return <span className="text-slate-300">—</span>;
  if (cell.jobState === "QUEUED") return <Badge>W kolejce…</Badge>;
  if (cell.jobState === "RUNNING") return <Badge tone="info">Tłumaczę…</Badge>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {cell.jobState === "FAILED" ? <span title={cell.jobError ?? ""}><Badge tone="danger">Błąd AI</Badge></span> : null}
      {cell.status ? <Badge tone={STATUS_TONES[cell.status]}>{TRANSLATION_STATUS_LABELS[cell.status]}</Badge> : null}
      {cell.stale ? <Badge tone="danger">nieaktualne</Badge> : null}
      {cell.warnings ? <span className="text-xs text-amber-700" title="Ostrzeżenia jakości">⚠ {cell.warnings}</span> : null}
    </span>
  );
}

export function TranslationMatrix({ rows, languages, canWrite }: { rows: MatrixRow[]; languages: { code: string; name: string }[]; canWrite: boolean }) {
  return (
    <BulkTranslate languages={languages} productIds={rows.map((r) => r.id)} canWrite={canWrite}>
      {({ selected, toggle }) => (
        <div className="rounded-lg border border-slate-200 bg-white">
          <Table>
            <thead>
              <tr>
                {canWrite ? <Th className="w-10"></Th> : null}
                <Th>Produkt</Th>
                {languages.map((l) => <Th key={l.code} title={l.name}>{l.code.toUpperCase()}</Th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? <EmptyRow colSpan={languages.length + 2}>Brak produktów z przypisanym wzorcem oferty. Przypisz wzorzec na karcie produktu → „Treść oferty”.</EmptyRow> : null}
              {rows.map((r) => (
                <tr key={r.id} className={selected.has(r.id) ? "bg-brand-50" : "hover:bg-slate-50"}>
                  {canWrite ? (
                    <Td><input type="checkbox" aria-label={`Zaznacz ${r.name}`} className="size-4 accent-brand-600" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></Td>
                  ) : null}
                  <Td>
                    <span className="font-medium">{r.name}</span>
                    <span className="block text-xs text-slate-500">{r.ean ?? ""} · wzorzec: {r.templateName}</span>
                  </Td>
                  {languages.map((l) => (
                    <Td key={l.code}>
                      <Link href={`/tlumaczenia/${r.id}/${l.code}`} className="block rounded p-1 hover:bg-slate-100" aria-label={`${r.name} – ${l.name}`}>
                        <Cell cell={r.cells[l.code]} />
                      </Link>
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </BulkTranslate>
  );
}
