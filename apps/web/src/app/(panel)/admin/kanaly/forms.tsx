"use client";

import type { CredentialField } from "@app/domain";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { Field, Input, Select } from "@/components/ui/form";
import { createChannelAccountAction, updateChannelAccountAction } from "./actions";

function CredentialInputs({ fields, masked }: { fields: CredentialField[]; masked?: Record<string, string> }) {
  return (
    <div className="space-y-4 rounded-md border border-dashed border-slate-300 p-4">
      <p className="text-sm text-slate-600">
        Poświadczenia są szyfrowane (AES-256-GCM) przed zapisem w bazie i nigdy nie są wyświetlane w całości.
        {masked ? " Pozostaw pole puste, aby nie zmieniać zapisanej wartości." : ""}
      </p>
      {fields.map((f) => (
        <Field key={f.key} label={f.label} htmlFor={`cred_${f.key}`} hint={masked?.[f.key] ? `Zapisano: ${masked[f.key]}` : f.hint}>
          <Input id={`cred_${f.key}`} name={`cred_${f.key}`} type={f.secret ? "password" : "text"} autoComplete="off" />
        </Field>
      ))}
    </div>
  );
}

export function CreateChannelAccountForm({ marketplaces }: { marketplaces: { id: string; name: string; fields: CredentialField[] }[] }) {
  const [state, action] = useActionState(createChannelAccountAction, undefined);
  const [selected, setSelected] = useState(marketplaces[0]?.id ?? "");
  const fields = marketplaces.find((m) => m.id === selected)?.fields ?? [];
  return (
    <form action={action} className="max-w-xl space-y-4">
      <FormMessage state={state} />
      <Field label="Marketplace" htmlFor="marketplaceId">
        <Select id="marketplaceId" name="marketplaceId" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {marketplaces.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </Field>
      <Field label="Nazwa konta" htmlFor="name" hint="Własna nazwa, np. „Allegro – sklep główny”.">
        <Input id="name" name="name" required defaultValue={state?.fields?.name} />
      </Field>
      <CredentialInputs key={selected} fields={fields} />
      <SubmitButton>Dodaj konto</SubmitButton>
    </form>
  );
}

export function EditChannelAccountForm({
  account,
  fields,
  masked,
}: {
  account: { id: string; name: string; status: string };
  fields: CredentialField[];
  masked: Record<string, string>;
}) {
  const [state, action] = useActionState(updateChannelAccountAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={account.id} />
      <Field label="Nazwa konta" htmlFor="name"><Input id="name" name="name" defaultValue={account.name} required /></Field>
      <Field label="Status" htmlFor="status">
        <Select id="status" name="status" defaultValue={account.status === "DISABLED" ? "DISABLED" : "ACTIVE"}>
          <option value="ACTIVE">Aktywne</option>
          <option value="DISABLED">Wyłączone</option>
        </Select>
      </Field>
      <CredentialInputs fields={fields} masked={masked} />
      <SubmitButton>Zapisz</SubmitButton>
    </form>
  );
}
