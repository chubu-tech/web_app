import { MapPin, MessageCircle, Scissors } from "lucide-react";
import { brand, footer } from "@/lib/content";
import { TextileRule } from "./ui/bhutan";
import { Reveal } from "./ui/reveal";
import { Container } from "./ui/section";
import { StoreBadges } from "./ui/store-badges";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-obsidian pt-16 text-white sm:pt-20">
      <Container>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal>
              <span className="flex items-center gap-2.5">
                <span className="bg-rausch grid size-9 place-items-center rounded-xl text-white">
                  <Scissors className="size-[1.1rem]" strokeWidth={2.2} aria-hidden />
                </span>
                <span className="text-[1.0625rem] font-semibold">
                  {brand.name}
                </span>
              </span>
              <TextileRule className="mt-5 w-28" />
              <p className="mt-5 max-w-sm text-[0.9375rem] leading-relaxed text-white/60">
                Book a chair or scan to join the queue — free for customers,
                always. Salons run the whole shop from one screen.
              </p>
              <StoreBadges tone="light" className="mt-6" />
            </Reveal>
          </div>

          <nav
            aria-label="Footer"
            className="grid gap-10 sm:grid-cols-2 lg:col-span-5 lg:col-start-8"
          >
            {footer.columns.map((column) => (
              <Reveal key={column.title} delay={0.05}>
                <h2 className="text-[0.6875rem] font-semibold tracking-[0.16em] text-white/45 uppercase">
                  {column.title}
                </h2>
                <ul className="mt-5 flex flex-col gap-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-[0.9375rem] text-white/70 transition-colors duration-200 hover:text-white"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </nav>
        </div>

        {/* Coverage strip. */}
        <div className="mt-14 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 pt-8">
          <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold tracking-[0.14em] text-white/45 uppercase">
            <MapPin className="size-3.5" strokeWidth={2.2} aria-hidden />
            Now serving
          </span>
          {footer.cities.map((city) => (
            <span
              key={city}
              className="rounded-full bg-white/8 px-3 py-1.5 text-[0.8125rem] text-white/70"
            >
              {city}
            </span>
          ))}
          <a
            href={`https://wa.me/${brand.whatsapp.replace(/\D/g, "")}`}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[0.875rem] font-medium ring-1 ring-white/15 ring-inset transition-colors duration-300 hover:bg-white/16"
          >
            <MessageCircle className="size-4" strokeWidth={2} aria-hidden />
            {brand.whatsapp}
          </a>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 py-7 text-[0.8125rem] text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {year} {brand.name}. Built in Bhutan.
          </span>
          <a
            href={`mailto:${brand.supportEmail}`}
            className="transition-colors hover:text-white/80"
          >
            {brand.supportEmail}
          </a>
        </div>
      </Container>
    </footer>
  );
}
