-- CreateTable
CREATE TABLE "Application" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "board" TEXT,
    "source" TEXT NOT NULL,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stage" TEXT NOT NULL DEFAULT 'applied',
    "outcome" TEXT,
    "rejectedAt" DATETIME,
    "matchScore" INTEGER,
    "matchReason" TEXT,
    "failReason" TEXT,
    "runId" TEXT,
    "normalizedTitle" TEXT NOT NULL,
    "normalizedCompany" TEXT NOT NULL,
    CONSTRAINT "Application_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("runId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StageEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "applicationId" INTEGER NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "note" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StageEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BatchInput" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scope" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "JobBoard" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "searchUrl" TEXT,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "email" TEXT,
    "password" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "linkedin" TEXT,
    "github" TEXT,
    "street" TEXT,
    "aptUnit" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "usAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "requiresSponsorship" BOOLEAN NOT NULL DEFAULT false,
    "visaStatus" TEXT,
    "optExtension" TEXT,
    "willingToRelocate" BOOLEAN NOT NULL DEFAULT false,
    "preferredLocations" TEXT NOT NULL DEFAULT '[]',
    "eeoGender" TEXT,
    "eeoRace" TEXT,
    "eeoEthnicity" TEXT,
    "eeoHispanicOrLatino" TEXT,
    "eeoVeteranStatus" TEXT,
    "eeoDisabilityStatus" TEXT,
    "defaultResumeId" INTEGER,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_defaultResumeId_fkey" FOREIGN KEY ("defaultResumeId") REFERENCES "Resume" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AutopilotSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "profileId" INTEGER NOT NULL,
    "minMatchScore" INTEGER NOT NULL DEFAULT 6,
    "maxApplicationsPerRun" INTEGER NOT NULL DEFAULT 20,
    "confirmMode" TEXT NOT NULL DEFAULT 'batch',
    "skipCompanies" TEXT NOT NULL DEFAULT '[]',
    "skipTitleKeywords" TEXT NOT NULL DEFAULT '[]',
    "minSalary" INTEGER NOT NULL DEFAULT 0,
    "maxSalary" INTEGER NOT NULL DEFAULT 0,
    "salaryExpectation" TEXT,
    "defaultStartDate" TEXT NOT NULL DEFAULT '2 weeks notice',
    CONSTRAINT "AutopilotSettings_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Resume" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL,
    "profileId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Resume_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Run" (
    "runId" TEXT NOT NULL PRIMARY KEY,
    "query" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "config" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '{}'
);

-- CreateTable
CREATE TABLE "RunJob" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "runId" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "salary" TEXT,
    "type" TEXT,
    "url" TEXT NOT NULL,
    "board" TEXT,
    "matchScore" INTEGER,
    "matchReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "appliedAt" DATETIME,
    "failReason" TEXT,
    "retryNotes" TEXT,
    "skipReason" TEXT,
    "description" TEXT,
    CONSTRAINT "RunJob_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("runId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("runId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_url_key" ON "Application"("url");

-- CreateIndex
CREATE INDEX "Application_normalizedTitle_normalizedCompany_idx" ON "Application"("normalizedTitle", "normalizedCompany");

-- CreateIndex
CREATE INDEX "Application_appliedAt_idx" ON "Application"("appliedAt");

-- CreateIndex
CREATE INDEX "Application_runId_idx" ON "Application"("runId");

-- CreateIndex
CREATE INDEX "StageEvent_applicationId_occurredAt_idx" ON "StageEvent"("applicationId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "BatchInput_url_key" ON "BatchInput"("url");

-- CreateIndex
CREATE INDEX "BatchInput_status_idx" ON "BatchInput"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Credential_scope_key" ON "Credential"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "JobBoard_domain_key" ON "JobBoard"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_defaultResumeId_key" ON "Profile"("defaultResumeId");

-- CreateIndex
CREATE UNIQUE INDEX "AutopilotSettings_profileId_key" ON "AutopilotSettings"("profileId");

-- CreateIndex
CREATE INDEX "RunJob_runId_status_idx" ON "RunJob"("runId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RunJob_runId_jobKey_key" ON "RunJob"("runId", "jobKey");

-- CreateIndex
CREATE INDEX "RunEvent_runId_createdAt_idx" ON "RunEvent"("runId", "createdAt");
