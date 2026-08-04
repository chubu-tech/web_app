"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { createBusiness } from "@/lib/api/owner-setup";
import { createClient } from "@/lib/supabase/client";

/**
 * Add a salon.
 *
 * **What the copy has to say before anything is created**, because both are irreversible from
 * here:
 *
 * - **It starts private.** A new salon is `status = 'pending'`, and
 *   `businesses_select`'s public branch requires `approved` — so only its owner and an
 *   operator can see it until it is reviewed. An owner who created a shop and then could not
 *   find it on Discover would reasonably think the site was broken.
 * - **It cannot be deleted.** `businesses` has **no DELETE policy at all** — not for the
 *   owner, not for `anon`. Only an operator can remove one. Saying so up front is the whole
 *   mitigation available.
 *
 * On success the active-salon cookie switches to the new shop, so the console is already
 * showing it, and the next stop is Settings — because a salon with no services, staff or hours
 * can do nothing yet, and that page is where each of those is.
 */
export function CreateSalonForm({ isFirst }: { isFirst: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name for your salon.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("no session");

      const created = await createBusiness(supabase, user.id, {
        name: trimmed,
        addressText: address.trim() || null,
        phone: phone.trim() || null,
      });

      // Switch the console to it through the same route the salon picker posts to, so the
      // `httpOnly` cookie is set server-side and validated against what this user owns. That
      // handler redirects to `/business`; the salon has nothing on its calendar yet, so send
      // the owner to Settings instead once it has landed.
      await fetch("/business/active-salon", {
        method: "POST",
        body: new URLSearchParams({ businessId: created.id }),
        redirect: "manual",
      });

      toast.success(`${created.name} added. It stays private until we've reviewed it.`);
      router.push("/business/settings");
      router.refresh();
    } catch (caught) {
      setError(ownerErrorMessage("createSalon", caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[560px] tablet:px-lg">
      {!isFirst ? (
        <Link
          href="/business"
          className="text-caption text-rausch-cta gap-xs mb-sm inline-flex items-center font-medium"
        >
          <Icons.back style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
          Back
        </Link>
      ) : null}

      <SectionHeader title={isFirst ? "Add your salon" : "Add another salon"} as="h1" />
      <p className="text-body-sm text-muted mb-lg">
        The basics now — services, your team and opening hours come next.
      </p>

      <div className="gap-base flex flex-col">
        <Field
          label="Salon name"
          value={name}
          onChange={setName}
          placeholder="e.g. Norzin Salon & Spa"
          autoFocus
        />
        <Field
          label="Address"
          value={address}
          onChange={setAddress}
          placeholder="Street, town"
          hint="You can place yourself on the map afterwards."
        />
        <Field label="Phone" value={phone} onChange={setPhone} type="tel" />
      </div>

      <div className="border-hairline-soft bg-surface-soft p-base mt-lg gap-sm flex items-start rounded-md border">
        <Icons.info
          className="text-muted mt-0.5 shrink-0"
          style={{ width: IconSize.xs, height: IconSize.xs }}
          aria-hidden
        />
        <p className="text-body-sm text-muted">
          It starts on the Basic plan and stays private until we&apos;ve reviewed it — only you
          can see it in the meantime. Once it exists, only we can remove it, so check the name.
        </p>
      </div>

      {error ? <p className="text-body-sm text-error-text mt-base">{error}</p> : null}

      <div className="mt-lg">
        <Button fullWidth busy={busy} onClick={() => void create()}>
          Add salon
        </Button>
      </div>
    </div>
  );
}
