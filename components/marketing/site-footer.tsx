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
 * The closing band — a **mast**, not a column index.
 *
 * ## Why the shape changed
 *
 * This was five titled columns of links (Company · Quick links · Legal · Contact · Stay
 * updated), a row of social icons beneath the first, and a hairline-topped copyright tail.
 * That is the most-recognised footer fingerprint on the web: the shape lands identically on
 * a B2B SaaS, a bakery and a marketplace, which is precisely the problem — a footer that
 * cannot tell you what kind of site you are on is a templated footer.
 *
 * The tell was as visible in the reasoning as in the markup. Every note in the old file
 * argued about *column arithmetic* — 3·2·2·2·3 against 4·2·3·3, whether a two-track column
 * clears the support address at 1280 — and none of them asked whether the site had a
 * sitemap worth indexing. It does not. It has twelve destinations and one conversion.
 *
 * So: one anchoring mast carrying identity and contact, the twelve links demoted to two
 * dense inline rows, and the signup given the room it earns as the only action down here.
 * The social row moves into the quiet legal band — three of its four accounts do not exist
 * yet and resolve to the site root, which is a reasonable placeholder in a footer's
 * basement and an odd thing to give a titled block of its own.
 *
 * ## Five things that survive the reshape, unchanged
 *
 * 1. **A blank `href` is not rendered.** The filter is what makes the next policy a one-line
 *    paste — same mechanism as `brand.stores`. All five legal routes exist today and all
 *    five render this footer, because they live under `app/(marketing)/(documents)/`.
 * 2. **The signup is a button, not an inline form.** The email is asked for in the modal it
 *    opens, which renders the same `WaitlistForm` with the same validation and the same
 *    "already on the list is a success" state. Rows still land with `source: "footer"`.
 * 3. **Two `<nav>` landmarks, each with its own accessible name.** Explore and Legal are
 *    different kinds of destination — places on this site versus documents you leave it for
 *    — and one landmark labelled "Quick links" that also contained the Terms was the reason
 *    they were split in the first place.
 * 4. **Visible contact labels.** "Email" above an address helps everybody, not only a screen
 *    reader, and a bare `+975 17 71 65 23` under a bare address reads as one run of text.
 * 5. **`RevealGroup`** still wraps the band, so it staggers as one gesture rather than
 *    firing an observer per column.
 *
 * ## The surface is `bg-canvas`, and that now means cream
 *
 * `app/(marketing)/layout.tsx` declares `data-shell="marketing"`, so the public pages render
 * on the same `#f6f3ee` as the product. The footer is page *ground*, so it keeps `canvas`;
 * the signup panel and the social buttons are things lifted off it, so they take `paper`.
 * That distinction did no work while both resolved to white — it does now.
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
          **Two parts, not five columns, and the asymmetry is the point.**

          The mast takes 5 of 12 tracks and the content 6, with track 6 left empty as the
          gutter between them — so the band reads as an anchor with material beside it
          rather than as a rank of equal-weight lists. Below `lg` they stack, which is this
          site's rule for every grid on it: reduce columns, never reflow rows.
        */}
        <RevealGroup className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          {/* ── The mast ──────────────────────────────────────────────── */}
          <Reveal asChild className="lg:col-span-5">
            <div>
              <span className="flex items-center gap-2.5">
                {/* The mark carries its own crimson ground, so it needs no tile — but it
                    does need `overflow-hidden` to take the shape. `rounded-full` matches
                    the header's lockup; the two used to disagree. */}
                <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full">
                  <Image
                    src="/tho-logo.webp"
                    alt=""
                    width={36}
                    height={36}
                    className="size-full object-cover"
                  />
                </span>
                {/* Fraunces, as in the header. `typography.md`'s rule for editorial pages:
                    collapsing the wordmark into the body family flattens the hierarchy and
                    the page reads un-branded. */}
                <span className="text-subheading text-ink font-display font-semibold">
                  {brand.name}
                </span>
              </span>

              <TextileRule className="mt-5 w-24" />

              {/* 34rem written out, not `max-w-lg`. `globals.css` declares `--spacing-lg`,
                  and a named width resolves against the spacing namespace before
                  `--container-*`, so `max-w-lg` compiles to `max-width: 24px`. See
                  `components/ui/sheet.tsx`. */}
              <p className="text-body mt-5 max-w-[34rem] text-body-lg">
                {footer.blurb}
              </p>

              {/* Contact sits in the mast rather than in a column of its own: who you are
                  and how to reach you are one block, and carrying it is what the identity
                  half of a masthead is for. */}
              <ul className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:gap-x-10">
                <li>
                  <ContactRow
                    icon={
                      <Mail className="size-4" strokeWidth={2} aria-hidden />
                    }
                    label={footer.contact.emailLabel}
                    value={brand.supportEmail}
                    href={`mailto:${brand.supportEmail}`}
                  />
                </li>
                <li>
                  <ContactRow
                    icon={
                      <Phone className="size-4" strokeWidth={2} aria-hidden />
                    }
                    label={footer.contact.phoneLabel}
                    value={brand.whatsapp}
                    href={`tel:${brand.whatsapp.replace(/\s/g, "")}`}
                  />
                </li>
                <li>
                  <ContactRow
                    icon={
                      <MapPin className="size-4" strokeWidth={2} aria-hidden />
                    }
                    label="Serving"
                    value={footer.cities.join(" · ")}
                  />
                </li>
              </ul>
            </div>
          </Reveal>

          {/* ── The content beside it ─────────────────────────────────── */}
          <Reveal asChild className="lg:col-span-6 lg:col-start-7">
            <div>
              {/*
                The signup leads, because it is the only thing down here somebody can *do*.
                In the old footer it was the fifth of five equal columns and the narrowest
                of them — the band's one action, given the least room on the row.
              */}
              <div className="border-hairline bg-paper rounded-md border p-5 sm:p-6">
                <h2 className="text-ink text-subheading font-display font-semibold">
                  {footer.newsletter.title}
                </h2>
                <p className="text-body mt-2 max-w-[30rem] text-body-sm">
                  {footer.newsletter.body}
                </p>
                <WaitlistCta
                  source="footer"
                  className="mt-5 w-full sm:w-auto"
                />
              </div>

              {/*
                Twelve links as two dense inline rows.

                Set as flowing text separated by hairline dots rather than as stacked
                columns: at seven and five items the column form needed five tracks and
                produced the wall this file exists to undo, while inline they are two
                readable lines that wrap to whatever width is available.

                The label sits **above** its row, never beside it. A label in a narrow left
                column with its content to the right is the hanging-header pattern, and it
                is the one arrangement of a label and its content that always reads as
                templated.
              */}
              <nav aria-label={footer.quickLinks.title} className="mt-10">
                <LinkRowLabel>{footer.quickLinks.title}</LinkRowLabel>
                <LinkRow>
                  {footer.quickLinks.links.map((link) => (
                    <FooterLink key={link.href} href={link.href}>
                      {link.label}
                    </FooterLink>
                  ))}
                </LinkRow>
              </nav>

              {legalLinks.length > 0 ? (
                <nav aria-label={footer.legal.title} className="mt-8">
                  <LinkRowLabel>{footer.legal.title}</LinkRowLabel>
                  <LinkRow>
                    {legalLinks.map((link) => (
                      <FooterLink key={link.href} href={link.href}>
                        {link.label}
                      </FooterLink>
                    ))}
                  </LinkRow>
                </nav>
              ) : null}
            </div>
          </Reveal>
        </RevealGroup>

        {/* ── The legal band ──────────────────────────────────────────────
            Copyright and the social icons — which are here rather than in a titled "Follow
            us" block because three of the four accounts do not exist yet. A basement is the
            right place for a link that currently resolves to the site root; a heading over
            it is not.

            `flex-row-reverse` from `sm`, so the icons sit right and the copyright left
            while the copyright still comes **first** in the DOM. Reading order follows the
            markup, and the sentence that names the year and the company is the one that
            should be read first.

            The policy links are deliberately not repeated down here. They have their own
            row above, which is where a reader looks for a policy, and printing Privacy
            Policy twice in one footer was the previous arrangement's other tell. */}
        <div className="border-hairline-soft text-muted mt-14 flex flex-col gap-5 border-t py-6 text-caption sm:flex-row-reverse sm:items-center sm:justify-between sm:gap-6">
          <ul className="flex flex-wrap items-center gap-2.5">
            {footer.social.networks.map((network) => {
              const Icon = SOCIAL_ICONS[network.key as SocialKey];
              return (
                <li key={network.key}>
                  <a
                    href={socialHref[network.key as SocialKey]}
                    aria-label={network.label}
                    // 40px, paper fill, hairline stroke. No scale on hover — the stroke and
                    // the fill carry it. `paper`, not `canvas`: these are lifted off the
                    // footer's ground, which is cream now.
                    className={cn(
                      "grid size-10 place-items-center rounded-full",
                      "text-body ring-hairline bg-paper ring-1 ring-inset",
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

          <span>
            © {year} {brand.name}. {footer.rights}
          </span>
        </div>
      </Container>
    </footer>
  );
}

/** The small tracked label above a link row. */
function LinkRowLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-muted text-caption-sm font-semibold tracking-[0.14em] uppercase">
      {children}
    </h2>
  );
}

/**
 * A row of links, separated by a hairline dot.
 *
 * The dot is a CSS `::after` on the `<li>` rather than a character in the label, so a
 * screen reader reads a list of links and not "Pricing dot Questions".
 *
 * It belongs to the `<li>` and not to a `<span>` inside it, which is the whole trick:
 * `last:after:hidden` then means "the final *item* has no trailing dot". A dot rendered as
 * its own element would be the last child of every `<li>`, so `last:` would match all of
 * them and hide the lot.
 */
function LinkRow({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
      {children}
    </ul>
  );
}

/**
 * One navigation link. Darkens to full ink on hover; nothing moves.
 *
 * `whitespace-nowrap` is load-bearing rather than tidy: these are clickable affordances in
 * a wrapping row, and a label breaking mid-phrase ("Salons in / Thimphu") reads as a
 * styling error rather than as one link. The row wraps between items instead.
 */
function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li className="after:bg-border-strong flex items-center gap-3 after:size-0.5 after:shrink-0 after:rounded-full after:content-[''] last:after:hidden">
      <a
        href={href}
        className="text-body hover:text-ink text-body-sm whitespace-nowrap transition-colors duration-200"
      >
        {children}
      </a>
    </li>
  );
}

/**
 * A labelled contact row. The label is visible rather than `sr-only` because "Email" above
 * an address is useful to everybody, not only a screen reader — and a bare
 * `+975 17 71 65 23` under a bare address reads as one block of text.
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
