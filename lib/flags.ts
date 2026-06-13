// Master switch for AI WEB-SEARCH features only:
//   • Box-office auto-fetch (our films)        • Piracy / reputation scans
//   • Campaign asset "track buzz"              • Malayalam industry tracker
// Turned OFF for now (Anthropic credits paused / cost control). Non-web-search
// AI — bill extraction, document analysis, briefings, Ask OPM, stage
// classification, collection trend read — is unaffected.
// Flip to true (and redeploy) to re-enable everything web-search powered.
export const WEB_SEARCH_ENABLED = false
