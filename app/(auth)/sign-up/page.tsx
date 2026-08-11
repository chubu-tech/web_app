import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getAccount } from "@/lib/session";
import { safeNext } from "@/lib/next-path";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(Array.isArray(next) ? next[0] : next);

  const account = await getAccount();
  if (account.state === "registered") redirect(target);

  return (
    <>
      <p className="text-body-md text-muted mb-lg text-center">
        Create an account to book appointments.
      </p>
      <AuthForm mode="sign-up" next={target} />
    </>
  );
}
