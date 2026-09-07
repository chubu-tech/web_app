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
import { BUSINESS_TYPES, travels as isTravelling, type BusinessType } from "@/lib/types/salon";

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
  const [type, setType] = useState<BusinessType>("salon");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const trimmed = name.trim();
    /*
      Mirrors `create_business`'s own check (`22023` under 2 or over 80) so the common mistake
      costs no round trip. **The server still validates** — this only saves a wait, it is not
      the gate.
    */
    if (trimmed.length < 2) {
      setError("Enter your salon's name.");
      return;
    }
    if (trimmed.length > 80) {
      setError("That name is too long — keep it under 80 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      /*
        No `getUser()` first: `create_business` derives the owner from `auth.uid()` itself and
        refuses a session it does not like — `28000` with none, `P0003` for a guest, who has a
        uid but no email the moderation queue could reach them on. Reading the id here only to
        pass it back would be a round trip that decides nothing.
      */
      const created = await createBusiness(createClient(), {
        name: trimmed,
        addressText: address.trim() || null,
        phone: phone.trim() || null,
        businessType: type,
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
        <fieldset>
          <legend className="text-caption text-muted mb-sm">What kind of business?</legend>
          <div className="gap-sm flex flex-wrap">
            {BUSINESS_TYPES.map((t) => {
              const selected = t.value === type;
              return (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setType(t.value)}
                  className={
                    selected
                      ? "text-caption bg-rausch-soft border-rausch text-rausch-cta px-lg min-h-11 rounded-full border font-semibold"
                      : "text-caption border-hairline text-ink hover:bg-surface-soft px-lg min-h-11 rounded-full border font-semibold"
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <p className="text-caption-sm text-muted-soft mt-sm">
            {BUSINESS_TYPES.find((t) => t.value === type)?.blurb}
          </p>
        </fieldset>

        {/*
          The label switches with the type: a travelling stylist has no shopfront to send
          anyone to, so the field asks for the area they cover rather than an address they
          would have to invent. `travels()` is the same predicate the salon page uses to show
          a coverage line and hide Directions.
        */}
        {isTravelling({ businessType: type }) ? (
          <Field
            label="Where do you work?"
            value={address}
            onChange={setAddress}
            placeholder="e.g. Thimphu and Babesa"
            hint="The area you cover. Customers see this instead of an address."
          />
        ) : (
          <Field
            label="Address"
            value={address}
            onChange={setAddress}
            placeholder="Street, town"
            hint="You can place yourself on the map afterwards."
          />
        )}
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
