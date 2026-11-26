"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { addGlossaryTermAction } from "../actions";

const RULES = {
  DO_NOT_TRANSLATE: { label: "Nie tłumacz (marka, nazwa własna, jednostka)", source: "Termin (np. Novoterm, Tomar)", target: null },
  FORCE: { label: "Wymuś tłumaczenie", source: "Termin po polsku (np. brodzik)", target: "Tłumaczenie (np. Duschwanne)" },
  FORBIDDEN: { label: "Zakazane słowo w języku docelowym", source: "Słowo, którego nie wolno użyć", target: null },
} as const;

export function GlossaryForm({ languages }: { languages: { code: string; name: string }[] }) {
  const [state, action] = useActionState(addGlossaryTermAction, undefined);
  const [rule, setRule] = useState<keyof typeof RULES>("DO_NOT_TRANSLATE");
  const cfg = RULES[rule];
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Reguła" htmlFor="rule">
          <Select id="rule" name="rule" value={rule} onChange={(e) => setRule(e.target.value as keyof typeof RULES)}>
            {Object.entries(RULES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </Field>
        <Field label="Język" htmlFor="locale" hint={rule === "DO_NOT_TRANSLATE" ? "Zwykle: wszystkie języki." : undefined}>
          <Select id="locale" name="locale" defaultValue="">
            {rule === "DO_NOT_TRANSLATE" ? <option value="">Wszystkie języki</option> : <option value="" disabled>Wybierz język</option>}
            {languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </Select>
        </Field>
        <Field label={cfg.source} htmlFor="sourceTerm"><Input id="sourceTerm" name="sourceTerm" required /></Field>
        {cfg.target ? <Field label={cfg.target} htmlFor="targetTerm"><Input id="targetTerm" name="targetTerm" required /></Field> : <div />}
        <Field label="Notatka (opcjonalnie)" htmlFor="note"><Input id="note" name="note" /></Field>
        <div className="pt-7"><Checkbox name="caseSensitive" label="Rozróżniaj wielkość liter" defaultChecked={rule === "DO_NOT_TRANSLATE"} /></div>
      </div>
      <SubmitButton>Dodaj do słownika</SubmitButton>
    </form>
  );
}
