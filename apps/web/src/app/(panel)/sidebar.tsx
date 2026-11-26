"use client";

import { cn } from "@/lib/cn";
import {
  BookOpen,
  FileText,
  Inbox,
  KeyRound,
  Languages,
  LayoutDashboard,
  ScrollText,
  Send,
  Server,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  stage?: number;
}

const icons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  catalog: BookOpen,
  templates: FileText,
  translations: Languages,
  publishing: Send,
  inbox: Inbox,
  users: Users,
  channels: KeyRound,
  audit: ScrollText,
  system: Server,
  ai: Sparkles,
};

export function Sidebar({ main, admin }: { main: NavItem[]; admin: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const renderItem = (item: NavItem) => {
    const Icon = icons[item.icon] ?? LayoutDashboard;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
            isActive(item.href) ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100",
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">{item.label}</span>
          {item.stage ? <span className="text-[10px] font-semibold uppercase text-slate-400">Etap {item.stage}</span> : null}
        </Link>
      </li>
    );
  };

  return (
    <nav className="flex flex-col gap-6" aria-label="Nawigacja główna">
      <ul className="space-y-1">{main.map(renderItem)}</ul>
      {admin.length > 0 ? (
        <div>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Administracja</p>
          <ul className="space-y-1">{admin.map(renderItem)}</ul>
        </div>
      ) : null}
    </nav>
  );
}
