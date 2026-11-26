import type { RenderResult, SectionType } from "@app/domain";
import { Alert } from "./ui/alert";

/** Wyświetla wyrenderowaną sekcję oferty: punkty jako listę, akapity jako tekst; zaznacza braki danych. */
export function RenderedText({ type, result, limit }: { type: SectionType; result: Pick<RenderResult, "text" | "missing" | "unknown">; limit?: number }) {
  const lines = result.text.split("\n");
  const highlight = (line: string) =>
    line.split(/(\[(?:brak|nieznana zmienna): [a-z_]+\])/g).map((part, i) =>
      /^\[(brak|nieznana zmienna): /.test(part) ? <mark key={i} className="rounded bg-amber-100 px-1 text-amber-900">{part}</mark> : <span key={i}>{part}</span>,
    );
  return (
    <div className="space-y-2">
      {type === "BENEFITS" || type === "SET_CONTENTS" ? (
        <ul className="list-disc space-y-0.5 pl-5 text-sm">{lines.filter((l) => l.trim()).map((l, i) => <li key={i}>{highlight(l)}</li>)}</ul>
      ) : (
        <div className={type === "TITLE" ? "text-sm font-semibold" : "space-y-2 text-sm"}>
          {result.text.split(/\n\s*\n/).map((p, i) => <p key={i} className="whitespace-pre-line">{highlight(p)}</p>)}
        </div>
      )}
      {type === "TITLE" && limit ? (
        <p className={`text-xs ${result.text.length > limit ? "font-medium text-red-700" : "text-slate-500"}`}>{result.text.length} / {limit} znaków</p>
      ) : null}
      {result.missing.length || result.unknown.length ? (
        <Alert tone="warning" className="py-2 text-xs">
          {result.missing.length ? <>Brak danych produktu: {result.missing.join(", ")}. </> : null}
          {result.unknown.length ? <>Nieznane zmienne: {result.unknown.join(", ")}.</> : null}
        </Alert>
      ) : null}
    </div>
  );
}
