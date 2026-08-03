import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarCheck,
  CalendarDays,
  CalendarX,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Eye,
  EyeOff,
  Filter,
  Gift,
  Hand,
  Heart,
  ImagePlus,
  LogOut,
  Plus,
  Receipt,
  Ticket,
  Image as ImageIcon,
  Info,
  ListOrdered,
  MapPin,
  Map as MapIcon,
  MessageCircle,
  Navigation,
  Package,
  Phone,
  QrCode,
  Scissors,
  Search,
  SearchX,
  Send,
  Settings,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  Timer,
  Trophy,
  User,
  Users,
  WifiOff,
  X,
} from "lucide-react";

/**
 * Every icon this app uses, named for the **concept** it represents rather than
 * the shape it happens to be — a direct port of the discipline in
 * `tho/app/lib/ui/icons.dart`, and the reason that file exists.
 *
 * The Flutter app drifted into `content_cut` / `content_cut_rounded` /
 * `content_cut_outlined` for one idea because nothing declared "a haircut looks
 * like this". Here there is exactly one `haircut`, and no way to spell it three
 * ways. **Import from this file, never from `lucide-react` directly.**
 *
 * lucide rather than Hugeicons: it is the same stroke-only vocabulary drawn in a
 * 24-unit box, so the app's look carries over, and it is already a dependency.
 * Where lucide has no equivalent of a Hugeicons glyph the app chose
 * deliberately, the note says what was given up.
 */
export const Icons = {
  // ------------------------------------------------------------------ chrome --
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  chevronDown: ChevronDown,
  back: ArrowLeft,
  forward: ArrowRight,
  close: X,
  share: Share2,
  settings: Settings,
  add: Plus,
  logout: LogOut,

  // ------------------------------------------------------------------ search --
  search: Search,
  searchEmpty: SearchX,
  /** The funnel. One concept, one name — nothing here sorts. */
  filter: Filter,

  // ------------------------------------------------------------------ status --
  offline: WifiOff,
  error: AlertCircle,
  info: Info,
  success: CheckCircle2,
  /** The password reveal toggle. Paired: one concept, two states. */
  visible: Eye,
  hidden: EyeOff,

  // --------------------------------------------------------------- the salon --
  salon: Store,
  haircut: Scissors,
  person: User,
  people: Users,
  queue: ListOrdered,

  // Service categories, matched by name in `categoryIcon` below.
  //
  /** An explicit alias, not a second spelling: a haircut is a haircut whether
   *  it is a category circle or a service row. */
  serviceHair: Scissors,
  /** lucide has no barber chair. `Scissors` is already `haircut`, so Barber
   *  takes `Sparkles` — distinct from Hair, and never a second scissors. */
  serviceBarber: Sparkles,
  serviceSpa: Heart,
  /** A hand, for nails. The app's `HandGrip`; lucide's plain `Hand` is the
   *  closest, and unlike Material's `back_hand` it is not a raised STOP palm —
   *  which is exactly the glyph `icons.dart` records having to remove. */
  serviceNail: Hand,
  serviceMakeup: Sparkles,
  serviceFacial: User,

  // --------------------------------------------------------------- the diary --
  booking: CalendarDays,
  bookingConfirmed: CalendarCheck,
  bookingCancelled: CalendarX,
  clock: Clock,
  timer: Timer,

  // ---------------------------------------------------------------- the till --
  gift: Gift,
  offer: Tag,
  reward: Trophy,
  shopBag: ShoppingBag,
  product: Package,
  qr: QrCode,
  receipt: Receipt,
  ticket: Ticket,

  // -------------------------------------------------------------------- talk --
  chat: MessageCircle,
  send: Send,
  notification: Bell,
  phone: Phone,

  // ------------------------------------------------------------------- media --
  imageMissing: ImageIcon,
  camera: Camera,
  addPhoto: ImagePlus,

  // ------------------------------------------------------------- the places --
  location: MapPin,
  map: MapIcon,
  nearMe: Navigation,
  discover: Compass,

  // ------------------------------------------------------- carries a state --
  // lucide is stroke-only too, so these pair with colour and `fill-current`:
  // ink/rausch when on, muted or hairline when off.
  star: Star,
  favourite: Heart,
} as const;

export type IconName = keyof typeof Icons;

/**
 * The icon size scale, sized by the **role** a glyph plays rather than by
 * whatever looked right at the call site — that ad-hoc sizing is what made the
 * app's old Material set read as uneven (`icons.dart:16`).
 *
 * Reach for `md` unless there is a reason not to.
 */
export const IconSize = {
  /** Disclosure chevrons and glyphs beside caption-sized text. */
  xxs: 16,
  /** Inline with body text — meta lines, dense chips. */
  xs: 18,
  /** Dense list rows, badges, compact toolbar affordances. */
  sm: 20,
  /** The default: buttons, list tiles, sheet headers, bottom navigation. */
  md: 24,
  /** A glyph carrying a row alone, or the anchor of a ~56px tinted disc — aim
   *  for 45-50% of the container, so a 56px circle takes this, not `md`. */
  lg: 28,
  /** A feature moment inside a card or sheet. */
  xl: 40,
  /** Empty states — the glyph owns the whole tab body. */
  hero: 56,
} as const;

/**
 * The category glyph, matched on the category's name.
 *
 * A direct port of `ServicesRow.iconFor` (`home_sections.dart:229`), including
 * the substring order: 'hair' is tested before 'barber' there too, so
 * "Barber & Hair" resolves the same on both platforms.
 */
export function categoryIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("hair")) return Icons.serviceHair;
  if (n.includes("barber")) return Icons.serviceBarber;
  if (n.includes("spa") || n.includes("massage")) return Icons.serviceSpa;
  if (n.includes("nail")) return Icons.serviceNail;
  if (n.includes("make")) return Icons.serviceMakeup;
  if (n.includes("facial")) return Icons.serviceFacial;
  return Icons.salon;
}
