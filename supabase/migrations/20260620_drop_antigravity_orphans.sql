-- Drop 21 Antigravity orphan tables (safe: no active code refs, no active FK deps)
-- CASCADE only affects FKs within this orphan cluster
DROP TABLE IF EXISTS
  "BelieveCatalogTakeover",
  "MusicTitles",
  "OfficeLedger",
  "RevenueCutoverAudit",
  "RevenueSync",
  "SocialAccount",
  "StaffClearance",
  "TalentSubmission",
  "TrackMetadata",
  "WorkspaceAccount",
  artists,
  contracts,
  financial_reports,
  pipelines,
  raw_earning_line_items,
  artist_payout_ledger,
  releases,
  tracks,
  royalty_splits,
  takeover_compliance,
  scheduled_tasks
CASCADE;
