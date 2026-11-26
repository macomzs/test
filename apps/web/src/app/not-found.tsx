import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="text-lg font-semibold">Nie znaleziono strony</p>
      <ButtonLink href="/" variant="secondary">Wróć na pulpit</ButtonLink>
    </main>
  );
}
