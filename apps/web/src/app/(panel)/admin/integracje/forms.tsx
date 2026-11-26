"use client";

import { useActionState, useState, useTransition } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import type { ActionState } from "@/server/action-state";
import { saveAiSettingsAction, testAiAction } from "./actions";

export function AiSettingsForm({ provider, model, apiKeyMasked }: { provider: string; model: string; apiKeyMasked: string | null }) {
  const [state, action] = useActionState(saveAiSettingsAction, undefined);
  const [test, setTest] = useState<ActionState>(undefined);
  const [testing, start] = useTransition();
  return (
    <div className="space-y-4">
      <form action={action} className="max-w-xl space-y-4">
        <FormMessage state={state} />
        <Field label="Tryb tłumaczeń" htmlFor="provider">
          <Select id="provider" name="provider" defaultValue={provider}>
            <option value="mock">Tryb testowy (bez AI, znacznik języka)</option>
            <option value="claude">Claude (Anthropic API)</option>
          </Select>
        </Field>
        <Field label="Model" htmlFor="model" hint="Domyślnie claude-opus-5-5.">
          <Input id="model" name="model" defaultValue={model} className="font-mono" />
        </Field>
        <Field label="Klucz API Anthropic" htmlFor="apiKey" hint={apiKeyMasked ? `Zapisany klucz: ${apiKeyMasked}. Pozostaw puste, aby go nie zmieniać.` : "Utworzysz go na platform.claude.com → API Keys. Klucz jest zapisywany w postaci zaszyfrowanej."}>
          <Input id="apiKey" name="apiKey" type="password" autoComplete="off" placeholder={apiKeyMasked ?? "sk-ant-…"} />
        </Field>
        <SubmitButton>Zapisz</SubmitButton>
      </form>
      <div className="space-y-2 border-t border-slate-200 pt-4">
        <FormMessage state={test} />
        <Button type="button" variant="secondary" disabled={testing} onClick={() => start(async () => setTest(await testAiAction()))}>
          {testing ? "Testowanie…" : "Testuj połączenie (krótkie tłumaczenie)"}
        </Button>
      </div>
    </div>
  );
}
