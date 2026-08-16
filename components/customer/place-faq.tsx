/**
 * The question-and-answer block on a place page.
 *
 * **A server component with no open/closed state, and that is the point.** The marketing
 * homepage's accordion had to be taught to keep its answers in the DOM (see
 * `components/marketing/faq.tsx`); this one never had the chance to get that wrong,
 * because every answer is plain markup that is always present. An answer engine quotes
 * what it can retrieve without running JavaScript, and these answers are the whole reason
 * a place page can be the source for *"how much does a haircut cost in Thimphu"*.
 *
 * `<dl>` rather than a list of headings: this is literally a set of terms and their
 * descriptions, the semantics are exact, and it gives each question a real element
 * without spending a heading level. The `<dt>` carries an `<h3>` so the questions still
 * appear in the document outline under the page's `h2`s.
 *
 * The same array is passed to `faqSchema` by the page, so the marked-up answer and the
 * visible answer are the same string by construction — which is what Google's
 * structured-data policy requires and what stops the two drifting apart later.
 */
export function PlaceFaq({
  items,
  place,
}: {
  items: readonly { q: string; a: string }[];
  place: string;
}) {
  return (
    <section className="mt-xl" aria-labelledby="place-faq-heading">
      <h2 id="place-faq-heading" className="text-display-md text-ink mb-md font-semibold">
        Booking a salon in {place}
      </h2>
      <dl className="max-w-[52rem]">
        {items.map((item) => (
          <div key={item.q} className="border-hairline-soft py-base border-b first:border-t">
            <dt>
              <h3 className="text-title text-ink font-semibold">{item.q}</h3>
            </dt>
            <dd className="text-body-md text-body mt-xs">{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
