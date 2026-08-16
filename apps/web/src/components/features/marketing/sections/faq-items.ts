/** Landing-page FAQ - rendered by `Faq` and emitted as FAQPage JSON-LD from the landing page. */
export const FAQ_ITEMS = [
  {
    q: "What does it cost?",
    a: "Nothing. JobPilot is free and MIT-licensed, and the whole project is one public repository on GitHub. Your only cost is the Claude or Codex subscription you already have.",
  },
  {
    q: "Do I need an API key?",
    a: "No. The agent runs inside Claude Code or Codex, so the AI work comes out of the subscription you already pay for. There's nothing to top up and no per-token bill from us.",
  },
  {
    q: "Which AI model should I use?",
    a: "A mid-tier one: Claude Sonnet 5 or GPT 5.6 Terra. Avoid top-tier models like Claude Opus 5. Applying to jobs is reading postings and filling forms, not hard reasoning, so the top tier eats your weekly usage limits far faster without applying to more jobs. JobPilot starts Claude Code on Sonnet for you; on Codex, set your own model.",
  },
  {
    q: "Where does the agent run?",
    a: "On your computer. Your dashboard lives on the web, but the AI session and the browser doing the actual applying run locally, so you can watch it work and stop it at any point.",
  },
  {
    q: "Which job boards are supported?",
    a: "Eleven are built in, among them LinkedIn, Indeed, HN Who's Hiring, and Upwork. And since the agent drives a real browser, you can add any other board from the boards page. It isn't limited to a fixed list.",
  },
  {
    q: "Can it read and send email?",
    a: "Yes, if you connect Gmail through your own Google OAuth client, so no shared app ever touches your mail. That's how it sorts recruiter replies, fetches verification codes, and sends networking messages.",
  },
  {
    q: "What about captchas?",
    a: "Checkbox and text captchas it solves on its own. For image puzzles it uses your 2Captcha or CapSolver key if you've added one; if you haven't, it skips that job and tells you why.",
  },
] as const;
