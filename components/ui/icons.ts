import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  BellDot,
  CalendarCheck,
  CalendarDays,
  CalendarSync,
  CalendarX,
  Camera,
  ChartColumn,
  ChartLine,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Compass,
  CreditCard,
  Eye,
  EyeOff,
  Filter,
  FilterX,
  Footprints,
  Gift,
  Grid3x3,
  Hand,
  Heart,
  ImagePlus,
  Images,
  Inbox,
  Landmark,
  Link2,
  Loader2,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Receipt,
  StickyNote,
  Ticket,
  Image as ImageIcon,
  Info,
  ListOrdered,
  Lock,
  LockOpen,
  Mail,
  Minus,
  MapPin,
  Map as MapIcon,
  MessageCircle,
  MonitorPlay,
  Navigation,
  Package,
  Pause,
  Phone,
  Play,
  QrCode,
  RotateCcw,
  Scissors,
  Search,
  SearchX,
  SquarePen,
  Send,
  Settings,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Tag,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  Wallet,
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
  /**
   * The collapse-nav trigger. New with the header that replaced the bottom tab bars —
   * a phone app with a tab bar never needs a hamburger, so the set had no glyph for one.
   * Pairs with `close`, which is what the button becomes while the panel is open.
   */
  menu: Menu,
  share: Share2,
  settings: Settings,
  add: Plus,
  /**
   * Paired with `add`, and used for exactly one thing: one fewer of something in a cart. Never a
   * "remove" — `trash` is that, and the difference matters on a quantity stepper where the minus at
   * a count of 1 *does* remove the line but still reads as counting down.
   */
  minus: Minus,
  logout: LogOut,
  /** Copy a link to the clipboard — the owner's queue QR sheet. */
  copy: Copy,
  /** `AppIcons.edit` — open the row you tapped for editing. A pencil on paper. */
  edit: SquarePen,
  /**
   * Remove a photo. `close` is for dismissing a sheet and `filterOff` for clearing a
   * filter — this is the only glyph that means the thing itself is going away, which is
   * why it is a bin rather than a third X.
   */
  trash: Trash2,

  // ------------------------------------------------------------------ search --
  search: Search,
  searchEmpty: SearchX,
  /** The funnel. One concept, one name — nothing here sorts. */
  filter: Filter,
  /** A filter that matched nothing — an empty tab, not an empty inbox. */
  filterOff: FilterX,

  // ------------------------------------------------------------------ status --
  offline: WifiOff,
  error: AlertCircle,
  info: Info,
  success: CheckCircle2,
  /** The password reveal toggle. Paired: one concept, two states. */
  visible: Eye,
  hidden: EyeOff,
  /** A feature this salon's plan doesn't include — never a security padlock. */
  locked: Lock,
  /**
   * The same idea, aspirational rather than closed — the paywall's own glyph, which the
   * app draws in coral at the top of the sheet. Paired with `locked`: the empty state
   * that *sends* you there is shut, the sheet that explains it is open.
   */
  unlocked: LockOpen,
  /**
   * `AppIcons.verified` — a badge, used for one thing only: a staff row whose login is
   * linked. Distinct from `success`, which is a transient "that worked"; this is a
   * standing state of the row.
   */
  verified: BadgeCheck,
  /** Attach a login to a staff member, or copy a link's idea of itself. */
  link: Link2,

  // --------------------------------------------------------------- the salon --
  salon: Store,
  haircut: Scissors,
  person: User,
  people: Users,
  /** Add someone to the roster. Paired with `people`: the list, and adding to it. */
  personAdd: UserPlus,
  /**
   * `AppIcons.sparkle` — the "Browse common services" action. An explicit alias of the
   * glyph `serviceBarber` and `serviceMakeup` already use, not a second spelling: what it
   * means here is "from the catalogue", and no other icon in the set says that.
   */
  sparkle: Sparkles,
  /**
   * A break in the working day — the gap between two segments of a shift. The app's
   * `Restaurant02`; lucide has `UtensilsCrossed`, but a coffee cup reads as a break rather
   * than as a meal being served, and this pill sits in a hours grid, not a menu.
   */
  lunch: Coffee,
  queue: ListOrdered,
  /**
   * `AppIcons.walkIn` — someone who arrived without an appointment. Footprints, not a
   * person: `person` and `people` are already taken by who somebody *is*, and this is
   * about how they got here. Used for both owner walk-in paths, which are different
   * actions on the same idea — adding someone to the live line, and booking a slot for
   * someone standing at the counter.
   */
  walkIn: Footprints,
  /**
   * `AppIcons.insights` — the owner's numbers. A column chart, matching the app's
   * `analytics01`, and deliberately not `TrendingUp`: the tab shows takings and
   * utilisation whether they went up or down, and an arrow would editorialise.
   */
  insights: ChartColumn,
  /**
   * `AppIcons.chartLine` — a **series over time**, as opposed to `insights`, which is the
   * tab. The revenue trend's own empty state uses it, and it is the only place in the app
   * where the shape of the chart is the subject.
   */
  chartLine: ChartLine,
  /**
   * `AppIcons.heatmap` — the peak-hours grid. A 3×3 lattice: lucide has no heatmap glyph,
   * and every alternative (`LayoutGrid`, `Table2`) reads as a layout or a spreadsheet.
   */
  heatmap: Grid3x3,
  /**
   * A tick on its own, for a feature line in a plan card. Deliberately **not** `success` —
   * that is a ringed tick announcing something just worked, and a plan's feature list is a
   * standing fact, so a ring on nine rows would be nine little celebrations.
   */
  check: Check,
  /**
   * Which way a figure moved. The only two icons in the set that editorialise, and that is
   * the point: they sit beside a delta whose sign is the whole message. `insights` stays a
   * neutral column chart for exactly this reason.
   */
  trendUp: TrendingUp,
  trendDown: TrendingDown,

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
  /** A booking that moved. The app's `refresh`; a calendar says what moved. */
  bookingRescheduled: CalendarSync,
  clock: Clock,
  timer: Timer,
  /**
   * Work in flight. Needs `animate-spin` at the call site — an icon map returns a glyph,
   * not a behaviour, and the same shape is wanted static in a few places.
   *
   * `Button` reaches for `Loader2` directly, which predates this entry and is the one
   * exception to the "never `lucide-react` in a component" rule left in the kit. Point new
   * call sites here.
   */
  spinner: Loader2,

  // ---------------------------------------------------------------- the till --
  gift: Gift,
  offer: Tag,
  reward: Trophy,
  shopBag: ShoppingBag,
  /**
   * The cart itself, as distinct from `shopBag` — which is the *shop*, and already means "orders"
   * on both sides of the app. A trolley is the thing you are filling; a bag is what you leave with.
   */
  cart: ShoppingCart,
  product: Package,
  qr: QrCode,
  receipt: Receipt,
  ticket: Ticket,
  payment: CreditCard,
  /**
   * `AppIcons.payroll` — what the salon pays *out*, where `payment` is what comes *in*. A
   * wallet against a card: the card is the customer's, the wallet is the salon's.
   */
  payroll: Wallet,
  /**
   * `AppIcons.tax` — a government building. `Percent` was the other candidate and is worse:
   * a percentage already means a discount everywhere else in this app (`offer`), and the tax
   * page is about who you owe rather than a rate.
   */
  tax: Landmark,
  /**
   * `AppIcons.premium` — the subscription itself, on the Plan & billing row. A crown, not
   * `locked`: that one means *you can't have this*, and an owner reading their own plan page
   * is not being refused anything.
   */
  premium: Crown,

  // -------------------------------------------------------------------- talk --
  chat: MessageCircle,
  send: Send,
  notification: Bell,
  /** The bell with something in it. Paired with `notification`: one concept, two states. */
  notificationActive: BellDot,
  phone: Phone,
  /** `AppIcons.mail` — the email row on Profile, which is a fact and not a channel. */
  mail: Mail,
  /**
   * `AppIcons.inbox` — a queue of things waiting for the owner to act. Used for the
   * redemptions list and its empty state. Distinct from `notification`, which is a bell that
   * *tells* you: an inbox is work, a bell is news.
   */
  inbox: Inbox,
  /**
   * `AppIcons.note` — the salon's private note about a client. A sticky note, and never
   * `edit`: this glyph marks a row that *has* one, which is a property of the client rather
   * than an action on them.
   */
  note: StickyNote,
  /** `AppIcons.more` — an overflow menu. Horizontal, matching the app's own dots. */
  more: MoreHorizontal,

  // ------------------------------------------------------------------- media --
  imageMissing: ImageIcon,
  camera: Camera,
  addPhoto: ImagePlus,
  /** `AppIcons.photos` — a set of them, for the gallery section header. */
  photos: Images,

  // ------------------------------------------------------------- the places --
  location: MapPin,
  map: MapIcon,
  nearMe: Navigation,
  discover: Compass,

  // ------------------------------------------------------------- the guide --
  /**
   * The in-product walkthrough — the floating "How it works" button and nothing else.
   * A screen with a play badge, because that is literally what the guide is: real
   * screenshots of this app, played in order. Deliberately not `info` (a fact about the
   * thing you are looking at) and not `help` (there is no help glyph and no help centre
   * to send anyone to).
   */
  guide: MonitorPlay,
  /**
   * Transport for that walkthrough. Paired, one concept in two states, the same way
   * `visible`/`hidden` and `notification`/`notificationActive` are — the button shows the
   * action it will *take*, so a running guide wears `pause`.
   */
  play: Play,
  pause: Pause,
  /** Back to the first frame once the guide has run out. Never a generic "refresh". */
  restart: RotateCcw,
  /**
   * The guide's narration, on and off. Paired like `visible`/`hidden`, and the button shows
   * the state it is *in* rather than the action it takes — a speaker with a line through it
   * is the one thing everybody already reads as "muted".
   */
  sound: Volume2,
  soundOff: VolumeX,

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
