"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { enqueueBulkAction } from "./actions";

/** Zaznaczanie produktów i języków + zlecenie tłumaczeń AI. Wiersze tabeli przekazuje serwer. */
export function BulkTranslate({
  languages,
  productIds,
  canWrite,
  children,
}: {
  languages: { code: string; name: string }[];
  productIds: string[];
  canWrite: boolean;
  children: (sel: { selected: Set<string>; toggle: (id: string) => void }) => ReactNode;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [locales, setLocales] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: string; errors: string[] } | null>(null);
  const [pending, start] = useTransition();

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleLocale = (c: string) =>
    setLocales((s) => {
      const n = new Set(s);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });

  const run = () =>
    start(async () => {
      const res = await enqueueBulkAction([...selected], [...locales]);
      setMsg({ ok: res.queued ? `Dodano do kolejki tłumaczeń: ${res.queued}.` : "", errors: res.errors });
      setSelected(new Set());
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {canWrite ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <Button type="button" size="sm" variant="secondary" onClick={() => setSelected(selected.size === productIds.length ? new Set() : new Set(productIds))}>
            {selected.size === productIds.length && productIds.length ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
          </Button>
          <span className="text-slate-500">Języki:</span>
          {languages.map((l) => (
            <label key={l.code} className="flex items-center gap-1">
              <input type="checkbox" className="size-4 accent-brand-600" checked={locales.has(l.code)} onChange={() => toggleLocale(l.code)} />
              {l.code.toUpperCase()}
            </label>
          ))}
          <Button type="button" size="sm" onClick={run} disabled={pending || !selected.size || !locales.size}>
            {pending ? "Zlecanie…" : `Przetłumacz AI (${selected.size} × ${locales.size})`}
          </Button>
        </div>
      ) : null}
      {msg?.ok ? <Alert tone="success">{msg.ok}</Alert> : null}
      {msg?.errors.length ? <Alert tone="warning"><ul className="list-disc pl-5">{msg.errors.map((e) => <li key={e}>{e}</li>)}</ul></Alert> : null}
      {children({ selected, toggle })}
    </div>
  );
}
