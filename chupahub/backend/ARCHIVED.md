# Archived legacy backend

`chupahub/backend` is historical PHP code only. The production application is
the Next.js frontend backed directly by Supabase; this directory must not be
deployed, pointed at by Vercel, or given production database credentials.

Keeping this marker beside the old code makes the archive status explicit and
prevents it from becoming a second source of truth. Any future backend service
must be designed as a separate, reviewed integration with Supabase, not by
reactivating this directory.
