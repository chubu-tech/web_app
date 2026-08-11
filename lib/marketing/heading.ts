/**
 * Display-heading parsing. Lives outside the client component so server
 * components can call it while `<TextReveal>` stays a client boundary.
 */

/** A word in a display heading. Objects opt into the accent style. */
export type RevealWord = string | { text: string; accent?: boolean };

/** Lines of words. */
export type RevealLines = readonly (readonly RevealWord[])[];

/**
 * Parse a heading string into `TextReveal` lines. Words wrapped in underscores
 * become accents — a weight drop against the heading, not a second family — and
 * `|` forces a line break.
 *
 *   parseHeading("Run the whole shop from _one screen_")
 */
export function parseHeading(input: string): RevealLines {
  return input.split("|").map((line) =>
    line
      .trim()
      .split(/(_[^_]+_)/g)
      .filter(Boolean)
      .flatMap<RevealWord>((chunk) => {
        const accent = chunk.startsWith("_") && chunk.endsWith("_");
        const text = accent ? chunk.slice(1, -1) : chunk;
        return text
          .split(" ")
          .filter(Boolean)
          .map((w) => (accent ? { text: w, accent: true } : w));
      }),
  );
}
