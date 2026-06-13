// Master switch for AI WEB-SEARCH features only:
//   • Box-office auto-fetch (our films)        • Piracy / reputation scans
//   • Campaign asset "track buzz"              • Malayalam industry tracker
// Re-enabled 2026-06-14 after Anthropic credits topped up (with auto-reload).
// Non-web-search AI — bill extraction, document analysis, briefings, Ask OPM,
// stage classification, collection trend read — is unaffected by this flag.
// Flip to false (and redeploy) to pause everything web-search powered.
export const WEB_SEARCH_ENABLED = true
