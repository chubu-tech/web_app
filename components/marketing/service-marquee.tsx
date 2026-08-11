import { services } from "@/lib/marketing/content";
import { MotifDiamond } from "./ui/bhutan";
import { Marquee } from "./ui/marquee";

/**
 * The services ticker — a one-line texture band between the hero and the first
 * content section, separated by the woven-diamond motif.
 */
export function ServiceMarquee() {
  return (
    <div
      className="border-hairline-soft border-y py-6 sm:py-8"
      aria-label="Services you can book"
    >
      <Marquee>
        {services.map((service) => (
          <span key={service} className="flex items-center">
            <span className="text-ink px-6 text-[1.5rem] font-medium tracking-tight whitespace-nowrap sm:px-8 sm:text-[2rem]">
              {service}
            </span>
            <MotifDiamond className="text-saffron size-5" />
          </span>
        ))}
      </Marquee>
    </div>
  );
}
