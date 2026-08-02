/** Join conditional class names. Kept dependency-free on purpose. */
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
