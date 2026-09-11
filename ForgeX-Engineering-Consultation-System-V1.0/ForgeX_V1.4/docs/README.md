# ForgeX Engineering Consultation System — v1.0.0

Professional Arabic (RTL), tablet-first web application for engineers to run
customer consultations, manage projects, and generate engineering reports —
entirely client-side, no backend or internet connection required after the
first load (fonts are loaded from Google Fonts; everything else is local).

---

## 1. How to run it

1. Unzip `ForgeX-Engineering-Consultation-System-V1.0.zip`.
2. Open **`index.html`** directly in Google Chrome (double-click it, or drag it into a Chrome window).
3. That's it — no server, no build step, no npm install. The app seeds itself with demo data on first run.

> Internet is only used to load the Google Fonts (Tajawal / IBM Plex Sans Arabic / JetBrains Mono).
> If Chrome has no internet access, the app still works fully — it just falls back to system fonts.

---

## 2. Folder structure

```
ForgeX/
├── index.html              ← main entry point (the Home dashboard)
├── home.html                 (redirect stub → index.html, kept for old links)
├── wizard.html                10-step Engineering Consultation Wizard
├── customers.html             Customer Management (CRUD + history)
├── projects.html              Project Management (status, timeline, attachments)
├── settings.html               Company/system settings, backup & restore
├── report.html                 A4 printable PDF report generator
├── manifest.webmanifest        PWA manifest (installable app shell)
├── sw.js                       Service worker (offline app-shell caching)
│
├── css/
│   ├── forgex-core.css         Shared design system: tokens, shell, buttons,
│   │                           forms, badges, modals, toasts, dark mode
│   ├── index.css                page-specific: home dashboard
│   ├── customers.css            page-specific: customer management
│   ├── projects.css             page-specific: project management, timeline
│   ├── settings.css             page-specific: settings
│   └── report.css               page-specific: printable report + print rules
│
├── js/
│   ├── forgex-db.js             ★ the ONLY file that touches localStorage.
│   │                           Exposes window.ForgeXDB (detailed API) and
│   │                           window.database (flat alias) — see §6.
│   └── forgex-utils.js          Shared UI plumbing: toasts, confirm dialog,
│                               loading overlay, dark-mode toggle, file helpers
│
├── assets/
│   └── logo.svg                 ForgeX brand mark (scalable, used in reports)
│
├── data/
│   ├── sample-data.json         Importable demo dataset (Settings → Restore)
│   └── backup-template.json     Blank backup shape reference
│
└── docs/
    └── README.md                 this file
```

---

## 3. Feature summary by phase

| Phase | What it added |
|---|---|
| 1–4 | Architecture, UI kit, Home dashboard, 10-step Consultation Wizard |
| 5 | LocalStorage data layer, Customer & Project management, global search, smart conditional wizard fields, autosave drafts |
| 6 | PDF report generator, full attachment manager (upload/preview/delete), Settings page (company profile, dark mode, backup/restore), 7-stage project workflow with activity timeline, toast/confirm UX, folder/module restructure, service-worker offline shell, sample data |

### Data model (all in LocalStorage, one JSON array per key)
`forgex.customers` · `forgex.projects` · `forgex.consultations` · `forgex.attachments` · `forgex.reports` · `forgex.settings` · `forgex.users` (stub) · `forgex.consultationDraft` · `forgex.meta` (ID sequences)

### Project lifecycle
عميل محتمل (New Lead) → استشارة (Consultation) → مراجعة هندسية (Engineering Review) → عرض سعر (Quotation) → معتمد (Approved) → تصنيع (Manufacturing) → مكتمل (Completed), with **مرفوض (Rejected)** available as a branch from any stage. Every status change is appended to that project's `history[]` array and shown as an activity timeline in the project detail view.

### Project codes
Generated as `FGX-{year}-{0001, 0002, …}` by `ForgeXDB.projects.nextCode()`, sequential per year, tracked in `forgex.meta`.

---

## 4. Backup & Restore

**Settings → النسخ الاحتياطي (Backup)**

- **تصدير JSON (Export)** downloads a single `forgex-backup-YYYY-MM-DD.json` file containing customers, projects, consultations, attachments, reports, and settings.
- **استيراد ملف (Import)** reads a JSON file, validates its shape (rejects anything that isn't a recognizable ForgeX backup), shows a confirmation dialog with record counts, and only overwrites LocalStorage after you confirm.
- **حذف جميع البيانات (Wipe all data)** is a separate, clearly-labelled danger-zone action with its own confirmation.
- `data/sample-data.json` can be imported the same way to quickly load a demo dataset for testing or presentations.

---

## 5. PDF Reports

`report.html?projectId=<id>` (opened via the "إنشاء تقرير PDF" button on a project's detail view) renders a print-optimized A4 document and exports it via the browser's native **Print → Save as PDF**, rather than a JS PDF library. This was a deliberate choice: it works fully offline, and Chrome's print dialog supplies real page numbers/headers if you enable "Headers and footers."

Four templates are supported (auto-detected from the project's service type, or overridable from the toolbar dropdown): **CNC Machining, Laser Cutting, Reverse Engineering, 3D Printing** — each shows only its relevant manufacturing-requirement fields. The report includes company branding, report number (auto-generated, sequential), date, project code, customer info, project summary, engineering/manufacturing/material/production/quality sections, engineering notes, attached images, an editable technical-recommendations field, and touch/mouse signature pads for both customer and engineer.

---

## 6. Architecture note for the next developer

**Never call `localStorage` directly from a page.** Everything goes through `js/forgex-db.js`, which is exposed two ways:

```js
// detailed, grouped API
ForgeXDB.customers.create({...});
ForgeXDB.projects.setStatus(id, 'معتمد');

// flat alias (the shape a cloud migration keeps)
database.createCustomer({...});
database.setProjectStatus(id, 'معتمد');
```

To migrate to Firebase/Supabase later: rewrite the bodies of the functions inside `forgex-db.js` to call the cloud SDK instead of `localStorage.getItem/setItem`, keeping the same function names and return shapes. No other file should need to change.

**Known scope trade-off:** page-controller JavaScript (the `<script>` block inside each `wizard.html` / `customers.html` / etc.) is still inline rather than split into `/js/pages/*.js`. The shared, reusable layers (data + UI utils) are fully modular; splitting the last-mile page logic out is a safe, mechanical follow-up that wasn't done in this pass to avoid rushed breakage across five large files.

---

## 7. Future recommendations

- Extract per-page controller JS into `/js/pages/*.js` for easier code review and testing.
- Replace `forgex-db.js`'s internals with real Firebase/Supabase calls (see §6) — the flat `database.*` API surface is designed not to change.
- Add real multi-user auth (the `forgex.users` collection is stubbed but unused).
- Add a proper reports index page (report *records* already exist in `forgex.reports`; there's no browse/list UI for them yet).
- Consider a JS PDF library (e.g. pdf-lib) only once the app is guaranteed to always have internet access — until then, print-to-PDF is the more reliable offline choice.
- Add automated tests around `forgex-db.js`, since it's the single seam everything else depends on.

---

## 8. Testing checklist (performed before this release)

- [x] `index.html` opens directly in Chrome via double-click (file:// protocol)
- [x] Navigation between all pages (Home, Customers, Projects, Wizard, Settings, Report)
- [x] Data persists across page reloads (LocalStorage)
- [x] Create / edit / delete a customer
- [x] Create a project (via the wizard) and see it appear with a unique `FGX-YYYY-NNNN` code
- [x] Generate a PDF report for a seeded project and an empty one (graceful "no project" state)
- [x] Export a backup, then import `data/sample-data.json` and confirm the confirmation dialog + record counts
- [x] Upload an image attachment (preview renders) and a non-image file (icon + metadata only)
- [x] Resize to tablet width (768–1024px) and phone width (<600px) — sidebar collapses to bottom tab bar, forms/tables reflow
- [x] Service worker registration is skipped gracefully on `file://` (no console errors) and only attempts on `http(s)://`
