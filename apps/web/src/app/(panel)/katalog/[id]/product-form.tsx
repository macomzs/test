"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PRODUCT_STATUS_LABELS } from "@/lib/catalog";
import { updateProductAction } from "../actions";

export interface ProductFormValues {
  id: string;
  kind: "SIMPLE" | "PARENT" | "VARIANT";
  name: string;
  variantLabel: string;
  sku: string;
  ean: string;
  brand: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  materials: string;
  basePrice: string;
  costPrice: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  weightKg: string;
}

/** Podpowiedzi z produktu głównego – wyświetlane jako placeholder, gdy pole wariantu jest puste. */
export type InheritedHints = Partial<Record<keyof ProductFormValues, string>>;

export function ProductForm({ values, inherited, canWrite }: { values: ProductFormValues; inherited: InheritedHints; canWrite: boolean }) {
  const [state, action] = useActionState(updateProductAction, undefined);
  const isVariant = values.kind === "VARIANT";
  const hint = (k: keyof ProductFormValues) => (isVariant && inherited[k] ? `dziedziczone: ${inherited[k]}` : undefined);
  const inheritNote = isVariant ? "Puste pole = wartość z produktu głównego." : undefined;

  return (
    <form action={action} className="space-y-6">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={values.id} />
      <fieldset disabled={!canWrite} className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Nazwa produktu" htmlFor="name"><Input id="name" name="name" defaultValue={values.name} required /></Field>
          </div>
          {isVariant ? (
            <Field label="Nazwa wariantu" htmlFor="variantLabel" hint="Np. „czarny”, „bez brodzika”."><Input id="variantLabel" name="variantLabel" defaultValue={values.variantLabel} /></Field>
          ) : null}
          <Field label="SKU (kod wewnętrzny)" htmlFor="sku" hint={values.sku ? undefined : "Feed nie zawiera SKU – uzupełnij ręcznie."}>
            <Input id="sku" name="sku" defaultValue={values.sku} className="font-mono" />
          </Field>
          {values.kind !== "PARENT" ? (
            <Field label="EAN / GTIN" htmlFor="ean"><Input id="ean" name="ean" defaultValue={values.ean} inputMode="numeric" className="font-mono" /></Field>
          ) : null}
          <Field label="Marka" htmlFor="brand" hint={inheritNote}><Input id="brand" name="brand" defaultValue={values.brand} placeholder={hint("brand")} /></Field>
          <Field label="Status" htmlFor="status" hint="Do publikacji na marketplace trafią tylko produkty aktywne.">
            <Select id="status" name="status" defaultValue={values.status}>
              {Object.entries(PRODUCT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Ceny</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Cena bazowa brutto (zł)" htmlFor="basePrice" hint="Sugerowana cena sprzedaży."><Input id="basePrice" name="basePrice" defaultValue={values.basePrice} inputMode="decimal" placeholder={hint("basePrice")} /></Field>
            <Field label="Koszt własny netto (zł)" htmlFor="costPrice"><Input id="costPrice" name="costPrice" defaultValue={values.costPrice} inputMode="decimal" placeholder={hint("costPrice")} /></Field>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Wymiary i waga (z opakowaniem)</h3>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Długość (cm)" htmlFor="lengthCm"><Input id="lengthCm" name="lengthCm" defaultValue={values.lengthCm} inputMode="decimal" placeholder={hint("lengthCm")} /></Field>
            <Field label="Szerokość (cm)" htmlFor="widthCm"><Input id="widthCm" name="widthCm" defaultValue={values.widthCm} inputMode="decimal" placeholder={hint("widthCm")} /></Field>
            <Field label="Wysokość (cm)" htmlFor="heightCm"><Input id="heightCm" name="heightCm" defaultValue={values.heightCm} inputMode="decimal" placeholder={hint("heightCm")} /></Field>
            <Field label="Waga (kg)" htmlFor="weightKg"><Input id="weightKg" name="weightKg" defaultValue={values.weightKg} inputMode="decimal" placeholder={hint("weightKg")} /></Field>
          </div>
        </section>

        <Field label="Materiały" htmlFor="materials" hint={inheritNote}>
          <Textarea id="materials" name="materials" defaultValue={values.materials} placeholder={hint("materials")} className="min-h-16 font-sans" />
        </Field>
      </fieldset>
      {canWrite ? <SubmitButton>Zapisz produkt</SubmitButton> : null}
    </form>
  );
}
