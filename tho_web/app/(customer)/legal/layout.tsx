/**
 * The reading column for the four policy pages.
 *
 * One layout rather than four copies of the same wrapper, and it is deliberately narrower
 * than the rest of the customer side: these are documents, and a 1128px measure is the
 * wrong line length for prose somebody has to actually read. 680px lands around 75
 * characters at the body size.
 *
 * No shared heading or breadcrumb — each page states what it is, and a "Legal" crumb
 * above a page titled "Terms of Service" is a word that adds nothing.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-base py-xl tablet:px-lg mx-auto w-full max-w-[680px]">{children}</div>
  );
}
