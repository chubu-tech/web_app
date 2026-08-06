import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { brand, footer, signIn } from "@/lib/content";
import { cn } from "@/lib/utils";
import { TextileRule } from "./ui/bhutan";
import { Reveal, RevealGroup } from "./ui/reveal";
import { Container } from "./ui/section";
import { SOCIAL_ICONS, type SocialKey } from "./ui/social-icons";
import { WaitlistCta } from "./waitlist-cta";

/**
 * The closing band.
 *
 * **Dark, not light.** The brief allowed either; obsidian is what the page already
 * ends on and it is the only dark surface on a cream site, which is what makes the
 * footer read as a floor rather than one more section. Switching it to light would
 * have removed the page's one full-stop.
 *
 * ## Four things here are decisions
 *
 * 1. **A blank `href` is not rendered.** `footer.legalLinks` carries Terms and
 *    Cookie with empty hrefs because those routes do not exist — only `/privacy`
 *    does. A footer is exactly where somebody goes looking for a policy, so a 404
 *    there is worse than an absence. Build the page, paste the path, and the link
 *    appears. Same mechanism as `brand.stores`.
 *
 * 2. **The signup is a button, not an inline form.** It was `WaitlistForm` with
 *    `tone="light"` and `stacked`; now it is `WaitlistCta`, so the column offers one
 *    control and the email field is asked for in the modal that opens. Nothing about
 *    the submit path changed — the modal renders the same `WaitlistForm`, so the
 *    validation timing, the "already on the list is a success" state and every string
 *    are still shared, and rows still land with `source: "footer"`. What went away is
 *    a second place to type the same address, in the narrowest column on the page.
 *
 * 3. **The social row renders all four even though three have no URL yet.** They
 *    fall back to the site root rather than 404ing, and `brand.social` is the one
 *    place to paste real profiles. WhatsApp is live today and is derived from
 *    `brand.whatsapp` — which is itself still a placeholder number. The glyphs are
 *    sized here rather than defaulted in `social-icons.tsx`; that file says why.
 *
 * 4. **`RevealGroup` wraps the columns**, so the four stagger as one gesture on
 *    entry instead of each firing its own observer. `Reveal` already collapses to
 *    a no-op under `prefers-reduced-motion`, so the fade-in needs no extra guard.
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

  const legal = footer.legalLinks.filter((link) => link.href.length > 0);

  return (
    <footer className="bg-obsidian text-white">
      {/* The subtle divider above the footer. A hairline that fades out at both
          ends, so the dark band arrives as a seam rather than a hard cut. */}
      <div
        aria-hidden
        className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />

      <Container className="pt-16 sm:pt-20">
        <RevealGroup className="grid gap-12 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* ── Company ───────────────────────────────────────────────── */}
          {/* 4 · 2 · 3 · 3. Contact needs the three because
              `hello@bhutansalons.com` is 22 characters and broke across two lines
              at a narrower span; the company column gives up the width because its
              blurb is capped at `max-w-sm` anyway and was not using it. */}
          <Reveal asChild className="sm:col-span-2 lg:col-span-4">
            <div>
              <span className="flex items-center gap-2.5">
                {/* The header's lockup. The mark carries its own crimson ground,
                    so it needs no tile — but it does need `overflow-hidden` to
                    take the rounded corners. */}
                <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl">
                  <Image
                    src="/tho-logo.jpg"
                    alt=""
                    width={36}
                    height={36}
                    className="size-full object-cover"
                  />
                </span>
                <span className="text-body-lg font-semibold">{brand.name}</span>
              </span>

              <TextileRule className="mt-5 w-28" />

              <p className="mt-5 max-w-sm text-ui leading-relaxed text-white/70">
                {footer.blurb}
              </p>

              {/* The two store badges used to sit here and are gone. They said
                  "COMING SOON TO App Store" and opened the waitlist modal — which
                  is precisely what "Stay updated" three columns over now does, in
                  one step instead of two. They remain in the download band above,
                  where they are the point of the section rather than a duplicate. */}

              {/* ── Follow us ──────────────────────────────────────────
                  Sits under the company block rather than in a fifth column:
                  four icons need ~200px, and giving them a column of their own
                  would have squeezed the signup below a usable width. */}
              <h2 className="mt-8 text-caption-sm font-semibold tracking-[0.16em] text-white/60 uppercase">
                {footer.social.title}
              </h2>
              <ul className="mt-4 flex flex-wrap items-center gap-3">
                {footer.social.networks.map((network) => {
                  const Icon = SOCIAL_ICONS[network.key as SocialKey];
                  return (
                    <li key={network.key}>
                      <a
                        href={socialHref[network.key as SocialKey]}
                        aria-label={network.label}
                        className={cn(
                          "grid size-10 place-items-center rounded-full",
                          "bg-white/8 text-white/70 ring-1 ring-white/12 ring-inset",
                          "transition-[transform,background-color,color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                          "hover:scale-110 hover:bg-white/16 hover:text-white",
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

          {/* ── Quick links ───────────────────────────────────────────── */}
          <Reveal asChild className="lg:col-span-2">
            <nav aria-label={footer.quickLinks.title}>
              <h2 className="text-caption-sm font-semibold tracking-[0.16em] text-white/60 uppercase">
                {footer.quickLinks.title}
              </h2>
              <ul className="mt-5 flex flex-col gap-3">
                {footer.quickLinks.links.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
                {/* Sign in is the one off-site destination left here. "Admin portal"
                    sat below it and is gone: the operators' console is internal, and a
                    public marketing footer is the wrong place to advertise the door to
                    it. Operators reach it by URL. */}
                <li>
                  <FooterLink href={signIn.href}>{signIn.label}</FooterLink>
                </li>
              </ul>
            </nav>
          </Reveal>

          {/* ── Contact ───────────────────────────────────────────────── */}
          <Reveal asChild className="lg:col-span-3">
            <div>
              <h2 className="text-caption-sm font-semibold tracking-[0.16em] text-white/60 uppercase">
                {footer.contact.title}
              </h2>
              <ul className="mt-5 flex flex-col gap-4">
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
          <Reveal asChild className="sm:col-span-2 lg:col-span-3">
            <div>
              <h2 className="text-caption-sm font-semibold tracking-[0.16em] text-white/60 uppercase">
                {footer.newsletter.title}
              </h2>
              <p className="mt-5 text-ui leading-relaxed text-white/70">
                {footer.newsletter.body}
              </p>
              {/* One button, and the email is asked for in the modal it opens — not
                  here as well. The inline `WaitlistForm` that used to sit here put an
                  "Email address" label, an input and the fine print in a ~300px column,
                  duplicating the very fields the modal already shows. Same component,
                  same Supabase call, same "already on the list is a success" state, and
                  rows still land with `source: "footer"` — the field just moved to where
                  there is room for it. */}
              {/* `primary`, i.e. the default — not the `light` variant the dark band
                  would suggest. The inline form's submit was rausch here, and with the
                  store badges gone from this column this button is now the band's one
                  primary action, which is exactly what rausch is reserved for. `light`
                  rendered it as a grey pill and read as secondary. */}
              <WaitlistCta
                source="footer"
                className="mt-5 w-full justify-center"
              />
            </div>
          </Reveal>
        </RevealGroup>

        {/* ── Bottom bar ──────────────────────────────────────────────── */}
        <div className="mt-16 flex flex-col gap-4 border-t border-white/10 py-7 text-caption text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {year} {brand.name}. {footer.rights}
          </span>
          {legal.length > 0 ? (
            <nav aria-label="Legal">
              <ul className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
                {legal.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="transition-colors duration-200 hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </Container>
    </footer>
  );
}

/** One navigation link. Fades to full white on hover; nothing moves. */
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
      className="text-ui text-white/70 transition-colors duration-200 hover:text-white"
    >
      {children}
    </a>
  );
}

/**
 * A labelled contact row. The label is visible rather than `sr-only` because
 * "Email" above an address is useful to everybody, not only a screen reader —
 * and a bare `+975 17 00 00 00` under a bare address reads as one block of text.
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
      <span className="mt-0.5 shrink-0 text-white/40">{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        {/* /55, not /45: measured, /45 composites to 4.52:1 on obsidian, which
            passes AA by 0.02 and fails it the moment anyone nudges the band
            colour. /55 is 6.19:1 and matches the bottom bar. */}
        <span className="text-caption-sm text-white/55">{label}</span>
        {href ? (
          <a
            href={href}
            className="text-ui break-words text-white/80 transition-colors duration-200 hover:text-white"
          >
            {value}
          </a>
        ) : (
          <span className="text-ui text-white/80">{value}</span>
        )}
      </span>
    </span>
  );
}
