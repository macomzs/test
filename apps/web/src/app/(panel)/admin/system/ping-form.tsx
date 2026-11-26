"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { sendPingAction } from "./actions";

export function PingForm() {
  const [state, action] = useActionState(sendPingAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <SubmitButton pendingText="Wysyłanie…">Wyślij zadanie testowe</SubmitButton>
    </form>
  );
}
