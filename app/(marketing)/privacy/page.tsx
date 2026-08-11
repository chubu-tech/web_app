import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Container } from "@/components/marketing/ui/section";
import { brand, legal, privacy } from "@/lib/marketing/content";

/**
 * `/privacy` — a store requirement, not a marketing page.
 *
 * Google Play and the App Store both refuse a listing without a reachable
 * privacy-policy URL, and a reviewer reads this page. So it is plain, static and
 * has no animation: nothing here should be able to fail to render. The copy
 * lives in `lib/content.ts` alongside every other string on the site.
 *
 * Deliberately narrower than the marketing bands and set at a longer measure —
 * this is a document to be read, not a page to be scanned.
 */
export const metadata: Metadata = {
  title: privacy.title,
  description: privacy.description,
  alternates: { canonical: "/privacy" },
  // Indexable on purpose: store reviewers and users should be able to find it.
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1 pt-28 pb-24 sm:pt-32">
        <Container>
          <article className="mx-auto max-w-[46rem]">
            <h1 className="text-editorial-lg font-semibold">
              {privacy.title}
            </h1>

            <p className="text-muted mt-6 text-ui leading-relaxed">
              Last updated: <strong className="text-body">{legal.lastUpdated}</strong>.
              Operated by{" "}
              <strong className="text-body">{legal.operator}</strong>,{" "}
              {legal.jurisdiction}. Contact:{" "}
              <a
                href={`mailto:${legal.contactEmail}`}
                className="text-rausch underline decoration-from-font underline-offset-2"
              >
                {legal.contactEmail}
              </a>
              .
            </p>

            <div className="bg-hairline-soft mt-10 h-px" />

            {privacy.sections.map((section) => (
              <section key={section.title} className="mt-12 first:mt-10">
                <h2 className="text-ink text-heading leading-snug font-semibold">
                  {section.title}
                </h2>

                {"body" in section && section.body && (
                  <p className="text-body mt-4 text-body-lg leading-relaxed">
                    {section.body}
                  </p>
                )}

                {"items" in section && section.items && (
                  <ul className="mt-5 flex flex-col gap-3.5">
                    {section.items.map((item) => (
                      <li
                        key={item.body}
                        className="text-body relative pl-5 text-body-lg leading-relaxed"
                      >
                        <span
                          className="bg-rausch absolute top-[0.6em] left-0 size-1.5 rounded-full"
                          aria-hidden
                        />
                        {"lead" in item && item.lead && (
                          <>
                            <strong className="text-ink font-semibold">
                              {item.lead}
                            </strong>
                            {" — "}
                          </>
                        )}
                        {item.body}
                      </li>
                    ))}
                  </ul>
                )}

                {"footnote" in section && section.footnote && (
                  <p className="text-body mt-5 text-body-lg leading-relaxed">
                    {section.footnote}
                  </p>
                )}
              </section>
            ))}

            <section className="mt-12">
              <h2 className="text-ink text-heading leading-snug font-semibold">
                Contact
              </h2>
              <p className="text-body mt-4 text-body-lg leading-relaxed">
                Questions or requests:{" "}
                <a
                  href={`mailto:${legal.contactEmail}`}
                  className="text-rausch underline decoration-from-font underline-offset-2"
                >
                  {legal.contactEmail}
                </a>
                .
              </p>
            </section>

            <p className="text-muted mt-14 text-ui">
              <Link href="/" className="hover:text-ink transition-colors">
                {brand.name}
              </Link>{" "}
              · Built in Bhutan, for Bhutan.
            </p>
          </article>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
