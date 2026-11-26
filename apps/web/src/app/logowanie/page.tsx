import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Logowanie" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">E</div>
          <h1 className="text-xl font-semibold">E-commerce Hub</h1>
          <p className="text-sm text-slate-500">Zaloguj się do panelu działu e-commerce</p>
        </div>
        <Card>
          <CardBody className="py-6">
            <LoginForm />
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
