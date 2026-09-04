-- Rename legacy `r2ObjectKey` column to `storageKey` (migrated R2 -> Azure Blob).
-- RENAME preserves existing data; Prisma's default diff would DROP/ADD and lose it.
ALTER TABLE "Voice" RENAME COLUMN "r2ObjectKey" TO "storageKey";
ALTER TABLE "Generation" RENAME COLUMN "r2ObjectKey" TO "storageKey";
