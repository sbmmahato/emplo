-- AlterEnum
ALTER TYPE "GoclawOAuthProvider" ADD VALUE 'github';

-- AlterTable
ALTER TABLE "GoclawOAuthState" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "GoclawTenant" ADD COLUMN     "githubMcpServerId" VARCHAR(64);
