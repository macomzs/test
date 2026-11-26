import { APP_MODULES } from "@app/domain";
import { Construction } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { requirePermission } from "@/server/auth";

/** Tymczasowa strona modułu, który powstanie w kolejnym etapie. */
export async function ModulePlaceholder({ moduleKey }: { moduleKey: string }) {
  const mod = APP_MODULES.find((m) => m.key === moduleKey)!;
  await requirePermission(mod.permission);
  return (
    <>
      <PageHeader title={mod.label} description={mod.description} />
      <Card>
        <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
          <Construction className="size-8 text-slate-400" aria-hidden />
          <p className="font-medium">Moduł w przygotowaniu</p>
          <p className="text-sm text-slate-500">Ten moduł zostanie zbudowany w etapie {mod.stage}.</p>
        </CardBody>
      </Card>
    </>
  );
}
