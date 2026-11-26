"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/form";
import { changePasswordAction } from "./actions";

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="max-w-md space-y-4">
      <FormMessage state={state} />
      <Field label="Obecne hasło" htmlFor="current"><Input id="current" name="current" type="password" autoComplete="current-password" required /></Field>
      <Field label="Nowe hasło" htmlFor="next" hint="Min. 10 znaków."><Input id="next" name="next" type="password" autoComplete="new-password" required minLength={10} /></Field>
      <Field label="Powtórz nowe hasło" htmlFor="confirm"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></Field>
      <SubmitButton>Zmień hasło</SubmitButton>
    </form>
  );
}
