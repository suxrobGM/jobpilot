/** Landing-page FAQ - rendered by `Faq` and emitted as FAQPage JSON-LD from the landing page. */
export const FAQ_ITEMS = [
  {
    q: "Do I need an API key?",
    a: "No. The agent runs on your existing Claude Code or Codex subscription. JobPilot ships no model keys and adds no usage fees.",
  },
  {
    q: "Where does the agent run?",
    a: "On your machine. The dashboard is hosted, but the terminal, the AI session, and the browser all run locally - you can watch every action.",
  },
  {
    q: "Which job boards are supported?",
    a: "Any board. Twelve come built in, from LinkedIn and Indeed to HN Who's Hiring and Upwork, and you can add any other board from the boards page - the agent drives a real browser, so it isn't limited to a fixed list.",
  },
  {
    q: "Can it read and send email?",
    a: "Yes, through your own Google OAuth client - no shared app touches your mail. Reading powers the inbox and verification codes; sending powers networking.",
  },
  {
    q: "What about captchas?",
    a: "The agent solves checkbox and text captchas itself. For image challenges it uses your 2Captcha or CapSolver key if you add one; otherwise it skips the job and says why.",
  },
  {
    q: "Is it open source?",
    a: "Yes, MIT-licensed. The dashboard, API, terminal host, and plugin are all in one repository on GitHub.",
  },
] as const;
