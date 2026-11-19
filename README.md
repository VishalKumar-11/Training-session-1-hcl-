# DocLocker — Personal Document Vault Prototype

DocLocker is a modern, responsive document management web application inspired by DigiLocker and built using **HTML5**, **CSS3**, and **Vanilla JavaScript** (zero frontend frameworks).

## Project Structure

```
DocLocker/
│
├── index.html          # Landing page (Hero, Features, About, FAQs, Footer)
├── login.html          # Sign-in page with 3-attempt lockout demonstration
├── register.html       # Account registration with password strength & matching
├── dashboard.html      # Protected workspace overview, Backup & Restore, Profile
├── upload.html         # Drag-and-drop upload with format/size validation & progress
├── documents.html      # Document library with search, category filters & preview
│
├── css/
│   └── style.css       # Complete responsive design system
│
├── js/
│   ├── main.js         # Landing page navigation, mobile drawer & FAQ accordion
│   ├── auth.js         # Registration, login validation & 3-attempt lockout logic
│   └── dashboard.js    # Vault metrics, upload validation, search, backup & restore
│
├── assets/
│   ├── logo.svg        # Original DocLocker vector logo
│   ├── logo-white.svg  # Light wordmark variant for dark navy sidebar/footer
│   └── images/         # Custom vector document-security illustrations
│
└── README.md
```

## Demo Credentials

- **User ID:** `vishal2026`
- **Password:** `Vault@2026`

You can also register a new demo account via `register.html`.

## Key Features Implemented

- **Landing Page (`index.html`)**: DigiLocker-inspired light-blue and royal blue (`#0645D9`) design, floating category cards (Aadhaar, PAN, Marksheets, Certificates), feature highlights, About, Platform Capabilities, and interactive FAQs.
- **Authentication & Security Demo (`login.html`, `register.html`)**: Password strength meter, password matching, show/hide toggle, Forgot Password UI preview modal, and a consecutive failed login counter that triggers a 30-second temporary lockout after 3 invalid attempts.
- **Dashboard & Backup (`dashboard.html`)**: Live document count and storage usage indicator, Recent Uploads list, simulated Backup & Restore snapshot workflow (with `.json` archive export), and Profile editor.
- **Document Upload (`upload.html`)**: Drag-and-drop zone supporting `PDF`, `JPG`, `JPEG`, and `PNG` up to `10 MB` with file preview and progress bar.
- **My Documents (`documents.html`)**: Real-time search, category tabs, Grid/List view switch, in-page document preview modal, download, and confirmation-guarded deletion.

## Prototype Disclaimer

This is a **student frontend prototype**. User accounts, login lockouts, document storage, and backup snapshots are simulated locally in your browser using `localStorage` and `sessionStorage`. It does **not** provide real backend authentication, server-side encryption, or cloud storage. Do not upload real government identity documents or use real personal passwords when testing.
