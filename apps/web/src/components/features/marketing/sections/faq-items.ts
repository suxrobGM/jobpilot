/** Landing-page FAQ - rendered by `Faq` and emitted as FAQPage JSON-LD from the landing page. */
export const FAQ_ITEMS = [
  {
    q: "What does it cost?",
    a: "Nothing. JobPilot is free and open source under the MIT license. The only thing you pay for is your own Claude or Codex subscription.",
  },
  {
    q: "Do I need an API key?",
    a: "No. The agent runs inside Claude Code or Codex and uses your subscription. There's no separate bill and nothing to top up.",
  },
  {
    q: "Which AI model should I use?",
    a: "A mid-range one, like Claude Sonnet 5.5 or GPT 6 Luna. Top models like Claude Opus 5.5 use up your weekly limit much faster and don't send any more applications, since the work is mostly reading postings and filling in forms. JobPilot already starts Claude Code on Sonnet and Codex on GPT 6 Luna.",
  },
  {
    q: "Where does the agent run?",
    a: "On your computer. The dashboard is a website, but the AI and the browser it applies with run on your machine. You can watch it and stop it at any time.",
  },
  {
    q: "How do I tell it what jobs I want?",
    a: "Tell the Pilot in chat, the way you'd brief a recruiter. It sets up searches from that, skips your deal-breakers, and asks when it's unsure. With autopilot on it keeps working by itself; off, it runs only what you ask for.",
  },
  {
    q: "Will it apply or message anyone without asking?",
    a: "It applies up to your daily limit, which the server enforces. LinkedIn messages, posts, and interview replies always wait for your approval, and every change it makes to your searches and rules can be undone for 7 days.",
  },
  {
    q: "Which job boards are supported?",
    a: "Eleven come built in, including LinkedIn, Indeed, Hacker News Who's Hiring, and Upwork. The agent uses a normal browser, so you can add any other job site too.",
  },
  {
    q: "Can it read and send email?",
    a: "Yes, once you connect Gmail through a Google app you create yourself. It uses this to sort recruiter replies, read sign-in codes, and send networking emails.",
  },
  {
    q: "What about captchas?",
    a: "It handles checkbox and text captchas itself. Picture puzzles need a 2Captcha or CapSolver key. Without one, it skips the job and tells you why.",
  },
] as const;
