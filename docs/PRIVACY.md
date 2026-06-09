# Privacy & Data Handling

This project is designed with a privacy-first approach. Key principles:

- Local-first storage: Usage data (sessions, timers, preferences) is stored locally in the user's browser using `localStorage` or `IndexedDB`. No external servers are contacted by default.
- Minimal data: Only high-level usage metrics are recorded (durations, timestamps, basic site domains as optional labels). No personally-identifiable profiling or content scraping is performed.
- Configurable retention: Implementations should add settings that allow parents to clear history and set automatic retention periods.
- Transparent by design: Consider adding an in-app "Privacy" screen that explains what is collected and how to clear it.

Recommendations for maintainers
--------------------------------
- Avoid shipping telemetry that sends user data off-device without an explicit, opt-in consent flow.
- When adding exports (CSV, etc.), clearly label the exported fields and avoid including full URLs or page content unless explicitly requested.
- For multi-device setups consider an explicit opt-in server component and document how data is transferred and secured.
