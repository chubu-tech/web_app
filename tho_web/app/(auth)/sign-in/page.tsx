import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getAccount } from "@/lib/session";
import { safeNext } from "@/lib/next-path";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(Array.isArray(next) ? next[0] : next);

  // Already signed in for real? There is nothing to do here. A *guest* is left
  // alone: they have a session but no account, and signing in is exactly what this
  // page is for.
  const account = await getAccount();
  if (account.state === "registered") redirect(target);

  return (
    <>
      <p className="text-body-md text-muted mb-lg text-center">
        Sign in to book and manage appointments.
      </p>
      <AuthForm mode="sign-in" next={target} />
    </>
  );
}
