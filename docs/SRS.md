# Trinity Showdown — Software Requirements Specification

**Version 0.5 · Draft for organizer review · 12 November 2026**

## 1. Purpose and scope

Trinity Showdown will be the event’s official website for exploring the competition and registering teams. Visitors can find the games, tournament timeline, organizing details, eligibility rules, rulebooks and contact information. A captain can submit a team logo and roster, including each player’s university ID, through the site. Organizers can review those submissions in a private workspace and control which teams appear on the public site.

| Status | Decision |
| --- | --- |
| Confirmed | Build a full-stack site with a React public front end, a separate organizer workspace, an Express.js back end and PostgreSQL. |
| Confirmed | Carry forward the original Trinity Showdown content areas. Use Quest for esports presentation, Thorgal as the primary motion reference and Trionn for selective interaction details. |
| Confirmed | Keep green as the brand’s lead color, with a stronger gaming feel, carefully selected type and animation using the supplied event logo. |
| Confirmed | Offer a separate portal for each game with one shared registration workflow and one game per submission. Captains register without accounts and receive an email receipt. The submitted details and files become permanent upon successful submission. Each player may compete for only one team in one game across the edition. |
| Confirmed | Include PUBG Mobile, Call of Duty: Mobile, Mobile Legends: Bang Bang and Clash of Clans. Use clearly labeled placeholders for current-edition details until the organizers provide them. |
| Confirmed | Collect the entry fee by bank transfer and require an image of the payment proof. Organizer approval after payment verification automatically publishes the team listing. |
| Confirmed | Use password sign-in for invited organizers. Any active organizer can invite another organizer with the same permissions across all four games. Organizers can view and export submitted data, verify payment proof, approve valid registrations and reject suspicious or invalid entries. Rejection preserves the original submission and uploaded files. |
| Confirmed | Use English throughout the site, organizer workspace and system emails. Operate the website for six months. |
| Confirmed | Optimize for phones, tablets and desktops across Android, iOS, iPadOS, macOS, Windows and Linux. |
| Accepted design direction | Competition teaser, four sequential game reveals, timeline, entry guidance and rulebooks, registered teams, and organizer details. |
| Pending | Roster sizes, remaining eligibility rules, final form fields, fees and bank instructions, and release inputs in §8. |

Numbered requirements describe the launch baseline, including draft behaviors where indicated. Section 8 identifies the remaining choices. The site records bank transfer evidence and the organizer's verification decision. The transfer itself takes place outside the site.

## 2. Users and public content

- **Visitor or player** browses the event, compares games, reads rulebooks and views published teams.
- **Team captain** reviews the completed form, submits one registration for the selected game on behalf of a roster and receives an email receipt.
- **Organizer** signs in with an individual password to review submissions and payment images for all four games, record decisions, invite other organizers and export entries.

| ID | Area | Required content and behavior |
| --- | --- | --- |
| PUB-01 | Home | Show Trinity Showdown branding, an event overview, current registration state, featured games and a direct path to registration or the opening details. |
| PUB-02 | About and timeline | Show the event purpose, approved organizing bodies and their details, registration dates and tournament milestones. Show venue or online format once confirmed. |
| PUB-03 | Games and game details | Show a card and a shareable detail page for each of the four games. Include format, roster size, schedule, and published prizes or fees where applicable. Link to the relevant rulebook and the shared portal with that game preselected. Label unknown details and pending rulebooks clearly in the prototype. |
| PUB-04 | Rules and eligibility | Present the current eligibility and fair-play summary as readable page text and give each game a labeled link to its current rulebook PDF. A missing document gets a clear pending state before registration opens. |
| PUB-05 | Registered teams | Group approved teams by game using data from the back end. Show the approved display name, display logo and game. Provide a clear empty state until teams are approved. |
| PUB-06 | Register | Provide one shared portal and form for all four games. Link to it from the main navigation, the home hero and each game’s detail page. General links open the game selector. A game-specific link preselects its game and lets the captain change it before submitting. Show the selected game’s requirements, dates and availability. When unavailable, explain the state and link to rules or organizer contact. |
| PUB-07 | Contact and privacy | Show approved organizer contact channels and a privacy notice that explains collection, access, publication and retention of registration data. Link to both from registration and the footer. |

The previous edition’s site establishes the content categories. Its lineup, team list, dates, fees, contacts and rulebook files are historical reference material. Use only approved current-edition data on the new site. The old site’s timeline and registration deadline display different years, so the new site must derive all deadline labels and availability from the same configuration. [Previous Trinity Showdown website](https://trinity-showdown.rotaractmora.org/)

### Home page sequence

1. **Competition teaser.** Open with the event logo reveal, a short competition teaser, current registration status and a direct link to the portal.
2. **Four game chapters.** Reveal PUBG Mobile, Call of Duty: Mobile, Mobile Legends: Bang Bang and Clash of Clans one at a time as visitors scroll. Each chapter links to the game’s details and uses clearly labeled placeholders until approved content arrives. Keep all chapters available in normal scroll order with reduced motion.
3. **Timeline.** Show the registration window and tournament milestones so players can check whether they can take part.
4. **How to enter.** Summarize eligibility, link to rulebooks and explain how to assemble the roster, pay by bank transfer and upload proof.
5. **Registered teams.** Show approved teams grouped by game as the field fills up.
6. **About and contact.** Introduce the organizers, provide event and venue information when confirmed, and give players a contact for help.

## 3. Registration requirements

| ID | Requirement |
| --- | --- |
| REG-01 | Without signing in or creating an account, the captain selects exactly one game, completes the team, captain and per-player sections, uploads the team logo and payment proof, reviews the entry and submits. Each game portal uses the shared form and its own roster configuration. Show the rules, roster limits, fee and bank transfer instructions before asking for personal data. |
| REG-02 | Collect one record per roster member, including the captain when they are a player and any substitutes. Require a university ID for each roster member. Require the typed university ID and separate front and back ID photos for each member. Require a leader photo and contact numbers for the leader and Player 2. Collect an in-game name and ID for each member. |
| REG-03 | Enforce one active roster spot per player across all teams and games in the edition, including substitutes and a captain who plays. Check duplicates within the roster and across submitted and approved entries. Use a database uniqueness constraint or equivalent transactional guarantee so concurrent requests cannot claim the same player. Treat identifiers as strings and preserve leading zeros. A draft identity key is institution plus normalized student number. Confirm that key and its matching rules before live registration. Duplicate errors must avoid exposing another team's information. |
| REG-04 | Show a link to the applicable rulebook and privacy notice before submission. Record the version of the rules the captain accepted and the version of the privacy notice shown, along with the time of submission. Explain which team information may be made public and capture any publication permission the organizers require. |
| REG-05 | Enforce the opening and closing times for new submissions in the back end and display times in `Asia/Colombo`. Use a start-inclusive, end-exclusive registration window. Organizer review of stored submissions can continue after registration closes. Keep real submissions closed while required game configuration, payment instructions or rulebooks are pending. |
| REG-06 | Return a success receipt and queue an email to the captain only after the registration, roster, logo and payment proof are durably linked. The email includes the reference, game and confirmation that the entry was received and is awaiting review. A delivery failure can be retried without recreating the registration. Retrying an already accepted submission returns the original receipt, including after closing. A failed write or interrupted upload leaves no partial entry for review. Remove temporary or orphaned uploads safely. |
| REG-07 | Identify invalid fields with specific guidance and preserve valid entries in the current form after a recoverable error. Let captains correct fields and replace files before submission. Keep university IDs and other private values out of URLs and persistent browser draft storage. |
| REG-08 | Show a final review step that tells the captain the submission is permanent. After successful submission, all submitted fields and uploads are read-only for captains and organizers. Enforce this in the API and restrict organizer writes to review decisions and their audit records. |
| REG-09 | Require a readable image of the bank transfer proof. Store it privately and give organizers an image preview for manual verification. Apply file validation and upload limits to proof images independently of team logos. |
| REG-10 | Support changes to the form for future submissions. Keep the field definitions used by each existing submission so its original values remain readable in reviews and exports. |

### Proposed registration fields

| Level | Initial fields | Decisions that affect storage |
| --- | --- | --- |
| Registration | Edition, one game, team display name, logo, bank transfer proof image and applicable rulebook and notice versions | Team-name uniqueness, final fees and bank instructions, and whether a transfer reference is also required. |
| Captain | Full name or reference to the captain’s roster record, required email for the receipt, and phone as a draft field | Whether the captain must play and whether phone is required. |
| Roster member | Full name, university, university ID, starter or substitute role and game-specific player handle or ID where required | Same-university or undergraduate rules, institution naming and ID formats, per-game limits, ID evidence, and duplicate scope. Confirm whether all players need contact details or whether captain contact is sufficient. Ask for university once per team if the policy requires a single institution. |

The portal collects the university name once with the team name, team logo, and payment proof. Each roster slot collects a name, university ID number, front and back ID photos, and in-game name and ID. Clash of Clans uses the in-game player tag. The leader is included in the starting roster.

| Portal | Required starters | Optional substitutes |
| --- | ---: | ---: |
| Call of Duty: Mobile | 5 | Up to 1 |
| PUBG Mobile | 4 | Up to 2 |
| Mobile Legends: Bang Bang | 5 | Up to 2 |
| Clash of Clans (provisional) | 5 | Up to 1 |

Confirm the provisional Clash of Clans roster before launch. The frontend preview accepts sample values and images for review in the current tab. The registration API must validate and store the ID sides and leader portrait privately before enabling real submissions.

Draft upload limits are one PNG, JPEG or WebP logo up to 5 MB, with a maximum width and height of 4,096 pixels. Check the actual decoded image, strip metadata from the public rendition and use a generated storage key. Store the private upload under backend access control and expose a safe public rendition only after publication. Apply a raster format allowlist to participant uploads. The supplied Trinity SVGs are separate, trusted brand assets. [OWASP file upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

## 4. Organizer review and publication

| ID | Requirement |
| --- | --- |
| ADM-01 | Give all organizers the same access across all four games. Provide a private registration list filterable by game and status, and a detail view with all submitted fields and image previews, including university details and bank transfer proof. Organizer review actions update the decision and audit record. The registration fields and files are read-only for organizers. |
| ADM-02 | Start a valid entry as **Submitted**. Organizers can approve it after reviewing the roster and verifying the payment proof, or reject a suspicious or invalid entry with an internal reason. Organizers can also reject a previously approved entry. Record the acting organizer, decision, reason when rejecting and timestamp. Enforce the allowed status transitions in the back end so conflicting decisions cannot overwrite one another. Treat **Rejected** as the final state of that entry. |
| ADM-03 | Approval automatically publishes the team name, display logo and game. Rejection removes any public listing and revokes site-controlled access to its public logo. Keep the rejected entry, original fields, uploaded files and decision history available in the organizer workspace and export. Release its active roster spots atomically with rejection. |
| ADM-04 | Configure the active edition’s games, availability, timeline, bank instructions and rulebooks through a documented maintenance process. |
| ADM-05 | Use a privately shared sign-in URL outside public navigation, the footer and the sitemap. Use password authentication and enforce an authenticated organizer session on every organizer request and private file access. |
| ADM-06 | Allow any active organizer to invite another organizer. On acceptance, the new organizer receives the same permissions as the inviter across all four games, including the ability to invite another organizer. Use expiring invitations, secure password storage and sign-in throttling. Audit invitations and account deactivation. Revoking an account also revokes its active sessions. |
| ADM-07 | Let every organizer export all submitted fields across all four games. The proposed export uses CSV for field values, with a row per player and authenticated image links for each registration's uploads. The export excludes authentication credentials and records the exporting organizer and timestamp. |

Organizer access references. [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) · [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

## 5. System boundaries and data handling

| Layer | Responsibility |
| --- | --- |
| Front ends | React powers the public site and registration form. The organizer workspace is a separate interface. Both call the Express API on the same origin. |
| Express.js back end | Public and private API responses, authorization, registration validation, email delivery, organizer actions, audit records and media access. It decides whether a registration is open, complete or published. |
| Relational database | Durable, structured event and registration records, roster relationships, review and publication state, and media references if files use separate backend-managed storage. Only the back end connects to the database at runtime. |
| Backend-managed media | Durable storage for team logos, bank transfer proof, any required ID documents and rulebooks. Access rules distinguish private uploads from public assets. The database phase will specify where the binaries live and how recovery keeps files and records in sync. |

Maintain distinct front-end, back-end and database responsibilities. Keep submissions tied to the correct edition and game. PostgreSQL stores upload bytes and registration records in the same transaction. Express controls media access. Pending competition decisions are tracked in §8. [Project setup](../Code/README.md#run-locally) · [Data and API](../Code/README.md#data-and-api)

## 6. Visual and interaction requirements

- **VIS-01 · Esports presentation.** Use a cinematic hero, bold typography and game cards with scannable metadata and a clear registration action. Keep Trinity Showdown’s own competition content and brand assets. [Quest E-sports](https://questesports.lk/)
- **VIS-02 · Cinematic chapters.** Take the lead from Thorgal’s numbered scenes, layered artwork and masked page reveals. Give the home, games and rules sections distinct compositions with a consistent chapter marker and navigation. Use original or approved artwork with forest-dark surfaces, sharp green light and tactile textures. [Thorgal](https://www.thorgal.com/)
- **VIS-03 · Hover and page motion.** Prototype a brief mask or light sweep between public routes, restrained depth on key cards and a short impact shake on decorative artwork. Use a desktop reticle accent that responds to selected hover targets while keeping the native pointer usable. Take small cues from Trionn’s responsive details and typography reveals. Keep movement away from text inputs, error messages and primary control hit areas. [Trionn](https://trionn.com/)
- **VIS-04 · Design system.** Define reusable tokens for color, type, spacing, focus and motion, and shared patterns for navigation, cards, calls to action and form states. Start with near-black green `#0A120E`, vivid accent `#A4FF46`, off-white `#F2F6EF` and the supplied logo green `#7EC684`. Treat the brighter accent as a prototype choice. Test Barlow Condensed for headings and Inter for body, form and admin text. Validate legibility, contrast, font coverage and licensing before adopting them. [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed) · [Inter](https://fonts.google.com/specimen/Inter)
- **VIS-05 · Separate logo animations.** Prototype a hero reveal with the original wordmark and a reticle whose segments lock into place. Create a second, shorter reticle pulse for the submission receipt or an interstitial. Use `SVGS/white - colour.svg` for dark-surface prototype work and preserve the supplied mark’s geometry and colors in the settled frame. Provide a static variant for reduced motion. The workspace includes four SVG variants, an Illustrator source and six PNG variants. Organizer and game art are content inputs to confirm separately.
- **VIS-06 · Motion fallbacks.** On touch, use press feedback instead of hover effects. Honor reduced-motion settings with static scenes or simple fades. Preserve direct links, browser back behavior, keyboard focus and access to registration when effects are reduced or assets fail. Use a brief, skippable or non-blocking logo reveal. Avoid rapid flashing and scroll traps.

## 7. Quality and launch verification

| ID | Requirement and acceptance evidence |
| --- | --- |
| QA-01 | Verify the discovery-to-registration path on phones, tablets and desktops, including keyboard-only, screen reader and reduced-motion use. Target WCAG 2.2 AA for the web experience. Check touch controls, labels, errors, focus, contrast and responsive reflow. |
| QA-02 | Test representative Android phones and tablets in Chrome, iPhone and iPad in Safari, macOS in Safari and Chrome, Windows in Edge and Chrome, and Linux in Firefox and Chrome. Cover portrait and landscape where appropriate. Verify each registration entry point, game preselection, switching games, file picking from desktop and mobile, direct URLs, reload, browser back and upcoming, open, closed and empty states. |
| QA-03 | Test registration deadline boundaries, duplicate players within one roster and across teams and games, and concurrent claims for the same player. Verify both captains and organizers are blocked from changing submitted fields or replacing files, including via direct API requests. Test invalid uploads, interrupted uploads, receipt email retries and repeat submissions. |
| QA-04 | Keep private roster and contact data, university IDs, review notes, payment proof and original uploads out of public responses, logs and analytics. Test that invited organizers get identical permissions, can view and export all games, and can review and reject entries. Verify automatic publication after approval and removal after rejection, including that the original fields and files are still available to organizers. Test concurrent review actions, private image links, password sign-in and session revocation. Use TLS, encryption at rest, restricted credentials and rate limits. |
| QA-05 | Plan to operate the website for six months from public launch. Preserve complete registration records and their private uploads, including rejected entries, throughout that period. Closing registration, rejecting an entry or ending the site's operating period does not trigger data deletion. Document the archive and backup handover separately. Demonstrate recovery of a sample submission and its media in a separate environment using synthetic data. |
| QA-06 | Set performance targets of LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1 at the 75th percentile when field data are available. Before launch, check key pages on a representative mid-range Android phone and a throttled mobile connection, and verify the experience on iOS and tablet. Load core content and controls independently of decorative motion. Use responsive assets and defer offscreen media and optional effects. |
| QA-07 | Rehearse the complete path on staging with a captain and organizer. Check each rulebook link, verify the confirmed event content and resolve all launch-blocking registration, privacy, access and usability defects before opening registration. |

Accessibility and performance references. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) · [Google Web Vitals](https://web.dev/articles/vitals)

## 8. Organizer decisions and phase gates

| Decision | What needs confirmation | Needed for |
| --- | --- | --- |
| D-01 · Team rules by game | Confirm the provisional Clash of Clans roster above. Is there a team cap or waitlist? Is the registration window shared or set per game? Can the captain be a non-playing manager? | Roster, game configuration and capacity rules. Actual dates can follow later. |
| D-02 · Eligibility and player identity | Confirm eligible institutions and student categories, any same-university rule, whether institution plus student number identifies a player across games, and whether teams can reuse a name within a game. | Eligibility, identity and uniqueness rules. |
| D-03 · Registration fields and ID proof | Use the common draft fields for planning. Confirm any additional game-specific fields and how organizers verify the typed university ID and both ID photos. | Form, data fields and access to private uploads. |
| D-04 · Review follow-up | Confirm whether captains should receive an email when organizers approve or reject an entry. Submitted details are permanent. Rejection preserves the record. | Review notifications. |
| D-05 · Bank transfer details | Provide fee amounts by game, approved bank instructions and any mandatory transfer reference. Payment proof upload and organizer verification are confirmed. | Payment configuration and launch copy. |
| D-06 · Account operations | Confirm who handles account recovery and revocation. All active organizers share the same in-app access and can invite new organizers. | Account management and handover. |
| D-07 · Operating period and archive | Plan for six months of site operation from public launch. Confirm the launch date and archive and backup arrangements after the operating period. | Hosting and data handover. |
| D-08 · Launch content and deployment | Supply edition dates, venue, organizers, contact details, prizes, approved art and rulebooks when available. Domain and hosting are deferred. | Release content and deployment. |

1. **Requirements** — review this SRS and settle the decisions that affect data and workflows.
2. **Relational database** — define the tables, field types, relationships, keys, constraints and migrations. Review them against the registration and publication flows.
3. **Front-end design** — map the pages and mobile form, create the design system and prototype the two logo animations and page transitions.
4. **Build and verify** — implement and integrate the API, database, media storage and React application, then rehearse registration and organizer review before launch.
