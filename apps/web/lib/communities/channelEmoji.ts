// Per-channel emoji, stored as a prefix in the community name (e.g. "💼 Trabajo").
// This keeps the feature fully front-end: no backend column / migration, and the
// emoji travels with the (already-shared) channel name. The list/header parse the
// leading emoji out for the avatar; everywhere else the name reads naturally.

// Curated set, handy for a language academy's channels.
export const CHANNEL_EMOJIS: string[] = [
  '💬', '📣', '❓', '🗣️', '🇳🇱', '📚', '🎓', '✍️',
  '🎧', '👋', '🎉', '💡', '☕', '📝', '🏆', '🤝',
  '🎯', '📌', '🎬', '🔥',
]

// Matches a single leading emoji: a country flag (two regional indicators) or an
// extended pictographic with optional variation selector (U+FE0F), skin-tone
// modifier, or ZWJ (U+200D) sequence.
const LEADING_EMOJI =
  /^(\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:️|[\u{1F3FB}-\u{1F3FF}]|‍\p{Extended_Pictographic}(?:️|[\u{1F3FB}-\u{1F3FF}])?)*)\s*/u

export function splitChannelEmoji(name: string): { emoji: string | null; text: string } {
  if (!name) return { emoji: null, text: '' }
  const m = name.match(LEADING_EMOJI)
  if (m) return { emoji: m[1], text: name.slice(m[0].length) }
  return { emoji: null, text: name }
}

export function joinChannelEmoji(emoji: string | null | undefined, text: string): string {
  const t = (text ?? '').trim()
  if (!emoji) return t
  return `${emoji} ${t}`.trim()
}
