-- CreateEnum
CREATE TYPE "GoclawTenantStatus" AS ENUM ('pending', 'active', 'failed', 'disabled');

-- CreateEnum
CREATE TYPE "GoclawProvisioningJobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "GoclawOAuthProvider" AS ENUM ('slack', 'discord');

-- CreateTable
CREATE TABLE "GoclawTenant" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "goclawTenantId" VARCHAR(64) NOT NULL,
    "goclawSlug" VARCHAR(255),
    "encryptedApiKey" TEXT NOT NULL,
    "apiKeyPrefix" VARCHAR(32),
    "status" "GoclawTenantStatus" NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "provisionedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_GoclawTenant" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoclawProvisioningJob" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "status" "GoclawProvisioningJobStatus" NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_GoclawProvisioningJob" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationAiQuota" (
    "organizationId" UUID NOT NULL,
    "maxAgents" INTEGER NOT NULL DEFAULT 5,
    "maxMonthlyTokens" INTEGER,
    "tier" VARCHAR(32) NOT NULL DEFAULT 'free',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationAiQuota_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "GoclawOAuthState" (
    "id" UUID NOT NULL,
    "state" VARCHAR(128) NOT NULL,
    "organizationId" UUID NOT NULL,
    "provider" "GoclawOAuthProvider" NOT NULL,
    "redirectPath" VARCHAR(512) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_GoclawOAuthState" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoclawTenant_organizationId_key" ON "GoclawTenant"("organizationId");

-- CreateIndex
CREATE INDEX "IX_GoclawTenant_goclawTenantId" ON "GoclawTenant"("goclawTenantId");

-- CreateIndex
CREATE INDEX "IX_GoclawProvisioningJob_organizationId" ON "GoclawProvisioningJob"("organizationId");

-- CreateIndex
CREATE INDEX "IX_GoclawProvisioningJob_status" ON "GoclawProvisioningJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GoclawOAuthState_state_key" ON "GoclawOAuthState"("state");

-- CreateIndex
CREATE INDEX "IX_GoclawOAuthState_expiresAt" ON "GoclawOAuthState"("expiresAt");

-- AddForeignKey
ALTER TABLE "GoclawTenant" ADD CONSTRAINT "GoclawTenant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoclawProvisioningJob" ADD CONSTRAINT "GoclawProvisioningJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAiQuota" ADD CONSTRAINT "OrganizationAiQuota_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoclawOAuthState" ADD CONSTRAINT "GoclawOAuthState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
