# EV Trainee Registration (Enugu & Bayelsa)

A public sign-up link for EV skills trainees. Trainees pick their state and fill in a short form. Each submission lands in one Google Sheet, with separate `Enugu` and `Bayelsa` tabs, and the host downloads the Sheet as Excel.

- **`site/`** is the static website (plain HTML/CSS/JS, no build step). Its pages are `/`, `/enugu` and `/bayelsa`.
- **`apps-script/Code.gs`** is the Google Apps Script backend, and the only thing that writes to the Sheet.
- **`tests/`** has the backend tests and a local preview server.

## Quick start

1. In a new Google Sheet, open **Extensions → Apps Script** and paste in `apps-script/Code.gs`.
2. Run `setup()` once. Copy the `FORM_TOKEN` it prints.
3. Deploy it as a **Web app** (Execute as: Me, access: Anyone) and copy the `/exec` URL.
4. Put the URL and token into `REG_CONFIG` at the top of `site/assets/app.js`.
5. Publish `site/` on Netlify, Vercel or GitHub Pages. Share the Sheet with the host as Editor.

Every change to `Code.gs` needs a **new deployment version**. Saving alone doesn't update the live URL.

## State links

| Link | Opens |
|---|---|
| `enugu-ev-registration.vercel.app` | Enugu page only |
| `bayelsa-ev-registration.vercel.app` | Bayelsa page only |
| main address, `/enugu` or `/bayelsa` | that state's page |
| main address, `/` | "Which state are you from?" chooser |

The state addresses must be added to the Vercel project (**Settings → Domains**). Routing is in `site/vercel.json`, so if you use different names or a custom domain, change the `host` values there. "← Change state" only shows for trainees who came through the chooser.

## Local development

```bash
node tests/dev-server.mjs                 # preview at http://localhost:8080 (mock backend)
node --test tests/backend.test.mjs        # backend tests
```

For full setup, the column layout and open questions, see [docs/SETUP.md](docs/SETUP.md).
# EV-Trainee
