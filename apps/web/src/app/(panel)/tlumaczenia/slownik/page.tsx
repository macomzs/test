import { glossaryTerms, languages } from "@app/db";
import { hasPermission } from "@app/domain";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyRow, Table, Td, Th } from "@/components/ui/table";
import { requirePermission } from "@/server/auth";
import { getDb } from "@/server/db";
import { deleteGlossaryTermAction } from "../actions";
import { GlossaryForm } from "./glossary-form";

export const metadata = { title: "Słownik terminologii" };

const RULE_LABELS = { DO_NOT_TRANSLATE: "Nie tłumacz", FORCE: "Wymuś", FORBIDDEN: "Zakazane" } as const;
const RULE_TONES = { DO_NOT_TRANSLATE: "info", FORCE: "success", FORBIDDEN: "danger" } as const;

export default async function GlossaryPage() {
  const user = await requirePermission("translations.read");
  const canWrite = hasPermission(user.permissions, "translations.write");
  const db = getDb();
  const [terms, langs] = await Promise.all([
    db.select().from(glossaryTerms).orderBy(asc(glossaryTerms.rule), asc(glossaryTerms.sourceTerm)),
    db.select().from(languages).where(eq(languages.isSource, false)).orderBy(asc(languages.position)),
  ]);
  const langName = new Map(langs.map((l) => [l.code, l.name]));

  return (
    <>
      <Link href="/tlumaczenia" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="size-4" aria-hidden />Tłumaczenia</Link>
      <PageHeader title="Słownik terminologii" description="Reguły stosowane przy każdym tłumaczeniu AI i sprawdzane po tłumaczeniu (ostrzeżenia w edytorze)." />
      {canWrite ? <Card className="mb-6"><CardHeader title="Nowy termin" /><CardBody><GlossaryForm languages={langs.map((l) => ({ code: l.code, name: l.name }))} /></CardBody></Card> : null}
      <Card>
        <Table>
          <thead><tr><Th>Reguła</Th><Th>Termin</Th><Th>Język</Th><Th>Tłumaczenie / słowo</Th><Th>Notatka</Th>{canWrite ? <Th></Th> : null}</tr></thead>
          <tbody>
            {terms.length === 0 ? <EmptyRow colSpan={6}>Słownik jest pusty. Zacznij od marki i nazw serii produktów (reguła „Nie tłumacz”).</EmptyRow> : null}
            {terms.map((t) => (
              <tr key={t.id}>
                <Td><Badge tone={RULE_TONES[t.rule]}>{RULE_LABELS[t.rule]}</Badge></Td>
                <Td className="font-medium">{t.sourceTerm}{t.caseSensitive ? <span className="ml-1 text-xs text-slate-400" title="Rozróżnia wielkość liter">Aa</span> : null}</Td>
                <Td>{t.locale ? langName.get(t.locale) ?? t.locale : "Wszystkie"}</Td>
                <Td>{t.rule === "DO_NOT_TRANSLATE" ? "—" : t.targetTerm}</Td>
                <Td className="text-slate-500">{t.note}</Td>
                {canWrite ? (
                  <Td className="text-right">
                    <form action={deleteGlossaryTermAction}><input type="hidden" name="id" value={t.id} /><Button type="submit" size="sm" variant="ghost">Usuń</Button></form>
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
