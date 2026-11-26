"use client";

import { SECTION_HINTS, SECTION_LABELS, SECTION_TYPES, TEMPLATE_VARIABLES, type SectionType } from "@app/domain";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { Field, Input, Textarea } from "@/components/ui/form";
import { createTemplateAction, updateTemplateAction } from "./actions";

export function CreateTemplateForm() {
  const [state, action] = useActionState(createTemplateAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-72 flex-1"><Field label="Nazwa nowego wzorca" htmlFor="name"><Input id="name" name="name" placeholder="np. Kabiny prysznicowe" required /></Field></div>
      <div className="min-w-72 flex-1"><Field label="Opis (opcjonalnie)" htmlFor="description"><Input id="description" name="description" /></Field></div>
      <SubmitButton>Utwórz wzorzec</SubmitButton>
      <div className="w-full"><FormMessage state={state} /></div>
    </form>
  );
}

export function EditTemplateForm({
  template,
  sections,
  canWrite,
}: {
  template: { id: string; name: string; description: string };
  sections: Partial<Record<SectionType, string>>;
  canWrite: boolean;
}) {
  const [state, action] = useActionState(updateTemplateAction, undefined);
  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={template.id} />
      <fieldset disabled={!canWrite} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nazwa wzorca" htmlFor="name"><Input id="name" name="name" defaultValue={template.name} required /></Field>
          <Field label="Opis" htmlFor="description"><Input id="description" name="description" defaultValue={template.description} /></Field>
        </div>
        {SECTION_TYPES.map((type) => (
          <Field key={type} label={SECTION_LABELS[type]} htmlFor={`section_${type}`} hint={SECTION_HINTS[type]}>
            <Textarea
              id={`section_${type}`}
              name={`section_${type}`}
              defaultValue={sections[type] ?? ""}
              className={type === "TITLE" ? "min-h-12 font-sans" : "min-h-28 font-sans"}
            />
          </Field>
        ))}
      </fieldset>
      {canWrite ? <SubmitButton>Zapisz wzorzec</SubmitButton> : null}
    </form>
  );
}

export function VariablesHelp() {
  return (
    <ul className="space-y-1 text-sm">
      {Object.entries(TEMPLATE_VARIABLES).map(([k, v]) => (
        <li key={k}>
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{`{{${k}}}`}</code> <span className="text-slate-600">– {v}</span>
        </li>
      ))}
    </ul>
  );
}
