-- CreateTable
CREATE TABLE "UpworkProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "currentTitle" TEXT,
    "currentOverview" TEXT,
    "currentHourlyRate" TEXT,
    "currentPortfolio" TEXT NOT NULL DEFAULT '[]',
    "suggestedTitle" TEXT,
    "suggestedOverview" TEXT,
    "suggestedHourlyRate" TEXT,
    "suggestedPortfolio" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'empty',
    "updatedAt" DATETIME NOT NULL,
    "appliedAt" DATETIME,
    CONSTRAINT "UpworkProfile_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UpworkProposal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "profileId" INTEGER NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "clientName" TEXT,
    "jobUrl" TEXT,
    "jobDescription" TEXT,
    "proposalText" TEXT NOT NULL DEFAULT '',
    "screeningAnswers" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "outcome" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "campaignId" TEXT,
    "jobKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "submittedAt" DATETIME,
    CONSTRAINT "UpworkProposal_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UpworkProposal" ("clientName", "createdAt", "id", "jobDescription", "jobTitle", "jobUrl", "notes", "outcome", "profileId", "proposalText", "screeningAnswers", "status", "submittedAt", "updatedAt") SELECT "clientName", "createdAt", "id", "jobDescription", "jobTitle", "jobUrl", "notes", "outcome", "profileId", "proposalText", "screeningAnswers", "status", "submittedAt", "updatedAt" FROM "UpworkProposal";
DROP TABLE "UpworkProposal";
ALTER TABLE "new_UpworkProposal" RENAME TO "UpworkProposal";
CREATE INDEX "UpworkProposal_profileId_idx" ON "UpworkProposal"("profileId");
CREATE INDEX "UpworkProposal_profileId_status_idx" ON "UpworkProposal"("profileId", "status");
CREATE INDEX "UpworkProposal_campaignId_idx" ON "UpworkProposal"("campaignId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "UpworkProfile_profileId_key" ON "UpworkProfile"("profileId");
