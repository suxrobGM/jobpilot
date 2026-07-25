---
name: solve-captcha
description: Solve a CAPTCHA on the current browser tab - free checkbox/text paths first, then a configured token service for image challenges. Returns solved or unsolved for the caller to fall back.
argument-hint: "[url | ref_or_description] (optional; a URL → navigate there first; omit → auto-detect)"
---

# Solve CAPTCHA

Clear a CAPTCHA on the **current browser tab**. Return **solved** or **unsolved** (the caller falls back). Authorized use only - the user's own applications. `$JOBPILOT_API` / `$JOBPILOT_API_TOKEN` are injected by the terminal host.

## 1. Dispatch + identify

If the argument is a URL → `browser_navigate` there first. `browser_resize` to a tall viewport (`1280×1400`) so the widget is fully on-screen, then `browser_snapshot` + `browser_take_screenshot` the captcha and classify:

- **checkbox** (reCAPTCHA "I'm not a robot" / hCaptcha / Turnstile) → §2. **Always try this first** - it escalates to the service only if it opens an image challenge.
- **text** (distorted characters + answer field) → §3.
- **image-grid already open** (no checkbox to click) → §4 directly.
- **slider / unknown** → **unsolved**.

## 2. Checkbox (free, first)

`browser_click` the control by `ref`, `browser_wait_for`, re-snapshot. Verified → **solved**. An image grid opened instead → escalate to §4. **Never hand-click tiles** - automated clicks get flagged and fail.

## 3. Text (free)

`browser_take_screenshot`, read the characters, `browser_type` the answer, submit. Verified → **solved**.

## 4. Image-grid → token service

Read the sitekey (`browser_evaluate`, read-only):

```js
() => {
  const el = document.querySelector(".g-recaptcha, [data-sitekey]");
  let key = el?.getAttribute("data-sitekey");
  if (!key) {
    const f = [...document.querySelectorAll('iframe[src*="recaptcha"]')]
      .map((f) => f.src)
      .find((s) => /[?&]k=/.test(s));
    key = f && new URL(f).searchParams.get("k");
  }
  return { sitekey: key, pageurl: location.href };
};
```

hCaptcha: `iframe[src*="hcaptcha"]` → `type:"hcaptcha"`. Turnstile: `.cf-turnstile[data-sitekey]` → `type:"turnstile"`.

Solve it server-side (the endpoint resolves the configured key + polls the provider; the skill never sees the key):

```bash
RESP=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/captcha/solve" -H 'content-type: application/json' \
  -d "$(jq -n --arg s "$SITEKEY" --arg u "$PAGEURL" '{type:"recaptcha", sitekey:$s, pageurl:$u}')") || true
TOKEN=$(echo "$RESP" | jq -r '.token // empty')
```

Empty `TOKEN` (no key configured, or solver failure) → **unsolved**.

Inject the token (sanctioned `browser_evaluate` - a real solved token, not a faked click), then `browser_click` the form's submit `ref`:

```js
(t) => {
  document
    .querySelectorAll('textarea[name="g-recaptcha-response"], #g-recaptcha-response')
    .forEach((el) => {
      el.value = t;
      el.style.display = "";
    });
  try {
    for (const c of Object.values(window.___grecaptcha_cfg?.clients ?? {}))
      for (const o of Object.values(c))
        for (const m of Object.values(o ?? {}))
          if (typeof m?.callback === "function") m.callback(t);
  } catch {}
};
```

hCaptcha uses `h-captcha-response`; Turnstile uses `cf-turnstile-response`. `browser_wait_for`, verify → **solved**.

## Rules

- **Retry at most 3 rounds**, then **unsolved**. Never loop indefinitely.
- **Trusted clicks on widgets** - `browser_click` a `ref` only. Never fake a widget click with `browser_evaluate` / `.click()` / `scrollIntoView`; reCAPTCHA flags synthetic clicks and hard-fails. JS is only for reading the sitekey and injecting a service token.
- **unsolved** → leave the page as-is for the caller to take over.
- Service solves cost ~$1–3 / 1000. Narrow snapshots (`../_shared/browser-tips.md`).
