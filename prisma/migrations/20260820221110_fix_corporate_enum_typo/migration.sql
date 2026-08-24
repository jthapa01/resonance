/*
  Warnings:

  - The values [CPRPORATE] on the enum `VoiceCategory` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "VoiceCategory_new" AS ENUM ('AUDIOBOOK', 'CONVERSATIONAL', 'CUSTOMER_SERVICE', 'GENERAL', 'NARRATIVE', 'CHARACTERS', 'MEDITATION', 'MOTIVATIONAL', 'PODCAST', 'ADVERTISING', 'VOICEOVER', 'CORPORATE');
ALTER TABLE "public"."Voice" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "Voice" ALTER COLUMN "category" TYPE "VoiceCategory_new" USING ("category"::text::"VoiceCategory_new");
ALTER TYPE "VoiceCategory" RENAME TO "VoiceCategory_old";
ALTER TYPE "VoiceCategory_new" RENAME TO "VoiceCategory";
DROP TYPE "public"."VoiceCategory_old";
ALTER TABLE "Voice" ALTER COLUMN "category" SET DEFAULT 'GENERAL';
COMMIT;
