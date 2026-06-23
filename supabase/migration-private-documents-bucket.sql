-- ─────────────────────────────────────────────
-- Make the `documents` storage bucket PRIVATE (security fix — audit Critical #1).
-- Previously public: any object URL was world-readable. Now private; the app reads
-- via 60-min signed URLs minted server-side (service role) at /api/storage/sign.
-- Applied live; recorded here for parity. Idempotent.
-- ─────────────────────────────────────────────
UPDATE storage.buckets SET public = FALSE WHERE id = 'documents';
