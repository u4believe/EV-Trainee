# EV Trainee Registration (Enugu & Bayelsa)

A public registration link built to *Trainee Registration Link — Build Spec*. The front end is static HTML/CSS/vanilla JS with no build step and no CDNs. The backend is a Google Apps Script web app that writes to one Google Sheet. The Sheet has three tabs: `Enugu`, `Bayelsa` and `All`.

```
site/                    ← deploy this folder (Netlify / Vercel / GitHub Pages)
  index.html             /          landing, two state buttons
  enugu/index.html       /enugu     flyer → form → confirmation
  bayelsa/index.html     /bayelsa   banner → form → confirmation
  assets/app.js          REG_CONFIG (endpoint + token) at the top, form logic
  assets/fields.js       field schema + validation (shared by both pages)
  assets/styles.css
apps-script/
  Code.gs                doPost handler + one-time setup()
  appsscript.json
tests/
  backend.test.mjs       spec test plan against Code.gs (mocked Sheets)
  gas-mock.mjs           in-memory SpreadsheetApp / LockService / …
  dev-server.mjs         local preview with a mock /exec endpoint
```

## Deploy, in order

1. **Sheet.** Create a new Google Sheet.
2. **Script.** In the Sheet, open *Extensions → Apps Script*. Replace `Code.gs` with `apps-script/Code.gs`. In *Project Settings*, tick "Show appsscript.json" and paste in `apps-script/appsscript.json`.
3. **Run `setup()`** once from the editor and approve the permissions. It does the following:
   - sets the timezone to `Africa/Lagos` and the locale to Nigeria
   - creates the `Enugu`, `Bayelsa` and `All` tabs, with bold, frozen headers
   - adds the `Status` dropdown (New / Verified / Contacted / Rejected)
   - writes the `QUERY` formula and a summary block (counts per state) to `All`
   - protects columns A–C on both state tabs, plus the whole `All` tab, so that only the owner can edit them
   - saves `SPREADSHEET_ID` and a random `FORM_TOKEN` in Script Properties, and **prints the token in the execution log**
4. **Deploy** with *Deploy → New deployment → Web app*. Set *Execute as: Me* and *Who has access: Anyone*. Copy the `/exec` URL.
5. **Configure the front end.** At the top of `site/assets/app.js`, set `REG_CONFIG.endpoint` to the `/exec` URL and `REG_CONFIG.token` to the logged token. Add a Bayelsa contact for corrections in `states.Bayelsa.contact`.
6. **Publish** the `site/` folder to Netlify, Vercel or GitHub Pages. All of them serve `/enugu` and `/bayelsa` as real paths.
7. Run the manual checks below, then delete the test rows.
8. **Share the Sheet** with the host as **Editor** only. Do not turn on link sharing. To export, use *File → Download → Microsoft Excel (.xlsx)*, which keeps all three tabs.

> Every change to `Code.gs` needs *Deploy → Manage deployments → Edit → Version: New version*. Saving alone keeps the old code running at the same URL.

> The token is public because it sits in the page source. It slows down scripted posts but is not authentication.

## Sheet columns

| Col | Header | Notes |
|---|---|---|
| A | Submission ID | `ENU-0001` / `BAY-0001`. The number is the highest existing ID + 1, so IDs stay unique even if a row is deleted |
| B | Timestamp | Server time, Lagos |
| C | State | Taken from the route, never from a user field |
| D | Status | The backend writes `New`; after that only the host edits it |
| E | Full Name | |
| F | Gender | Male / Female |
| G | Date of Birth | |
| H | NIN | 11 digits, stored as text |
| I | Phone | Normalised to `0XXXXXXXXXX` and stored as text. Used as the duplicate check across both tabs |
| J | WhatsApp | Optional, normalised |
| K | Email | Optional |
| L | LGA | Only that state's LGAs are accepted |
| M | Address | |
| N | Highest Education | |
| O | Experience | Optional |
| P | Next of Kin Name | |
| Q | Next of Kin Phone | Normalised |
| R | Consent | `Yes` |

Both states use the same fields, taken from the supplied frontend design. The supplied source documents were promotional flyers, not paper forms, so there were no form fields to remove for Bayelsa. The areas marked on the Bayelsa image were the flag-off **date, venue and time** and the **"Special Guest of Honour" / "Host / Convener"** captions. These were already removed from the banner (`assets/bayelsa-banner.png`), and they were never form fields. If the forms need to differ later, give Bayelsa its own field list in `STATES` in `Code.gs` and in `fields.js`. Columns A–D will still line up in `All`.

To keep a phone number or NIN as text, the backend writes it with a leading apostrophe (`'080…`). Sheets hides the apostrophe and stores the value as text. This also blocks formula injection (`=`, `+`, `-`, `@`). The leading zero survives the `.xlsx` export.

## Develop & test

```bash
node --test tests/backend.test.mjs     # spec tests 1,2,4–7,9–12 + schema parity, all against Code.gs
node tests/dev-server.mjs               # http://localhost:8080, mock endpoint, GET /__sheet to inspect rows
```

Only the dev server points `app.js` at the mock `/exec`. It changes nothing on disk.

## Still to confirm with the host (from the spec's open items)

- The **data controller** named on the privacy line. Defaults are set in `REG_CONFIG.states.*.dataController`.
- A **Bayelsa contact** for corrections. Until one is added, the duplicate message gives a generic "contact the organisers".
- A **closing date**, if any. At present the forms stay open.
- Whether a registration should also be **unique per NIN or email**. At present only phone numbers are checked.
- `assets/bayelsa-banner.png` is about 1 MB. Compressing it to WebP or JPEG (about 150 KB) would help on weak connections.
