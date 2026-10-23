// Game rules helpers that run in the browser.
// The real rules live in the database (supabase/schema.sql). These helpers mirror them for the UI.
import { MAX_WORDS } from '../config'

// ---- Elo (same math as the cast_vote function in SQL) ----
export const K_FACTOR = 32

// Chance (0 to 1) that a caption rated ratingA beats one rated ratingB
export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

// Returns the new ratings after one head-to-head vote
export function newRatings(winnerRating, loserRating) {
  const e = expectedScore(winnerRating, loserRating)
  return {
    winner: Math.round(winnerRating + K_FACTOR * (1 - e)),
    loser: Math.round(loserRating - K_FACTOR * (1 - e)),
  }
}

// ---- Caption checks ----
export function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function captionIsTooLong(text) {
  return wordCount(text) > MAX_WORDS
}

// Placeholder moderation: a tiny word list. Replace the list, or call an AI moderation
// service from aiModerateCaption() below. The database has its own copy (moderate_text).
const BLOCKED_WORDS = ['replace_me_bad_word_1', 'replace_me_bad_word_2']

export function moderateCaption(text) {
  const lower = text.toLowerCase()
  const hit = BLOCKED_WORDS.find((w) => new RegExp(`\\b${w}\\b`).test(lower))
  return hit ? { flagged: true, reason: 'blocked word' } : { flagged: false, reason: null }
}

// AI moderation hook. Later: call a Supabase Edge Function that asks an AI model
// "is this caption hateful, sexual, or harassing?" and return { flagged, reason }.
// For now it always lets the caption through (the word list above still runs).
export async function aiModerateCaption(text) {
  return { flagged: false, reason: null, text }
}
