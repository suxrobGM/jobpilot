# Signing in

Sign in before using a site when a login resolves for it: many boards hide apply buttons and
results from guests.

## Check

Snapshot the header. A Sign in / Log in control or a password field means logged out; an account
or avatar menu means logged in.

## Credentials

```bash
jobpilot-api GET /api/credentials/resolve --query domain=<domain>
```

It returns `{ id, email, password, kind }` (the site's own login, else the default) or null. The
server picks; never choose from `/api/credentials` yourself. Null: continue logged out. Otherwise
use `email` and `password` exactly.

## Sign in

Click Sign in, snapshot the form, fill it, submit, wait. Then:

- **Accepted**: go back to the page you wanted.
- **No such account**: register without asking. Click Sign up, fill it from the profile and the
  resolved password, submit, and handle the email code if one follows.
- **Wrong password**: click Forgot password, submit the email, get the reset code or link (below),
  set a new password, save it with `PATCH /api/credentials/<id>` `{"password":"<new>"}`, and sign
  in again.
- **No response or an unknown page**: retry once, then continue logged out.

## Challenges

- **Email code or link**: run the `get-code` skill with the site's domain. `code`: type it. `link`:
  open it. `{}`: ask the user for the code.
- **CAPTCHA**: run the `solve-captcha` skill. Unsolved: ask the user to solve it in the browser and
  wait. Loop skills pause on a login CAPTCHA; in a job application the `job-applier` parks the job
  with a question instead.
- **2FA**: ask the user to complete it and wait.
- **Sign in with Google / LinkedIn**: ask before using it.

Confirm with a header snapshot after each challenge.
