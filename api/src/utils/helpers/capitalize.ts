/** "kofi   mensah" -> "Kofi Mensah", "ama-serwaa" -> "Ama-Serwaa". Non-strings are returned unchanged. */
export function capitalizeWords<T>(value: T): T {
  if (typeof value !== "string") return value;

  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/(^|[\s\-'])(\p{L})/gu, (_m, sep: string, letter: string) => sep + letter.toUpperCase()) as T;
}

/** "patient has fever. BP high" -> "Patient has fever. BP high". Only the first letter changes. */
export function capitalizeFirst<T>(value: T): T {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return trimmed as T;
  return (trimmed.charAt(0).toUpperCase() + trimmed.slice(1)) as T;
}

export interface TextCaseRules<T> {
  /** Every word capitalized: names, places, titles */
  words?: readonly (keyof T)[];
  /** Only the first letter capitalized: remarks, notes, descriptions */
  sentence?: readonly (keyof T)[];
}

/**
 * Returns a copy of `obj` with the listed fields re-cased.
 * Missing or non-string fields are left alone, so partial updates stay partial.
 */
export function applyTextCase<T extends object>(obj: T, rules: TextCaseRules<T>): T {
  const copy = { ...obj } as Record<keyof T, unknown>;

  for (const field of rules.words ?? []) {
    if (typeof copy[field] === "string") copy[field] = capitalizeWords(copy[field]);
  }
  for (const field of rules.sentence ?? []) {
    if (typeof copy[field] === "string") copy[field] = capitalizeFirst(copy[field]);
  }
  return copy as T;
}