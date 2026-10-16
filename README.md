# RoscaTV 📺

A premium, native-feeling iOS PWA to track movies, series, and anime. Built with Next.js 14 App Router, Tailwind CSS, TypeScript, and the TMDB API.

---

## Recent Updates

### Home screen (2026-09-28)
Added a dedicated Home screen (`components/home/HomeScreen.tsx`, `PosterCard.tsx`, `CategorySheet.tsx`) with three sections:
- **Continue Watching** — items with status `watching`, most recently updated first.
- **Coming Soon** — TV items flagged "keep an eye on this," already `watched`, or rated above 8 (item or season level), cross-checked against TMDB's `next_episode_to_air` to surface newly scheduled episodes/seasons.
- **Based on Your Interests** — TMDB recommendations seeded from highly-rated/watched titles, pooled and ranked by how many seeds recommended each title.

Also removed unused legacy UI (`ArcDial.tsx`, `WheelPicker.tsx`, `GearIcon.tsx`, `SearchIcon.tsx`, `SettingsModal.tsx`) and added `MediaTypeIcon.tsx` / `lib/statusStyles.ts`.

Not yet implemented: filtering the "Interests" section by which streaming platforms the user is subscribed to (would need a new settings screen plus TMDB's `/watch/providers` endpoint).

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set your TMDB API Read Access Token
cp .env.local.example .env.local
# Edit .env.local and add:
# NEXT_PUBLIC_TMDB_TOKEN=eyJhbGciOiJIUzI1NiJ9...

# 3. Run locally
npm run dev
```

Get a free TMDB token at: **https://www.themoviedb.org/settings/api**
(Use the "API Read Access Token" — the long JWT string, not the short API key.)

---

## Self-hosted mode: accounts and a server-side library

The Docker image is built with `NEXT_PUBLIC_SERVER_SYNC=1`. In that mode:

- A sign-in screen sits in front of the app (sign in, or create an account). Accounts live in a separate shared accounts service, reached over a private Docker network (`ACCOUNTS_URL`, `ACCOUNTS_SERVICE_TOKEN`); RoscaTV stores no passwords.
- Each user's library and settings are kept by the server in SQLite (`DB_PATH`, default `/app/data/roscatv.db` in the image — mount a host folder on `/app/data`, writable by uid 1001).
- The browser keeps a copy (IndexedDB + localStorage, as before), so the app opens instantly and works offline. Every change is written to the copy and queued; the queue is sent in order whenever the server can be reached. Reopening the app reloads the library from the server.
- The first time an account with an empty library signs in, the library this browser kept before accounts is copied to the server (once; a backup copy stays in localStorage under `rosca_lib_before_account`). Signing out removes this account's copy from the browser.

API (all JSON, session cookie or `Authorization: Bearer <api key>`):

| Method | Path | |
|---|---|---|
| `POST` | `/api/auth/login` · `/api/auth/signup` · `/api/auth/logout` | session |
| `GET` | `/api/auth/me` | the signed-in user |
| `GET` | `/api/library` | `{ library, settings }` |
| `PUT` / `DELETE` | `/api/library/:id` | save one item whole / remove it |
| `PUT` | `/api/settings` | `{ region, sortKey, language }` |
| `POST` | `/api/import` | `{ library, settings }`, only into an empty account |

Server settings go in `.env` next to `docker-compose.yml` (see `.env.example`). Tests: `npm test`.

Builds without the variable (e.g. Vercel) are unchanged: no sign-in, everything stays in the browser.

## Deploy to Vercel

1. Push your fork to GitHub
2. Import at **vercel.com/new**
3. Add environment variable: `NEXT_PUBLIC_TMDB_TOKEN = <your token>`
4. Deploy — done ✅

---

## HOW TO PROPERLY STRUCTURE AND IMPORT YOUR JSON LIBRARY

### Overview

RoscaTV allows you to export your complete library as a `.json` file and import it on any device. When imported, items immediately appear in the Movies, Series, and Anime tabs. Any missing poster images are automatically fetched from TMDB in the background — no restart required.

---

### Exact JSON Schema

The import file must be a JSON object with a top-level `library` key. Each entry inside `library` is keyed by its **numeric TMDB ID**.

```json
{
  "version": 3,
  "exportedAt": "2025-07-13T00:00:00.000Z",
  "library": {
    "550": {
      "id": 550,
      "mediaType": "movie",
      "type": "movies",
      "title": "Fight Club",
      "year": "1999",
      "poster": "",
      "tmdbRating": "8.4",
      "status": "watched",
      "userRating": 9.5,
      "seasonData": {},
      "notes": "Incredible third-act twist.",
      "addedAt": 1720000000000,
      "updatedAt": 1720000100000
    },
    "1396": {
      "id": 1396,
      "mediaType": "tv",
      "type": "series",
      "title": "Breaking Bad",
      "year": "2008",
      "poster": "",
      "tmdbRating": "9.5",
      "status": "watching",
      "userRating": 10.0,
      "seasonData": {
        "1": {
          "rating": 9.5,
          "episodes": {
            "1": true,
            "2": true,
            "3": true,
            "4": true,
            "5": true,
            "6": true,
            "7": true
          }
        },
        "2": {
          "rating": 9.0,
          "episodes": {
            "1": true,
            "2": true,
            "3": false,
            "4": false
          }
        }
      },
      "notes": "Best TV ever made.",
      "addedAt": 1720000000000,
      "updatedAt": 1720000200000
    },
    "31911": {
      "id": 31911,
      "mediaType": "tv",
      "type": "anime",
      "title": "Fullmetal Alchemist: Brotherhood",
      "year": "2009",
      "poster": "",
      "tmdbRating": "9.1",
      "status": "watched",
      "userRating": 9.5,
      "seasonData": {
        "1": {
          "rating": 9.5,
          "episodes": {}
        }
      },
      "notes": "",
      "addedAt": 1720000000000,
      "updatedAt": 1720000000000
    }
  }
}
```

---

### Field Reference

| Field | Type | Required | Accepted values | Description |
|---|---|---|---|---|
| `id` | `number` | ✅ | Any positive integer | TMDB item ID. Must be a **number**, not a string. |
| `mediaType` | `string` | ✅ | `"movie"` · `"tv"` | TMDB media type. Determines which detail endpoint is called for poster sync. |
| `type` | `string` | ✅ | `"movies"` · `"series"` · `"anime"` | Which library tab the item appears in. |
| `title` | `string` | ✅ | Any string | Display title. Refreshed from TMDB if blank during poster sync. |
| `year` | `string` | ✅ | `"2009"` | 4-digit release year string. |
| `poster` | `string` | — | Full `https://` URL or `""` | Leave empty — the app fills this automatically from TMDB. |
| `tmdbRating` | `string` | ✅ | `"8.4"` · `"—"` | TMDB community score. Refreshed if `"—"` during poster sync. |
| `status` | `string` | ✅ | `"pending"` · `"watching"` · `"watched"` | Tracking status. Controls which filter tab the item appears under. |
| `userRating` | `number` \| `undefined` | — | `1.0` – `10.0` (0.5 steps) | Your personal global rating. |
| `seasonData` | `object` | — | See below | Per-season progress and ratings. Empty object `{}` for movies. |
| `seasonData[N].rating` | `number` \| `undefined` | — | `1.0` – `10.0` | Your personal rating for season N. |
| `seasonData[N].episodes` | `object` | — | `{ "1": true, "2": false }` | Map of episode number → watched boolean. |
| `notes` | `string` | — | Any string | Private notes. Supports any text. |
| `addedAt` | `number` | ✅ | Unix ms timestamp | When the item was added. Use `Date.now()` if constructing manually. |
| `updatedAt` | `number` | — | Unix ms timestamp | Last modification time. Optional but recommended. |

---

### How the Automatic Poster Sync Works (Step by Step)

When you tap **"Choose .json to import"** in the Settings screen, the following sequence runs:

**Step 1 — Parse & validate the file**

The app reads the uploaded `.json`, parses it, and checks that a `library` key exists. If the structure is invalid, an error toast is shown immediately and nothing is written.

**Step 2 — Write to IndexedDB + localStorage**

Every valid item is saved using `saveItem()`, which writes to IndexedDB (primary) and mirrors to `localStorage` (fallback). The Zustand store is then reloaded via `reloadLib()` so the Movies, Series, and Anime tabs populate **instantly** — you see your list with text data right away.

**Step 3 — Identify items missing posters**

After reloading, the app filters the imported items for any entry where `poster` is empty or missing. These are queued for the 2-step TMDB image construction routine.

**Step 4 — Fetch TMDB configuration (Step A)**

A single request is made to:
```
GET https://api.themoviedb.org/3/configuration
Authorization: Bearer <your token>
```
The response contains `images.secure_base_url` (e.g. `https://image.tmdb.org/t/p/`). This value is **cached in memory** for the session — it is only fetched once regardless of how many items need syncing.

**Step 5 — Fetch item details (Step B)**

For each item missing a poster, the app requests:
```
GET https://api.themoviedb.org/3/movie/{id}     (for movies)
GET https://api.themoviedb.org/3/tv/{id}        (for series and anime)
Authorization: Bearer <your token>
```
From the response, `poster_path` is extracted (e.g. `/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg`).

**Step 6 — Construct the full poster URL**

The final URL is assembled with **no double slashes**:
```
secure_base_url  =  "https://image.tmdb.org/t/p/"   ← ends with /
poster_path      =  "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg"  ← starts with /

Strip leading / from poster_path, then:
full_url = "https://image.tmdb.org/t/p/" + "w500/" + "pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg"
         = "https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg"  ✅
```

**Step 7 — Persist to storage and re-render**

The full URL is written back into the item's `poster` field via `upsertItem()`, which simultaneously updates:
- The Zustand in-memory store → causes the card to re-render with the real poster immediately
- IndexedDB → so the poster URL persists across app restarts
- `localStorage` → fallback layer used on import

Dark-pastel skeleton loaders are shown on cards while their poster is being fetched. Once the URL is saved, the `<Image>` component renders the poster without any page reload.

Items are processed in **batches of 3** with a 300 ms gap between batches to respect TMDB's rate limits.

---

### Import Troubleshooting Checklist

Run through this list if imported items don't show posters or don't appear in tabs:

- [ ] **Check `type` field.** Must be exactly `"movies"`, `"series"`, or `"anime"`. A value of `"movie"` or `"tv"` here will cause the item to be saved but not appear in any tab.
- [ ] **Check `id` is a number.** `550` ✅ · `"550"` ❌. JavaScript will silently convert string keys but the IDB keyPath expects a number.
- [ ] **Check `status` spelling.** Must be one of: `"pending"`, `"watching"`, `"watched"`. Any other value will default to `"pending"`.
- [ ] **Check `mediaType` field.** Must be `"movie"` or `"tv"`. This controls which TMDB endpoint is called for poster sync.
- [ ] **Check your TMDB token.** If `NEXT_PUBLIC_TMDB_TOKEN` is missing or expired, the poster sync will silently fail. Open DevTools → Network and look for 401 responses.
- [ ] **Try re-importing.** The poster sync is idempotent — re-importing the same file will re-trigger the sync only for items still missing posters.
- [ ] **Force-close and reopen.** On iOS PWA: swipe up in the App Switcher and reopen. The `usePosterSync` hook fires on every library load.
- [ ] **Check DevTools → Application → IndexedDB → rosca-db → library.** If items appear there, the import succeeded. The issue is display-only and will resolve on next render cycle.
- [ ] **Version compatibility.** Files exported from v1/v2 (with `episodes` flat on the item rather than nested under `seasonData`) can be manually migrated using the schema table above.
- [ ] **Always export first.** Import merges by `id` — newer `updatedAt` wins. Export a backup before importing to avoid accidental overwrites.

---

## Architecture

```
trackr/
├── app/
│   ├── layout.tsx          # PWA meta, apple-touch-icon, viewport-fit=cover
│   ├── page.tsx            # SSR-safe dynamic import
│   └── globals.css         # CSS tokens, animations, skeleton shimmer
├── components/
│   ├── App.tsx             # Shell: centred header, tab routing
│   ├── nav/BottomNav.tsx   # 5-tab nav: Movies/Series/Anime/Search/Settings
│   ├── library/
│   │   ├── LibraryScreen.tsx   # 2-row header, collapsible filters, inline search
│   │   └── MediaCard.tsx       # Card with skeleton loader, slide-out delete
│   ├── search/
│   │   ├── SearchScreen.tsx    # TMDB search, instant "+" add
│   │   └── SearchResultItem.tsx
│   ├── settings/
│   │   └── SettingsScreen.tsx  # Export/import + immediate poster backfill
│   ├── sheets/
│   │   ├── BottomSheet.tsx     # Detail drawer: status, providers, ratings, seasons
│   │   └── FluidSlider.tsx     # Horizontal 1.0–10.0 rating slider
│   └── ui/
│       ├── StatusBadge.tsx
│       └── Toast.tsx
├── hooks/
│   └── usePosterSync.ts    # Background TMDB poster hydration hook
└── lib/
    ├── types.ts            # TypeScript interfaces
    ├── tmdb.ts             # TMDB API: config, search, details, poster URL builder
    ├── db.ts               # IndexedDB + localStorage dual layer
    └── store.ts            # Zustand global state
```

---

## License

MIT
