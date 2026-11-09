---
name: solve-captcha
description: Solve a CAPTCHA on the current browser tab - free checkbox and text paths first, then a configured token service for image challenges. Returns solved or unsolved for the caller to fall back.
argument-hint: "[url | ref_or_description] (optional; a URL is opened first; omit to auto-detect)"
---

# Solve CAPTCHA

Clear a CAPTCHA on the current tab, for the user's own applications only. Return **solved** or
**unsolved**; on unsolved, leave the page as it is for the caller.

## 1. Identify

A URL argument: open it first. `browser_resize` to 1280x1400 so the widget is fully visible, then
snapshot and `browser_take_screenshot` it:

- **Checkbox** (reCAPTCHA "I'm not a robot", hCaptcha, Turnstile): step 2. Always try this first.
- **Text** (distorted characters and an answer field): step 3.
- **Image grid** already open: step 4.
- **Slider or unknown**: unsolved.

## 2. Checkbox

`browser_click` the checkbox ref, wait, snapshot. Verified: solved. An image grid opened: step 4.
Never click grid tiles yourself; automated clicks get flagged.

## 3. Text

Read the characters from a screenshot, `browser_type` them, submit. Verified: solved.

## 4. Token service

Read the sitekey with `browser_evaluate`:

```js
() => {
  const el = document.querySelector(".g-recaptcha, [data-sitekey]");
  let key = el?.getAttribute("data-sitekey");
  if (!key) {
    const src = [...document.querySelectorAll('iframe[src*="recaptcha"]')]
      .map((f) => f.src)
      .find((s) => /[?&]k=/.test(s));
    key = src && new URL(src).searchParams.get("k");
  }
  return { sitekey: key, pageurl: location.href };
};
```

hCaptcha (`iframe[src*="hcaptcha"]`) is `type:"hcaptcha"`; Turnstile (`.cf-turnstile[data-sitekey]`)
is `type:"turnstile"`. The server holds the service key and polls the provider:

```bash
jobpilot-api POST /api/captcha/solve --data '{"type":"recaptcha","sitekey":"<sitekey>","pageurl":"<pageurl>"}'
```

A failed call or an empty `.token` (no key configured, or the service failed): unsolved.

Inject the token with `browser_evaluate`, then `browser_click` the form's submit ref:

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

hCaptcha uses `h-captcha-response`; Turnstile uses `cf-turnstile-response`. Wait, verify: solved.

## Rules

- At most 3 rounds, then unsolved.
- Click widgets only with `browser_click` on a ref. Never fake a click with `browser_evaluate`,
  `.click()` or `scrollIntoView`: reCAPTCHA detects synthetic clicks and hard-fails. Scripts only
  read the sitekey and inject a token.
