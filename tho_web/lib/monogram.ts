/**
 * The seeded fallback tile every salon and person gets when there is no photo, or
 * when the one on record fails to load.
 *
 * Ported from `tho/app/lib/ui/widgets/cover_image.dart`, and **seeded by the first
 * code unit of the label exactly as the Dart is**, so a given salon gets the same
 * colours on both platforms. 4 of the 13 live salons have no cover, so this is the
 * common path rather than the edge case.
 *
 * It lives in `lib/` rather than beside `CoverImage` because the map needs it too,
 * and the map cannot use the component: Leaflet owns the DOM inside a marker, so a
 * bubble is an HTML string handed to `L.divIcon`. Two implementations of "which
 * gradient is Norzin" would drift the moment one of them gained a colour, and the
 * marker and the card sitting on the same screen would disagree.
 *
 * Both forms of every palette are given, because the two callers need different
 * things: Tailwind classes for the component, raw hex for the injected string —
 * where a class name depends on Tailwind's scanner having seen it inside a template
 * literal, and an inline gradient does not.
 */

export type Palette = {
  /** `bg-gradient-to-br` stops, for a React component. */
  className: string;
  /** The same two colours, for an inline `linear-gradient(...)`. */
  from: string;
  to: string;
};

const PALETTES: readonly Palette[] = [
  { className: "from-[#FFE1E8] to-[#FFB3C4]", from: "#FFE1E8", to: "#FFB3C4" },
  { className: "from-[#FFE9D6] to-[#FFC59E]", from: "#FFE9D6", to: "#FFC59E" },
  { className: "from-[#E7E1FF] to-[#C3B3FF]", from: "#E7E1FF", to: "#C3B3FF" },
  { className: "from-[#DFF3EA] to-[#A7DCC5]", from: "#DFF3EA", to: "#A7DCC5" },
  { className: "from-[#FDE7F3] to-[#F3B3D6]", from: "#FDE7F3", to: "#F3B3D6" },
];

export function paletteFor(label: string): Palette {
  const seed = label.length === 0 ? 0 : label.charCodeAt(0);
  return PALETTES[seed % PALETTES.length]!;
}

/**
 * The single character a cover falls back to. Decorative in every use — the name is
 * always in text beside it — so it never needs to be more than one letter.
 */
export function monogramInitial(label: string): string {
  return (label.trim()[0] ?? "?").toUpperCase();
}
