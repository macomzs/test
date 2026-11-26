"use client";

import { SECTION_LABELS, type SectionType } from "@app/domain";
import { useActionState, useTransition, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import type { ActionState } from "@/server/action-state";
import { changeStatusAction, retranslateAction, saveTranslationAction } from "../../actions";

interface SectionView {
  type: SectionType;
  source: string;
  text: string;
  sourceChanged: boolean;
}

export function TranslationEditor(props: {
  productId: string;
  locale: string;
  scope: string;
  languageName: string;
  sections: SectionView[];
  status: "AI_DRAFT" | "PENDING_REVIEW" | "APPROVED" | null;
  busy: boolean;
  canWrite: boolean;
  canApprove: boolean;
}) {
  const [saveState, save] = useActionState(saveTranslationAction, undefined);
  const [statusState, changeStatus] = useActionState(changeStatusAction, undefined);
  const [aiState, setAiState] = useState<ActionState>(undefined);
  const [aiPending, startAi] = useTransition();
  const hidden = (
    <>
      <input type="hidden" name="productId" value={props.productId} />
      <input type="hidden" name="locale" value={props.locale} />
      <input type="hidden" name="scope" value={props.scope} />
    </>
  );
  const editable = props.canWrite && !props.busy;

  return (
    <div className="space-y-4">
      <FormMessage state={saveState} />
      <FormMessage state={statusState} />
      <FormMessage state={aiState} />

      <form action={save} className="space-y-4">
        {hidden}
        <div className="hidden grid-cols-2 gap-4 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
          <span>Oryginał (PL)</span>
          <span>{props.languageName}</span>
        </div>
        {props.sections.map((s) => (
          <div key={s.type} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="mb-2 text-sm font-semibold">{SECTION_LABELS[s.type]}</p>
            {s.sourceChanged ? <Alert tone="warning" className="mb-2 py-2 text-xs">Polski oryginał tej sekcji zmienił się od ostatniego tłumaczenia.</Alert> : null}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="whitespace-pre-line rounded-md bg-slate-50 p-3 text-sm text-slate-800">{s.source}</div>
              <Textarea
                name={`text_${s.type}`}
                defaultValue={s.text}
                disabled={!editable}
                aria-label={`${SECTION_LABELS[s.type]} – ${props.languageName}`}
                className={s.type === "TITLE" ? "min-h-12 font-sans" : "min-h-32 font-sans"}
              />
            </div>
          </div>
        ))}
        {editable ? <SubmitButton variant="secondary">Zapisz poprawki</SubmitButton> : null}
      </form>

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
        {props.canWrite ? (
          <Button
            type="button"
            variant="secondary"
            disabled={aiPending || props.busy}
            onClick={() => startAi(async () => setAiState(await retranslateAction(props.productId, props.locale, props.scope)))}
          >
            {props.busy ? "Tłumaczenie w toku…" : props.status ? "Przetłumacz ponownie (AI)" : "Przetłumacz (AI)"}
          </Button>
        ) : null}
        {props.status === "AI_DRAFT" && props.canWrite ? (
          <form action={changeStatus}>{hidden}<input type="hidden" name="to" value="PENDING_REVIEW" /><SubmitButton disabled={props.busy}>Wyślij do akceptacji</SubmitButton></form>
        ) : null}
        {props.status && props.status !== "APPROVED" && props.canApprove ? (
          <form action={changeStatus}>{hidden}<input type="hidden" name="to" value="APPROVED" /><SubmitButton disabled={props.busy} className="bg-emerald-600 hover:bg-emerald-700">Zatwierdź</SubmitButton></form>
        ) : null}
        {props.status === "PENDING_REVIEW" && props.canWrite ? (
          <form action={changeStatus}>{hidden}<input type="hidden" name="to" value="AI_DRAFT" /><SubmitButton variant="ghost" disabled={props.busy}>Cofnij do szkicu</SubmitButton></form>
        ) : null}
        {props.status === "APPROVED" && props.canWrite ? (
          <form action={changeStatus}>{hidden}<input type="hidden" name="to" value="PENDING_REVIEW" /><SubmitButton variant="ghost">Cofnij zatwierdzenie</SubmitButton></form>
        ) : null}
      </div>
    </div>
  );
}
