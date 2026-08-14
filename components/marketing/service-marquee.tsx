import { services } from "@/lib/marketing/content";
import { MotifDiamond } from "./ui/bhutan";
import { Marquee } from "./ui/marquee";

/**
 * What you can book — the reference's **category strip**, between the hero and the
 * first content band.
 *
 * It used to be the same eight words at `2rem` in medium ink with a saffron diamond
 * between each, drifting past on a velocity-linked ticker. At that size it was the
 * second-biggest type on the page and it sat directly under the headline, so the
 * first thing below the fold competed with the first thing above it — for a row of
 * labels that is texture, not content.
 *
 * The reference's `category-strip` is the opposite: `button-sm` labels, muted, on
 * the canvas, closed by a hairline. So the words are pills at the UI size now, and
 * the band is a hairline sandwich. It still moves, because the drift is the one
 * thing the strip was genuinely good at, and `Marquee`'s own `overflow-hidden`
 * keeps the track from ever widening the document.
 */
export function ServiceMarquee() {
  return (
    <div
      className="border-hairline-soft border-y"
      aria-label="Services you can book"
    >
      <Marquee speed={1.6}>
        {services.map((service) => (
          <span key={service} className="px-1.5 py-4 sm:py-5">
            <span className="ring-hairline text-ink text-ui inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium whitespace-nowrap ring-1 ring-inset">
              <MotifDiamond className="text-rausch/55 size-3.5" />
              {service}
            </span>
          </span>
        ))}
      </Marquee>
    </div>
  );
}
