import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { brand, footer } from "@/lib/marketing/content";
import { cn } from "@/lib/marketing/utils";
import { TextileRule } from "./ui/bhutan";
import { Reveal, RevealGroup } from "./ui/reveal";
import { Container } from "./ui/section";
import { SOCIAL_ICONS, type SocialKey } from "./ui/social-icons";
import { WaitlistCta } from "./waitlist-cta";

/**
 * The closing band.
 *
 * ## Light, not dark — and that reverses an earlier decision on purpose
 *
 * This used to be an obsidian slab, on the reasoning that it was "the only dark
 * surface on a cream site, which is what makes the footer read as a floor rather
 * than one more section". Both halves of that premise are gone: the site is not
 * cream any more, and the closing call to action above is a full-bleed photograph,
 * so the page already ends on a dark note before this begins. Stacking a near-black
 * fill directly under a near-black photograph removed the seam rather than creating
 * one.
 *
 * The reference is unambiguous here — `footer-light`: "White surface (matches the
 * page canvas — Airbnb has no contrast footer)", column heads in `title-sm` ink,
 * link rows in `body-sm`, closed by a muted `legal-band`. That is what this is now,
 * and the hairline above it is what separates it from the photograph.
 *
 * ## Four things here are decisions, and all four survive the reskin
 *
 * 1. **A blank `href` is not rendered.** The filter stays because it is what makes
 *    the next policy a one-line paste — same mechanism as `brand.stores`. All four
 *    legal routes exist and **all four now render this footer**: they live together
 *    under `app/(marketing)/(documents)/`, so following one of these links no longer
 *    hands the reader the customer app's nav. Three of them used to, and it was
 *    invisible from here — the hrefs were right and the destinations answered 200.
 * 2. **The signup is a button, not an inline form.** The email is asked for in the
 *    modal it opens, which renders the same `WaitlistForm` with the same validation
 *    and the same "already on the list is a success" state, and rows still land with
 *    `source: "footer"`.
 * 3. **The social row renders all four even though three have no URL yet.** They
 *    fall back to the site root rather than 404ing. WhatsApp is derived from
 *    `brand.whatsapp`, which is a real number, so that icon and the phone row below
 *    both resolve to somewhere.
 * 4. **`RevealGroup` wraps the columns**, so the four stagger as one gesture on entry
 *    instead of each firing its own observer.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  const whatsappHref = `https://wa.me/${brand.whatsapp.replace(/\D/g, "")}`;

  const socialHref: Record<SocialKey, string> = {
    whatsapp: whatsappHref,
    // Unset profiles resolve to the site root: harmless, and never a broken link.
    tiktok: brand.social.tiktok || "/",
    facebook: brand.social.facebook || "/",
    instagram: brand.social.instagram || "/",
  };

  const legalLinks = footer.legal.links.filter((link) => link.href.length > 0);

  return (
    <footer className="border-hairline bg-canvas border-t">
      <Container className="pt-14 sm:pt-16">
        {/*
          **Four column counts, and the 12-track grid waits until `xl`.**

          Five link columns need real width, and at `lg` (1024px) a twelve-track grid
          with 32px gutters gives each track **49px** — so a 2-track column is 130px,
          which is narrower than the word "Join the waitlist" and 20px short of the
          support address. Both were breaking mid-word.

          So the fine-grained 3·2·2·3·2 split applies from 1280 up, where a track is
          71px and those two columns are 173px and 276px. Between 1024 and 1280 it
          falls back to three equal ~288px columns, and to two below that — the
          reference's own rule for every grid on the page: reduce columns, never
          reflow rows.
        */}
        <RevealGroup className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-12 xl:gap-8">
          {/* ── Company ───────────────────────────────────────────────── */}
          {/*
            **3 · 2 · 2 · 2 · 3, five columns where there were four.**

            Legal used to be a second `<nav>` stacked under Quick links inside one
            2-column track, on the arithmetic that all twelve columns were spoken for
            at 4·2·3·3. That was true then. It stopped being true when the footer went
            light and its rows dropped from `text-ui` to `text-body-sm`: Contact's
            longest line is the support address at 19 characters, which is ~137px at
            14px and fits a 2-column track (~173px at the 1280 cap) with room over.

            The stack was worth undoing because nine link rows in one column against
            three in the next made the footer visibly lopsided — a tall left column
            beside 200px of empty canvas under "Stay updated". Five columns of two to
            five rows each read as one band.
          */}
          <Reveal asChild className="sm:col-span-2 lg:col-span-1 xl:col-span-3">
            <div>
              <span className="flex items-center gap-2.5">
                {/* The header's lockup. The mark carries its own crimson ground, so
                    it needs no tile — but it does need `overflow-hidden` to take the
                    shape. `rounded-full`, matching the bar above and the product's own
                    lockup: this was `rounded-md` while the bar clamped to a circle, so
                    the top and the bottom of the same page disagreed about the mark. */}
                <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full">
                  <Image
                    src="/tho-logo.webp"
                    alt=""
                    width={36}
                    height={36}
                    className="size-full object-cover"
                  />
                </span>
                <span className="text-subheading text-ink font-semibold">
                  {brand.name}
                </span>
              </span>

              <TextileRule className="mt-5 w-24" />

              {/* 24rem, not `max-w-sm` — that resolves to `--spacing-sm`, 8px.
                  See `components/ui/sheet.tsx`. */}
              <p className="text-body mt-5 max-w-[24rem] text-body-sm">
                {footer.blurb}
              </p>

              {/* ── Follow us ──────────────────────────────────────────
                  Sits under the company block rather than in a fifth column: four
                  icons need ~200px, and giving them a column of their own would have
                  squeezed the signup below a usable width. */}
              <h2 className="text-ink text-ui mt-8 font-semibold">
                {footer.social.title}
              </h2>
              <ul className="mt-4 flex flex-wrap items-center gap-2.5">
                {footer.social.networks.map((network) => {
                  const Icon = SOCIAL_ICONS[network.key as SocialKey];
                  return (
                    <li key={network.key}>
                      <a
                        href={socialHref[network.key as SocialKey]}
                        aria-label={network.label}
                        // `icon-button-outline` from the reference: 40px, canvas
                        // fill, hairline stroke. No scale on hover — the stroke and
                        // the fill carry it.
                        className={cn(
                          "grid size-10 place-items-center rounded-full",
                          "text-body ring-hairline bg-canvas ring-1 ring-inset",
                          "transition-colors duration-200",
                          "hover:bg-surface-soft hover:text-ink hover:ring-border-strong",
                        )}
                      >
                        <Icon className="size-[18px]" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Reveal>

          {/* ── Quick links ────────────────────────────────────────────────
              Two `<nav>` elements rather than one list under a shared heading: these
              are different kinds of destination — anchors down this page versus
              documents you leave it for — so each needs its own accessible name.
              Putting Legal inside the Quick links `<nav>` would have made one
              landmark labelled "Quick links" that also contains the Terms. */}
          <Reveal asChild className="xl:col-span-2">
            <nav aria-label={footer.quickLinks.title}>
              <h2 className="text-ink text-ui font-semibold">
                {footer.quickLinks.title}
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {footer.quickLinks.links.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
                {/* Sign in was the one off-site destination left here and is removed
                    until the product side is deployed — see `signIn` in
                    `lib/marketing/content.ts`, which is also the restore. With it
                    gone, every link in this footer is same-origin.

                    "Admin portal" sat below it and is gone for a different reason:
                    the operators' console is internal, and a public marketing footer
                    is the wrong place to advertise the door to it. */}
              </ul>
            </nav>
          </Reveal>

          {/* ── Legal ─────────────────────────────────────────────────── */}
          {legalLinks.length > 0 ? (
            <Reveal asChild className="xl:col-span-2">
              <nav aria-label={footer.legal.title}>
                <h2 className="text-ink text-ui font-semibold">
                  {footer.legal.title}
                </h2>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {legalLinks.map((link) => (
                    <li key={link.href}>
                      <FooterLink href={link.href}>{link.label}</FooterLink>
                    </li>
                  ))}
                </ul>
              </nav>
            </Reveal>
          ) : null}

          {/* ── Contact ───────────────────────────────────────────────── */}
          <Reveal asChild className="xl:col-span-3">
            <div>
              <h2 className="text-ink text-ui font-semibold">
                {footer.contact.title}
              </h2>
              <ul className="mt-4 flex flex-col gap-4">
                <li>
                  <ContactRow
                    icon={<Mail className="size-4" strokeWidth={2} aria-hidden />}
                    label={footer.contact.emailLabel}
                    value={brand.supportEmail}
                    href={`mailto:${brand.supportEmail}`}
                  />
                </li>
                <li>
                  <ContactRow
                    icon={<Phone className="size-4" strokeWidth={2} aria-hidden />}
                    label={footer.contact.phoneLabel}
                    value={brand.whatsapp}
                    href={`tel:${brand.whatsapp.replace(/\s/g, "")}`}
                  />
                </li>
                <li>
                  <ContactRow
                    icon={<MapPin className="size-4" strokeWidth={2} aria-hidden />}
                    label="Serving"
                    value={footer.cities.join(" · ")}
                  />
                </li>
              </ul>
            </div>
          </Reveal>

          {/* ── Stay updated ──────────────────────────────────────────── */}
          <Reveal asChild className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <div>
              <h2 className="text-ink text-ui font-semibold">
                {footer.newsletter.title}
              </h2>
              <p className="text-body mt-4 text-body-sm">
                {footer.newsletter.body}
              </p>
              {/* One button, and the email is asked for in the modal it opens — not
                  here as well. Same component, same Supabase call, same "already on
                  the list is a success" state, and rows still land with
                  `source: "footer"`; the field just moved to where there is room for
                  it. `primary` because this is the band's one action. */}
              {/* `px-4`, tightening `Button`'s own `px-6`: full-width in the
                  narrowest column on the page, the label needs the room more than
                  the pill needs the padding. */}
              <WaitlistCta source="footer" className="mt-5 w-full px-4" />
            </div>
          </Reveal>
        </RevealGroup>

        {/* ── Legal band ──────────────────────────────────────────────────
            Copyright and coverage only. The policy links were here as a
            right-aligned row and moved up into their own titled column, because that
            is where a reader looks for a policy. They are **not** in both places:
            keeping the row would have printed Privacy Policy twice in one footer. */}
        <div className="border-hairline-soft text-muted mt-14 flex flex-col gap-2 border-t py-6 text-caption sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {year} {brand.name}. {footer.rights}
          </span>
          <span>{brand.cities.join(" · ")}</span>
        </div>
      </Container>
    </footer>
  );
}

/** One navigation link. Darkens to full ink on hover; nothing moves. */
function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="text-body hover:text-ink text-body-sm transition-colors duration-200"
    >
      {children}
    </a>
  );
}

/**
 * A labelled contact row. The label is visible rather than `sr-only` because
 * "Email" above an address is useful to everybody, not only a screen reader — and a
 * bare `+975 17 71 65 23` under a bare address reads as one block of text.
 */
function ContactRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <span className="flex items-start gap-2.5">
      <span className="text-muted-soft mt-0.5 shrink-0">{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-muted text-caption">{label}</span>
        {href ? (
          <a
            href={href}
            className="text-ink hover:text-rausch text-body-sm break-words transition-colors duration-200"
          >
            {value}
          </a>
        ) : (
          <span className="text-ink text-body-sm">{value}</span>
        )}
      </span>
    </span>
  );
}
