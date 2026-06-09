# Documentation Index

This folder contains documentation and guides for the project.

Included docs
-------------
- `INSTALL.md` — local install and development steps
- `PRIVACY.md` — privacy and data-handling guidance

Suggested additions
-------------------
- `screens.md` — a guided walkthrough with screenshots for each major UI view (`popup`, `dashboard`).
- `faq.md` — frequently asked questions for parents and administrators.

How to add screenshots and GIFs
------------------------------
1. Place images into `assets/` (e.g., `assets/screenshot-1.png`, `assets/preview.gif`).
2. Optimize images for web (compressed PNG or small GIF).
3. Reference them from `README.md` using relative paths.

Troubleshooting
---------------
- If charts do not render, ensure `lib/chart.min.js` is present and `dashboard.html` is opened in a browser (some features require the extension context).
- For background script errors, open Chrome Extensions -> Inspect views and check console logs.
