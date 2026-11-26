import { APP_MODULES, hasPermission, type Permission } from "@app/domain";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth";
import { logoutAction } from "../logowanie/actions";
import { Sidebar, type NavItem } from "./sidebar";

const ADMIN_NAV: (NavItem & { permission: Permission })[] = [
  { href: "/admin/uzytkownicy", label: "Użytkownicy i role", icon: "users", permission: "users.manage" },
  { href: "/admin/kanaly", label: "Kanały i klucze API", icon: "channels", permission: "channels.manage" },
  { href: "/admin/integracje", label: "Integracje AI", icon: "ai", permission: "system.manage" },
  { href: "/admin/audyt", label: "Logi audytowe", icon: "audit", permission: "audit.read" },
  { href: "/admin/system", label: "Zadania w tle", icon: "system", permission: "system.manage" },
];

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const main: NavItem[] = [
    { href: "/", label: "Pulpit", icon: "dashboard" },
    ...APP_MODULES.filter((m) => hasPermission(user.permissions, m.permission)).map((m) => ({
      href: m.href,
      label: m.label,
      icon: m.key,
      stage: m.ready ? undefined : m.stage,
    })),
  ];
  const admin = ADMIN_NAV.filter((i) => hasPermission(user.permissions, i.permission)).map(({ permission: _p, ...i }) => i);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-3">
          <span className="flex size-8 items-center justify-center rounded-md bg-brand-600 font-bold text-white">E</span>
          <span className="font-semibold">E-commerce Hub</span>
        </Link>
        <div className="flex-1 overflow-y-auto">
          <Sidebar main={main} admin={admin} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-4 border-b border-slate-200 bg-white px-6">
          <Link href="/konto" className="text-right text-sm leading-tight hover:underline">
            <span className="block font-medium">{user.name}</span>
            <span className="block text-xs text-slate-500">{user.roles.map((r) => r.name).join(", ") || "Brak ról"}</span>
          </Link>
          <form action={logoutAction}>
            <Button variant="secondary" size="sm" type="submit">Wyloguj</Button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
