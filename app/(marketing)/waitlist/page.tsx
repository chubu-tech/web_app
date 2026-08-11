import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Scissors } from "lucide-react";
import { WaitlistPageForm } from "@/components/marketing/waitlist-page-form";
import { MountainRule } from "@/components/marketing/ui/bhutan";
import { brand, waitlist } from "@/lib/marketing/content";
import { parseHeading } from "@/lib/marketing/heading";

export const metadata: Metadata = {
  title: waitlist.page.title,
  description: waitlist.page.description,
  alternates: { canonical: "/waitlist" },
  // A signup form has nothing to rank for, and indexing it would compete with
  // the page that does the explaining. Followed, so the link back still counts.
  robots: { index: false, follow: true },
};

/**
 * `/waitlist` — the same form as the modal, at a URL.
 *
 * It exists because **a camera cannot open a modal.** The QR in the download
 * band resolves here, and so does anyone who bookmarks or shares the link.
 *
 * The route stays prerendered. `?src=` is read in the browser rather than here
 * (see `WaitlistPageForm`) precisely to keep it that way — awaiting
 * `searchParams` in this component turns the page dynamic, and a static
 * marketing site should not grow a per-request render for a form.
 */
export default function WaitlistPage() {
  const lines = parseHeading(waitlist.title);

  return (
    <main id="main" className="flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-[36rem] flex-1 flex-col justify-center px-5 py-16 sm:px-8">
        <Link
          href="/"
          className="text-body hover:text-ink group inline-flex items-center gap-2 self-start text-ui font-medium transition-colors"
        >
          <ArrowLeft
            className="size-4 transition-transform duration-300 group-hover:-translate-x-0.5"
            aria-hidden
          />
          {waitlist.page.back}
        </Link>

        <div className="mt-10">
          <span className="bg-rausch grid size-11 place-items-center rounded-2xl text-white">
            <Scissors className="size-5" strokeWidth={2.2} aria-hidden />
          </span>

          <span className="text-rausch mt-7 block text-caption-sm font-semibold tracking-[0.16em] uppercase">
            {waitlist.eyebrow}
          </span>

          {/* `text-editorial-lg` clamps 30-48px and carries its own leading and
              tracking, so the manual pair and the `sm:` step both go. */}
          <h1 className="text-ink text-editorial-lg mt-3 font-semibold">
            {lines.map((line, lineIndex) => (
              <span key={lineIndex} className="block">
                {line.map((word, wordIndex) =>
                  typeof word === "string" ? (
                    <span key={wordIndex}>{word} </span>
                  ) : (
                    <span key={wordIndex} className="font-normal tracking-[-0.01em]">
                      {word.text}{" "}
                    </span>
                  ),
                )}
              </span>
            ))}
          </h1>

          <p className="text-body mt-4 text-body-lg leading-relaxed">
            {waitlist.body}
          </p>

          {/* The fallback reserves the form's height so the page does not
              reflow when hydration fills the source in. */}
          <Suspense fallback={<div className="mt-9 h-[6.5rem]" aria-hidden />}>
            <WaitlistPageForm className="mt-9" />
          </Suspense>
        </div>
      </div>

      <MountainRule className="text-sand h-16 w-full shrink-0 sm:h-20" />
      <p className="text-body/60 pb-8 text-center text-caption">
        {brand.name} · {brand.cities.join(" · ")}
      </p>
    </main>
  );
}
