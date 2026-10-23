# Meme Royale

A daily meme caption battle. One meme template drops for everyone each day. Write up to 2 captions (max 8 words each), vote head to head on other people's captions in the evening, and the funniest caption wins the day. Built as a mobile-first web app (PWA) with React, Vite, and Supabase.

## Renaming the app

The name lives in src/config.js (APP_NAME). Also change "name" and "short_name" in public/manifest.json. Nothing else needs editing.

## Files

package.json, vite.config.js, index.html: project setup
public/manifest.json: makes it installable on a phone
.env.example: template for your Supabase keys
supabase/schema.sql: the whole database (tables, rules, vote logic, midnight rollover)
supabase/seed.sql: 3 example meme templates and example captions
src/config.js: all game settings (name, word limit, vote unlock count, voting hour)
src/supabase.js: connects to Supabase
src/App.jsx, src/main.jsx: app shell, routing, login check
src/styles.css: mobile-first styles
src/lib/game.js: Elo math, word count, placeholder moderation, AI moderation hook
src/lib/cardGenerator.js: builds the shareable winner card PNG (HTML to image)
src/pages/: Login, Today, Write, Vote, Results, Profile

## Run it locally

1. Install Node.js 20 or newer from nodejs.org.
2. Open a terminal in the capbattle folder and run: npm install
3. Copy .env.example to .env.local and fill in your Supabase URL and anon key.
4. Run: npm run dev. Open the address it prints (usually http://localhost:5173).

## Set up Supabase (free tier)

1. Go to supabase.com, sign up, and create a new project. Save the database password.
2. Open SQL Editor, paste all of supabase/schema.sql, and click Run.
3. Paste supabase/seed.sql and Run. (The caption part works after you log in once.)
4. Go to Project Settings > API. Copy the Project URL and the anon public key into .env.local.
5. Go to Authentication > URL Configuration. Set the Site URL to your local address now, and to your Vercel address after you deploy.
6. Turn on the midnight rollover: Database > Extensions, enable pg_cron. Then in SQL Editor run the cron.schedule line at the bottom of schema.sql (uncomment it first).
7. For testing, set VOTE_OPEN_HOUR to 0 in src/config.js so voting is always open.

## Deploy free on Vercel

1. Push this folder to a GitHub repository.
2. Go to vercel.com, sign in with GitHub, click Add New Project, and pick the repo.
3. Framework: Vite. Build command: npm run build. Output: dist.
4. Add environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (same values as .env.local).
5. Deploy. Then add your Vercel URL to the Supabase Site URL (step 5 above).

## How the rules work

Captions: max 8 words, max 2 per person per day. The database enforces both.
Voting: you see random pairs of other people's captions. You cannot vote on your own. No vote counts show while voting is open.
Unlock: your captions only enter the pool after you cast MIN_VOTES_TO_UNLOCK votes that day.
Ranking: every vote updates both captions' Elo scores (K = 32).
Winner: highest Elo at midnight. People's champ: most raw votes.
Moderation: the placeholder word list flags captions automatically. Swap in an AI check in src/lib/game.js (aiModerateCaption) or moderate_text in schema.sql.
Reports: 3 reports hide a caption. Repeat offenders (3 strikes) get a 24 hour timeout.
Streaks: a day counts when you both submitted and voted.

## Still to do (next steps)

Push notifications: the push_subscriptions table is ready. Add a service worker and send pushes from an Edge Function.
Winner card: the card generator is ready. Add a real image host for templates so the card can load them.
Real AI moderation: wire aiModerateCaption to an Edge Function that calls an AI model.
Time zones: the midnight rollover runs on UTC. Adjust the cron time for your audience.
