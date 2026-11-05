-- The applicant fields leave the account table: users keeps sign-in and ownership, profiles keeps
-- who the person is on applications and the public portfolio.
CREATE TABLE "profiles" (
    "user_id" TEXT NOT NULL,
    "availability" "availability",
    "show_resume" BOOLEAN NOT NULL DEFAULT false,
    "show_website" BOOLEAN NOT NULL DEFAULT false,
    "show_linkedin" BOOLEAN NOT NULL DEFAULT false,
    "show_github" BOOLEAN NOT NULL DEFAULT false,
    "first_name" TEXT NOT NULL DEFAULT '',
    "last_name" TEXT NOT NULL DEFAULT '',
    "contact_email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "website" TEXT,
    "linkedin" TEXT,
    "github" TEXT,
    "street" TEXT,
    "apt_unit" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip_code" TEXT,
    "country" TEXT,
    "us_authorized" BOOLEAN NOT NULL DEFAULT false,
    "requires_sponsorship" BOOLEAN NOT NULL DEFAULT false,
    "visa_status" TEXT,
    "opt_extension" TEXT,
    "willing_to_relocate" BOOLEAN NOT NULL DEFAULT false,
    "preferred_locations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "eeo_gender" TEXT,
    "eeo_race" TEXT,
    "eeo_ethnicity" TEXT,
    "eeo_hispanic_or_latino" TEXT,
    "eeo_veteran_status" TEXT,
    "eeo_disability_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

INSERT INTO "profiles" (
    "user_id", "availability", "show_resume", "show_website", "show_linkedin", "show_github",
    "first_name", "last_name", "contact_email", "phone", "website", "linkedin", "github",
    "street", "apt_unit", "city", "state", "zip_code", "country",
    "us_authorized", "requires_sponsorship", "visa_status", "opt_extension", "willing_to_relocate",
    "preferred_locations", "eeo_gender", "eeo_race", "eeo_ethnicity", "eeo_hispanic_or_latino",
    "eeo_veteran_status", "eeo_disability_status", "created_at", "updated_at"
)
SELECT
    "id", "availability", "show_resume", "show_website", "show_linkedin", "show_github",
    "first_name", "last_name", "contact_email", "phone", "website", "linkedin", "github",
    "street", "apt_unit", "city", "state", "zip_code", "country",
    "us_authorized", "requires_sponsorship", "visa_status", "opt_extension", "willing_to_relocate",
    "preferred_locations", "eeo_gender", "eeo_race", "eeo_ethnicity", "eeo_hispanic_or_latino",
    "eeo_veteran_status", "eeo_disability_status", "created_at", "updated_at"
FROM "users";

ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users"
    DROP COLUMN "availability",
    DROP COLUMN "show_resume",
    DROP COLUMN "show_website",
    DROP COLUMN "show_linkedin",
    DROP COLUMN "show_github",
    DROP COLUMN "first_name",
    DROP COLUMN "last_name",
    DROP COLUMN "contact_email",
    DROP COLUMN "phone",
    DROP COLUMN "website",
    DROP COLUMN "linkedin",
    DROP COLUMN "github",
    DROP COLUMN "street",
    DROP COLUMN "apt_unit",
    DROP COLUMN "city",
    DROP COLUMN "state",
    DROP COLUMN "zip_code",
    DROP COLUMN "country",
    DROP COLUMN "us_authorized",
    DROP COLUMN "requires_sponsorship",
    DROP COLUMN "visa_status",
    DROP COLUMN "opt_extension",
    DROP COLUMN "willing_to_relocate",
    DROP COLUMN "preferred_locations",
    DROP COLUMN "eeo_gender",
    DROP COLUMN "eeo_race",
    DROP COLUMN "eeo_ethnicity",
    DROP COLUMN "eeo_hispanic_or_latino",
    DROP COLUMN "eeo_veteran_status",
    DROP COLUMN "eeo_disability_status";
