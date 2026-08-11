import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getAccount } from "@/lib/session";
import { safeNext } from "@/lib/next-path";
import { sessionEndedMessage } from "@/lib/session-timeout";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; reason?: string | string[] }>;
}) {
  const { next, reason } = await searchParams;
  const target = safeNext(Array.isArray(next) ? next[0] : next);

  /*
    Why they are looking at this page, when they did not ask to be.

    `IdleTimeout` sends `?reason=idle` after the console's thirty-minute cut, and
    `requireFreshSession` sends `?reason=expired` when a session ran out on its own. Both
    used to land somebody on a bare sign-in form having pressed nothing, which reads as the
    app having lost their session for no reason.

    Validated against a closed set by `sessionEndedMessage`, not interpolated: this is a
    query parameter, so an unrecognised value renders no message rather than putting
    attacker-chosen text above a password field. Same rule as `safeNext` on `next`.
  */
  const endedMessage = sessionEndedMessage(reason);

  // Already signed in for real? There is nothing to do here. A *guest* is left
  // alone: they have a session but no account, and signing in is exactly what this
  // page is for.
  const account = await getAccount();
  if (account.state === "registered") redirect(target);

  return (
    <>
      {endedMessage ? (
        <p
          role="status"
          className="border-hairline bg-surface text-body-sm text-body px-md py-sm mb-lg rounded-lg border text-center"
        >
          {endedMessage}
        </p>
      ) : null}
      <p className="text-body-md text-muted mb-lg text-center">
        Sign in to book and manage appointments.
      </p>
      <AuthForm mode="sign-in" next={target} />
    </>
  );
}
