"use client";

import { SECTION_LABELS, SECTION_TYPES, type SectionType } from "@app/domain";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { Field, Select, Textarea } from "@/components/ui/form";
import { assignTemplateAction, saveOverridesAction } from "./actions";

export function AssignTemplateForm({ productId, current, templates, inheritedName }: { productId: string; current: string | null; templates: { id: string; name: string }[]; inheritedName: string | null }) {
  const [state, action] = useActionState(assignTemplateAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <input type="hidden" name="productId" value={productId} />
      <Field label="Wzorzec oferty" htmlFor="templateId" hint={inheritedName && !current ? `Wariant używa wzorca produktu głównego: „${inheritedName}”.` : undefined}>
        <Select id="templateId" name="templateId" defaultValue={current ?? ""}>
          <option value="">{inheritedName ? `— dziedziczony (${inheritedName}) —` : "— brak —"}</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </Field>
      <SubmitButton variant="secondary">Zapisz wzorzec</SubmitButton>
    </form>
  );
}

export function OverridesForm({ productId, marketplaceId, marketplaceName, overrides }: { productId: string; marketplaceId: string; marketplaceName: string; overrides: Partial<Record<SectionType, string>> }) {
  const [state, action] = useActionState(saveOverridesAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="marketplaceId" value={marketplaceId} />
      <p className="text-sm text-slate-600">Wpisz treść tylko w sekcjach, które mają być inne na {marketplaceName}. Puste pole = treść ze wzorca. Możesz używać zmiennych, np. {"{{wymiary}}"}. Treść piszesz po polsku – zostanie przetłumaczona na język rynku.</p>
      {SECTION_TYPES.map((t) => (
        <Field key={t} label={SECTION_LABELS[t]} htmlFor={`override_${t}`}>
          <Textarea id={`override_${t}`} name={`override_${t}`} defaultValue={overrides[t] ?? ""} className={t === "TITLE" ? "min-h-12 font-sans" : "min-h-20 font-sans"} />
        </Field>
      ))}
      <SubmitButton>Zapisz nadpisania dla {marketplaceName}</SubmitButton>
    </form>
  );
}
