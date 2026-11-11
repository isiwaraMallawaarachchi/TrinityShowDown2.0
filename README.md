# Trinity Showdown frontend

React and Vite. Public-site design only: registration controls open fillable, game-specific form previews. Backend registration, email, organizer authentication and database integration remain separate phases.

## Run

From `Code/frontend`:

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 5174
npm test
npm run build
```

## Scene system

The landing uses the supplied Emerald Shadow Squad artwork, with a full-width WebP and a tighter crop that keeps the five silhouettes visible on phones. Game backgrounds use the supplied films, in order: CODM, PUBG, MLBB, COC. Thorgal uses Artifex Hand CF for display and Mulish for supporting type. The site uses locally hosted Mulish and Marcellus. Marcellus is the display fallback until Artifex Hand CF is licensed. To activate Artifex Hand CF, add a licensed webfont stylesheet defining `Artifex Hand CF` or `artifex-hand-cf` and import it in `src/App.jsx`. Emerald atmosphere and scroll-driven depth dissolves replace the old grain, idle effects and angular wipes. No motion toggle or saved toggle state remains. System reduced-motion preferences are still respected automatically.

- `src/App.jsx`: chapters, navigation, dialogs and landing composition.
- `src/content.js`: game order and placeholder event copy.
- `src/SceneVideo.jsx`: responsive media, next-scene preloading, autoplay and poster fallback.
- `src/scene-timeline.js`: reversible scroll composition.
- `src/useSceneJourney.js`: native scrolling, finite easing, chapter links and responsive geometry.
- `src/styles.css`, `src/motion.css`, `src/event-panel.css`: composition, pointer depth and typography.
- `src/scene-media.json`: generated media manifest.
- `public/media/scenes`: optimized MP4 clips.
- `public/art/game-art`: supplied game artwork shared by the guide, registration, and video fallback.

A game spans 135% of the small viewport height (120% on narrow screens). Its video autoplays muted and inline once the scene becomes active, then holds the last frame. Scrolling can move on before playback ends. The browser can buffer the upcoming clip and start playback before the entire file downloads. Leaving the scene pauses its video; leaving it fully behind releases it so a later visit starts from the beginning. The supplied game artwork is visible before decoding, on media failure, and with reduced motion. Touch devices do not get pointer parallax. No custom wheel interception or scroll snapping is used.

## Public sections

The landing page includes the registration clock and links to the four autoplaying game films. The guide starts with the grand prize pool and event timeline, followed by game details, competing teams, rules and eligibility, rulebooks, registration, About, contact, and the footer.

- Set `event.registrationClosesAt` in `src/content.js` or provide `VITE_REGISTRATION_CLOSES_AT` as an ISO 8601 timestamp with an explicit UTC offset. Both countdowns use the same deadline and show a pending state until it is confirmed.
- Set `event.prizePool` and each game's `prizePool` in `src/content.js` to the announced amounts.
- `publishedTeams` accepts public, approved team names and logos. Fictional entries from `previewTeams` appear in local development when no teams are published. Set `VITE_SHOW_SAMPLE_TEAMS=true` when building a private preview that needs them. Team rows loop and pause when a team is hovered. With reduced motion enabled, overflow can be browsed by swipe or keyboard arrows without a visible scrollbar.
- `coChairs` holds the public contact information shown under Get in touch.
- Set `rulebookUrl` and the other detail fields on each game once approved for this edition.

## Registration previews

Open the game links under the registration section or use the direct hashes `#register-cod-mobile`, `#register-pubg-mobile`, `#register-mlbb`, and `#register-clash-of-clans`. The steps cover team details, leader, starters, optional substitutes, and review. Roster counts live in `src/registration.js`. The Clash of Clans roster is provisional. The preview validates required fields, image type and size, and duplicate university IDs within the roster. Values and files are held only in the open form. Enable live submissions only after the backend, private upload storage, edition rules and dates are configured.

Organizer logos are stored in `public/art` and sourced from the previous edition's official site. The landing artwork is stored in `public/art/emerald-squad-wide.webp` and `public/art/emerald-squad-mobile.webp`.

## Rebuild media

Originals remain unchanged in `../../Ref vIdeo`. Run `npm run media:prepare` (or `node scripts/prepare-scene-media.mjs cod` for one scene). FFmpeg is a development dependency, not shipped to browsers.

| Scene | Source start | Clip length |
| --- | ---: | ---: |
| CODM | 2.95 s | 2.08 s |
| PUBG | 2.70 s | 4.00 s |
| MLBB | 4.15 s | 3.58 s |
| COC | 0.00 s | 2.50 s |

Outputs use H.264 MP4 at the source's native 24 fps, with no audio and front-loaded metadata for progressive playback. Desktop retains the source resolution; compact is 1280 pixels wide; portrait uses a subject-focused 9:16 crop. MLBB's letterbox is removed. Mild color correction preserves the source art. Desktop clips total about 11.1 MiB, compact about 4.9 MiB, and portrait about 4.0 MiB. The site requests one variant per clip.

Posters provide immediate scene composition when network conditions or browser settings delay autoplay. Production hosting should serve `video/mp4` with byte-range support and caching, and compress text assets. Bump the video URL version when replacing clips.

## Checks

Automated tests cover deadline states, registration, game order, fast-start MP4 layout, chapter boundaries, transition overlap and system reduced motion. See `../../docs/previews` for visual captures.

## Content boundaries

Event dates, venue, rosters, formats, fees, rulebooks and contacts remain placeholders. Registration must follow the approved immutable-submission, unique-player, bank-proof-review and soft-rejection rules. See `../../docs/SRS.md` and `../database/README.md`. No registration data is collected by this frontend phase.
