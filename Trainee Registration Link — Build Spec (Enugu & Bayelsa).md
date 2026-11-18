# Trainee Registration Link — Build Spec (Enugu & Bayelsa)

Nov 18, 2026 · @Believe

A build specification for a hand-off to an implementation agent.

## Scope

Build a public registration link that collects trainee data from two states into one spreadsheet, with the two states' records kept visibly separate and downloadable as Excel by the program host.

Three pages:

1. **Landing page** — brief program heading and two large buttons: *Enugu* and *Bayelsa*. No data entry here.
2. **Enugu registration page** — the Enugu field set.
3. **Bayelsa registration page** — the Bayelsa field set, with the fields marked for removal on the source PDF excluded.

One spreadsheet acts as the database. Enugu submissions and Bayelsa submissions land in separate tabs of the same workbook, so the host reads each cohort as a block without filtering or sorting. The host gets view or edit access to the workbook and downloads it as `.xlsx` on demand.

Out of scope unless raised later: trainee login or accounts, editing a submission after it is sent, email or SMS confirmation to the trainee, admin dashboard, payment.

## Architecture

&#91;embedded content: registration architecture · 3 pages, 1 script, 3 tabs\]

The trainee never touches the spreadsheet and the spreadsheet is never written by anything but the script, so there is exactly one place where a bad row can enter and one place to fix it.

**Why this stack.** Static pages cost nothing to host and load on a weak connection. Apps Script is already authenticated against the sheet, so there is no API key to manage, no server to keep alive and no database bill. At the volume of a trainee intake — hundreds, not millions — it is comfortably within the free quotas.

**The Microsoft alternative.** If the host works in Microsoft 365 and wants a genuine Excel file rather than a Google Sheet as the live store, replace the middle layer with Power Automate writing to a table in Excel Online on OneDrive or SharePoint. The front end, the data model, the validation rules and the test plan all carry over unchanged. This is the only decision in the spec that changes more than one section, so settle it before the agent starts.

## Spreadsheet data model

One workbook, three tabs. Grouping is structural — each state owns a tab — so records stay grouped as new rows arrive, with no sorting work for the host.

| Tab | Purpose | Written by |
| --- | --- | --- |
| `Enugu` | Every Enugu submission, one row each, newest at the bottom | Backend, on each Enugu submission |
| `Bayelsa` | Every Bayelsa submission, one row each, newest at the bottom | Backend, on each Bayelsa submission |
| `All` | Both cohorts combined for totals and cross-state counts | Formula only — never written by the backend |

The `All` tab is built with a formula so it can never drift from the source tabs. Put this in `A1` of `All`:

```
=QUERY({Enugu!A2:Z; Bayelsa!A2:Z}, "select * where Col1 is not null", 0)
```

Add the header row manually above it, or shift the formula to `A2`.

### Column layout

Both state tabs carry the same four leading metadata columns, so the `All` tab lines up and counts are trivial. State-specific fields follow from column E.

| Column | Header | Type | Written by |
| --- | --- | --- | --- |
| A | `Submission ID` | Text, e.g. `ENU-0001`, `BAY-0001` | Backend, sequential per tab |
| B | `Timestamp` | Date-time, `Africa/Lagos` | Backend, server time — never from the client |
| C | `State` | `Enugu` or `Bayelsa` | Backend, from the route, not a user field |
| D | `Status` | Dropdown the host maintains: `New`, `Verified`, `Contacted`, `Rejected` | Host, manually |
| E onward | Trainee fields | Per the field tables below | Backend, from the form |

The `Status` column is the host's working column. Set it up as a data-validation dropdown so the host can triage without typing. The backend writes `New` on insert and never touches the column again.

### Rules for the implementing agent

- Header row is row 1 on every tab, frozen, bold.
- Never insert, delete or reorder columns at runtime. Column order is fixed by this spec; the backend writes by position.
- Append only. The backend never updates or deletes an existing row.
- Phone numbers, and any other field that can start with `0`, are written as text, not numbers — otherwise the leading zero is stripped. Format the column as plain text and prefix on write if needed.
- Set the spreadsheet locale and timezone to Nigeria / `Africa/Lagos` before any data is collected.

## Form fields — Enugu

**Awaiting the Enugu PDF.** This table is the agreed shape; the rows get filled from the source form before the agent starts. Do not invent fields.

| # | Field label (as shown to trainee) | Sheet column | Input type | Required | Validation |
| --- | --- | --- | --- | --- | --- |
| 1 | *pending PDF* | E |  |  |  |
| 2 | *pending PDF* | F |  |  |  |
| 3 | *pending PDF* | G |  |  |  |

Conventions the agent should apply when the rows land:

- **Input type** is one of: `text`, `email`, `tel`, `date`, `select`, `radio`, `checkbox`, `textarea`, `number`.
- A `select` or `radio` field lists its exact options in the Validation cell. Options come from the PDF verbatim — no additions, no reworded labels.
- Field labels on the web form match the PDF wording, so a trainee holding the paper form recognises them.
- Sheet column letters are assigned in form order from E and never change afterwards.

## Form fields — Bayelsa

**Awaiting the Bayelsa PDF.** Same table shape as Enugu. The fields marked for removal on the PDF are excluded entirely — they do not appear on the form, and they get no column in the `Bayelsa` tab.

| # | Field label (as shown to trainee) | Sheet column | Input type | Required | Validation |
| --- | --- | --- | --- | --- | --- |
| 1 | *pending PDF* | E |  |  |  |
| 2 | *pending PDF* | F |  |  |  |
| 3 | *pending PDF* | G |  |  |  |

Two notes for the agent:

- The Enugu and Bayelsa field sets are expected to differ. The two tabs therefore have different columns from E onward. That is intended, and it is why the `All` tab aligns only on columns A–D.
- A section listing fields removed from the Bayelsa form goes here once the PDF is read, so there is a record of what was dropped and why, in case anyone asks later why the two forms differ.

## Front-end spec

Three static pages, mobile-first. Most trainees will open the link on a phone over a weak connection, so the whole thing should be plain HTML, CSS and vanilla JS — no framework, no build step, no external font or icon CDN.

### Pages and routes

| Route | Page | Contents |
| --- | --- | --- |
| `/` | Landing | Program name, one line of context, two buttons |
| `/enugu` | Enugu form | Enugu field set, submit, success state |
| `/bayelsa` | Bayelsa form | Bayelsa field set, submit, success state |

Use real paths, not query strings, so the host can share the state link directly with a cohort if they ever want to skip the landing page. Each form page carries a back link to the landing page in case a trainee picks the wrong state.

### Landing page

Two buttons, stacked on mobile and side by side from 640px up. Each must be a large tap target — minimum 48px tall, full width on mobile. Label them with the state name only, no abbreviations. The state choice is not a dropdown and not a radio group: the button *is* the route.

### Form pages

- One field per row on mobile. Labels above inputs, never placeholder-only labels.
- Required fields marked with an asterisk and a legend explaining it.
- `inputmode="numeric"` on phone-number fields so the numeric keypad opens on mobile.
- Submit button disabled while a request is in flight, with the label switching to a submitting state. This is the main guard against double submission from an impatient double-tap.
- The form must survive a dropped connection: on network failure, keep the entered values on screen and show a retry, never clear the form.

### States after submit

| State | Behaviour |
| --- | --- |
| Success | Replace the form with a confirmation showing the trainee's `Submission ID` and a line telling them to keep it. No auto-redirect. |
| Validation error | Inline message under each offending field, focus moved to the first one, page not reloaded |
| Duplicate | Clear message that a registration already exists for that phone number, with a contact route for correcting it |
| Server or network error | Retry button, values preserved, and a short note that nothing was saved |

### Client-side validation

Validate on submit, not on every keystroke. Required fields non-empty, email shaped like an email, phone matching the Nigerian pattern in the validation section below. Client validation is a convenience only — the backend re-validates everything and is the authority.

## Backend spec

A single Google Apps Script web app bound to the spreadsheet, deployed with access set to *Anyone*. It is the only thing that writes to the sheet.

### Endpoint

One `POST` endpoint handling both states. The state comes in the body, and the handler picks the tab from it — it is never trusted as a tab name directly.

**Request**

```
POST <web app url>
Content-Type: text/plain;charset=utf-8

{
  "state": "Enugu",
  "fields": {
    "full_name": "...",
    "phone": "08012345678"
  },
  "token": "<shared form token>"
}
```

Send the body as `text/plain`, not `application/json`. Apps Script web apps do not return CORS preflight headers, so a JSON content type triggers an `OPTIONS` request that fails. Posting a JSON string as `text/plain` avoids the preflight and is parsed server-side with `JSON.parse(e.postData.contents)`.

**Response, success**

```
{ "ok": true, "submissionId": "ENU-0001" }
```

**Response, failure**

```
{ "ok": false, "error": "duplicate_phone", "message": "..." }
```

Error codes the front end must handle: `validation_failed`, `duplicate_phone`, `unknown_state`, `bad_token`, `server_error`. Always return HTTP 200 with the error in the body — Apps Script's error pages are HTML and unparseable by the client.

### Handler logic, in order

1. Parse the body. Malformed JSON gives `server_error`.
2. Check `token` against a constant in Script Properties. Mismatch gives `bad_token`. This is a trivial bar, but it stops drive-by posts to a URL found in page source.
3. Map `state` to a tab: `Enugu` or `Bayelsa` only. Anything else gives `unknown_state`.
4. Re-validate every field against the field table for that state. Reject on any required field empty or any format failure.
5. Take a script lock. See the concurrency note below.
6. Normalise the phone number and check it against the existing phone column on both state tabs. A hit gives `duplicate_phone`.
7. Generate the next `Submission ID` for that tab from its current row count.
8. Append one row: metadata columns A–D, then the state's fields in the fixed column order.
9. Release the lock and return the submission ID.

### Concurrency

Two trainees submitting at the same moment can both read the same row count and produce the same `Submission ID`, or overwrite each other's row. Wrap steps 6 to 8 in `LockService.getScriptLock()` with a timeout around 10 seconds, and use `sheet.appendRow()` rather than computing a target range. If the lock cannot be acquired, return `server_error` so the trainee retries rather than silently losing the submission.

### Secrets and config

The form token and the spreadsheet ID live in Script Properties, not in the script body and not in the front-end source beyond the token itself. Note plainly: the token sits in client-side JS and is therefore public. It is a speed bump, not authentication.

## Host access and export

The host never touches the script or the form — only the spreadsheet.

**Access.** Share the workbook with the host's Google account as **Editor** so they can work the `Status` column, and as Editor only for them, not link-wide. Do not set the workbook to "anyone with the link" — it holds trainees' personal data.

**Export.** In the spreadsheet, *File → Download → Microsoft Excel (.xlsx)*. The download carries all three tabs, keeping Enugu and Bayelsa separated in the exported file exactly as they appear online.

**What the host sees.** Two cohort tabs they can read top to bottom with no filtering, a combined tab for totals, and a `Status` dropdown for triage. Row counts per state are visible from the tab row numbers; if the host wants a headline count, add a small summary block at the top of `All`:

```
=COUNTA(Enugu!A2:A)   → Enugu registrations
=COUNTA(Bayelsa!A2:A) → Bayelsa registrations
```

**One caution to pass to the host.** The source tabs are append-only by the backend, but an Editor can still delete or reorder rows by accident, which would break the `Submission ID` sequence. Protect columns A to C on both tabs with *Data → Protect sheets and ranges*, leaving `Status` and later columns editable. Keep version history available as the recovery path.

## Validation, duplicates and abuse

The link is public and unauthenticated, so junk is the main data-quality risk.

### Phone normalisation

Phone number is the de-duplication key, so it must be stored in one canonical form. Normalise before comparing and before writing:

1. Strip spaces, dashes, brackets.
2. Convert `+234XXXXXXXXXX` and `234XXXXXXXXXX` to `0XXXXXXXXXX`.
3. Accept the result only if it matches `^0[789][01]\d{8}$` — 11 digits, standard Nigerian mobile prefixes.
4. Write it as text so the leading zero survives.

Store the normalised form in the phone column. If the host needs the raw entry, add a separate `Phone (as entered)` column rather than compromising the key.

### Duplicate policy

One registration per phone number, checked across both state tabs — a trainee must not be able to register in Enugu and again in Bayelsa. On a hit, reject with `duplicate_phone` and tell the trainee to contact the program if their details need changing. Do not silently overwrite, and do not create a second row.

Consider whether the program also wants one registration per email, if email is collected and required. Flagged as an open question below.

### Abuse measures, in order of value

| Measure | Cost | Keeps out |
| --- | --- | --- |
| Required-field and format validation server-side | Trivial | Empty and nonsense submissions |
| Phone uniqueness | Low | Duplicates, repeat submitters |
| Shared form token | Low | Scripted posts straight to the endpoint |
| Honeypot field, hidden by CSS, reject if filled | Low | Most naive bots |
| Rate limit by normalised phone prefix or a per-session counter | Medium | Bulk junk from one source |
| Google reCAPTCHA v3 on the form | Medium, adds a dependency | Determined bots |

Recommendation: ship the first four. Add the rate limit only if junk actually appears, and reCAPTCHA only if it keeps appearing — both add weight to a form that must load on a poor connection.

### Data protection note

The sheet holds names and phone numbers of identifiable people, which brings it under the Nigeria Data Protection Act. Practical minimum: collect only fields the program actually needs, keep the workbook off link-sharing, and put one line on each form saying what the data is used for and who holds it. Worth confirming with the program host who the data controller is.

## Deployment

Build order matters: the sheet exists before the script, the script before the forms, because each step needs an ID from the one before it.

- [ ] Create the Google Sheet. Set locale to Nigeria and timezone to `Africa/Lagos` in *File → Settings*.
- [ ] Create the three tabs, `Enugu`, `Bayelsa`, `All`, with header rows per the data model. Freeze row 1.
- [ ] Format the phone columns as plain text; add the `Status` data-validation dropdown on both state tabs.
- [ ] Add the `QUERY` formula to the `All` tab and confirm it picks up a manually typed test row from each state tab, then delete the test rows.
- [ ] Open *Extensions → Apps Script* from the sheet so the script is container-bound. Write the `doPost` handler per the backend spec.
- [ ] Put the form token and spreadsheet ID in Script Properties.
- [ ] Deploy as a web app: execute as *me*, access *Anyone*. Copy the deployment URL.
- [ ] Build the three static pages. Put the deployment URL and token in one config object at the top of the shared JS file, not scattered through the pages.
- [ ] Deploy the front end. Netlify, Vercel or GitHub Pages all work; all three are free at this volume and give an HTTPS link.
- [ ] Point a short, readable URL at it if the program will be sharing the link verbally or on flyers.
- [ ] Run the full test plan below.
- [ ] Share the workbook with the host as Editor and protect columns A to C.
- [ ] Hand the host the link plus a two-line note on where to download the Excel file.

**Redeployment caution for the agent:** every change to the Apps Script requires a *new deployment version*, not just a save. Saving alone leaves the old code running at the same URL, which produces the classic symptom of a fix that appears to do nothing. Either create a new version on each deploy or use a test deployment during development.

## Test plan

The agent verifies all of these before handover. Delete every test row afterwards and confirm the `All` tab is clean.

| # | Test | Pass condition |
| --- | --- | --- |
| 1 | Submit a valid Enugu registration | Row lands on `Enugu` only, ID `ENU-0001`, `State` reads `Enugu`, timestamp in Lagos time |
| 2 | Submit a valid Bayelsa registration | Row lands on `Bayelsa` only, ID `BAY-0001`, no column for any removed field |
| 3 | Check the `All` tab | Both rows appear, columns A–D aligned, no duplicates |
| 4 | Submit with required fields empty | Rejected, inline errors shown, nothing written to the sheet |
| 5 | Phone entered as `+2348012345678` | Stored as `08012345678`, leading zero intact, cell is text not number |
| 6 | Resubmit the same phone number in the same state | Rejected with the duplicate message, no second row |
| 7 | Resubmit the same phone number in the *other* state | Also rejected — the check is cross-tab |
| 8 | Double-tap submit on a slow connection | One row only |
| 9 | Two submissions fired simultaneously | Two rows, two distinct IDs, neither overwritten |
| 10 | POST to the endpoint with a wrong token | Rejected with `bad_token` |
| 11 | POST with `state` set to something unexpected | Rejected with `unknown_state`, no new tab created |
| 12 | Fill the honeypot field and submit | Rejected, nothing written |
| 13 | Submit with the device offline | Error state shown, entered values still on screen, nothing written |
| 14 | Open all three pages on a phone at 360px width | No horizontal scroll, buttons and inputs reachable one-handed |
| 15 | Download as `.xlsx` and open in Excel | Three tabs present, state separation intact, phone numbers still show leading zeros |

Test 15 is the acceptance test for the host's actual workflow — it is the one most often skipped and the one the host will notice first.

## Open items

Blocking the build:

- [ ] **Enugu PDF** — needed to fill the Enugu field table.
- [ ] **Bayelsa PDF with the marked areas** — needed to fill the Bayelsa field table and record what was removed.

Decisions that change the build, worth settling before the agent starts:

- [ ] **Google or Microsoft?** This spec assumes Google Sheets plus Apps Script. If the host works in Microsoft 365 and wants a true Excel file as the live database, the backend becomes Power Automate against Excel Online and the deployment section changes. Everything else in this spec holds.
- [ ] **Program name and any header copy** for the landing page.
- [ ] **Is registration time-limited?** If there is a closing date, the forms need a closed state after it rather than silently accepting late entries.
- [ ] **Unique on email as well as phone?** Only matters if email is collected and required.
- [ ] **Does the trainee need anything back** — a confirmation email or SMS, or is the on-screen submission ID enough? Email adds an Apps Script `MailApp` call; SMS adds a paid provider.
- [ ] **Who is the data controller** named on the forms' privacy line.

Not blocking, worth noting:

- The spec deliberately avoids a trainee-facing edit flow. If corrections turn out to be frequent, the cheapest answer is the host editing the sheet directly rather than building an edit link.
