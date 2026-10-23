// ONE PLACE FOR SETTINGS. Change the app name here and nowhere else in the app code.
// (public/manifest.json also has the name for the installed-app icon. Change it there too.)

export const APP_NAME = 'Meme Royale'

// Caption rules (also enforced in supabase/schema.sql, keep both in sync)
export const MAX_WORDS = 8
export const MAX_CAPTIONS_PER_DAY = 2

// A caption only enters the pool after its author has voted this many times that day
export const MIN_VOTES_TO_UNLOCK = 5

// Local hour (0-23) when the evening voting round opens. Client-side gate in this MVP.
// Set it to 0 while testing so voting is always open.
export const VOTE_OPEN_HOUR = 18
