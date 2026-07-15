// Backfills ci.yml's dummy env so `bun test` also runs without an .env (fresh clone). ??= keeps
// any real .env or CI-provided value; pg pools are lazy and no test ever issues a query.
process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci";
process.env.JWT_SECRET ??= "ci-test-secret";
process.env.SECRET_MASTER_KEY ??= "Y2ktdGVzdC1tYXN0ZXIta2V5LTMyLWJ5dGVzLWxvbmc=";
