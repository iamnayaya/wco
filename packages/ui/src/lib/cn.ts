/** Classname joiner — dependency-free (mirrors apps/frontend/src/lib/utils/format.ts). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}