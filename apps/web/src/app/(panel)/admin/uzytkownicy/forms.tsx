"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { createUserAction, resetPasswordAction, updateUserAction } from "./actions";

type RoleOption = { id: string; name: string; description: string };

function RolePicker({ roles, selected = [] }: { roles: RoleOption[]; selected?: string[] }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium text-slate-700">Role</legend>
      {roles.map((r) => (
        <Checkbox
          key={r.id}
          name="roleIds"
          value={r.id}
          defaultChecked={selected.includes(r.id)}
          label={<><span className="font-medium">{r.name}</span> <span className="text-slate-500">– {r.description}</span></>}
        />
      ))}
    </fieldset>
  );
}

export function CreateUserForm({ roles }: { roles: RoleOption[] }) {
  const [state, action] = useActionState(createUserAction, undefined);
  return (
    <form action={action} className="max-w-xl space-y-4">
      <FormMessage state={state} />
      <Field label="Imię i nazwisko" htmlFor="name"><Input id="name" name="name" required defaultValue={state?.fields?.name} /></Field>
      <Field label="E-mail (login)" htmlFor="email"><Input id="email" name="email" type="email" required defaultValue={state?.fields?.email} /></Field>
      <Field label="Hasło startowe" htmlFor="password" hint="Min. 10 znaków. Przekaż je użytkownikowi – może je zmienić w zakładce „Moje konto”.">
        <Input id="password" name="password" type="text" autoComplete="new-password" required minLength={10} />
      </Field>
      <RolePicker roles={roles} />
      <SubmitButton>Utwórz użytkownika</SubmitButton>
    </form>
  );
}

export function EditUserForm({ user, roles, selectedRoleIds }: { user: { id: string; name: string; isActive: boolean }; roles: RoleOption[]; selectedRoleIds: string[] }) {
  const [state, action] = useActionState(updateUserAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={user.id} />
      <Field label="Imię i nazwisko" htmlFor="name"><Input id="name" name="name" defaultValue={user.name} required /></Field>
      <RolePicker roles={roles} selected={selectedRoleIds} />
      <Checkbox name="isActive" defaultChecked={user.isActive} label="Konto aktywne (odznaczenie natychmiast wyloguje użytkownika)" />
      <SubmitButton>Zapisz zmiany</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(resetPasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={userId} />
      <Field label="Nowe hasło" htmlFor="password"><Input id="password" name="password" type="text" autoComplete="new-password" required minLength={10} /></Field>
      <SubmitButton variant="secondary">Ustaw nowe hasło</SubmitButton>
    </form>
  );
}
