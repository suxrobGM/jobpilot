---
name: upwork-proposal
description: Write a short, targeted Upwork proposal from a job description and the user's resume, humanized for natural tone.
argument-hint: "<proposal_id | job_description>"
---

# Upwork Proposal Generator

Write a concise, winning Upwork proposal that directly addresses the client's needs. Clients skim proposals on mobile, between meetings — if it takes more than ~30 seconds to read, it's gone. Optimize every line for a fast skim.

## Setup

Follow `../shared/setup.md`. Then `Read` the resume at `primaryResumeSourceAbsolutePath` for full context (identity, skills, experience, projects, research).

## Step 1: Resolve the Input

The argument is either a **proposal id** (an integer, when launched from the JobPilot UI) or a raw **job description** (manual use). Detect which:

- **Integer id** → fetch the draft row and use its stored job details as the JD:

  ```bash
  curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/upwork/proposals/$ARG"
  ```

  Use `jobDescription` as the posting, plus `jobTitle` / `clientName` / `jobUrl` for context. Remember the id — you will `PATCH` the result back to it in Step 7. (A draft launched from an Upwork **search recommendation** already has these fields filled and `source:"search"` — same flow, no extra work.)

- **Anything else** → treat the argument itself as the job description. There is no row yet; you will `POST` a new one in Step 7.

## Step 2: Analyze the JD

Identify: what the client needs built/fixed, required tech and skills, scope and timeline clues, pain points/challenges, and any specific questions the client asks. Pull out one concrete detail unique to _this_ posting — you'll reference it in the hook so the client can tell the proposal isn't a mass send.

## Step 3: Select ONE Matching Case Study

Pick the SINGLE most relevant project from the resume — one that matches their problem, not just their tech stack. One specific, on-point case study beats five generic ones. Don't list everything. If a portfolio/GitHub/live link exists for it, keep that link ready.

## Step 4: Write

Order it the way it gets read — them first, you second, never the reverse.

**Hook (line 1, bolded):** Open with a bold line that names _their_ problem or goal in their words. Upwork renders `**text**` as bold — use it on this line so it stands out instantly. This is the single most important line; if it reads like "Hello, I'm excited to apply," the proposal is deleted. No "Hi" / "Dear client" / "I'm excited to apply" / "I came across your posting."

**Case study (1–2 lines):** One relevant project, stated specifically — what you built, the outcome with a real metric (users, perf gain, revenue), and a link if available. Tie it directly to what they need. Don't narrate your career; the client cares about their problem, not your journey.

**Specific question (1 line):** Ask ONE sharp question about their project that proves you read the posting and thought about it (scope, an edge case, a decision they'll need to make). This both shows engagement and opens a conversation.

**CTA (1 line):** End with a real next step — the specific question above, or a calendar link if the resume/profile provides one. Never end with a dead phrase like "Looking forward to hearing from you." Create the next step.

## Step 5: Answer Screening Questions

If the posting has screening questions, answer each one short, direct, and specific. "How many years with React?" → "4 years, including [project]." Never write a 300-word essay for a one-line question — long answers read as AI padding.

## Step 6: Apply Humanizer

Invoke the `humanizer` skill on the full text.

## Step 7: Persist to JobPilot

Save the result so it appears on the Upwork page. `screeningAnswers` is a JSON array of `{ "question", "answer" }` objects (empty `[]` if the posting had none).

- **Launched with an id** → `PATCH` the existing draft (status stays `draft`):

  ```bash
  curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PATCH "$JOBPILOT_API/api/upwork/proposals/$ARG" \
    -H 'content-type: application/json' \
    -d '{ "proposalText": "...", "screeningAnswers": [] }'
  ```

- **Launched with a raw job description** → `POST` a new row:

  ```bash
  curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/upwork/proposals" \
    -H 'content-type: application/json' \
    -d '{ "jobTitle": "...", "clientName": "...", "jobUrl": "...", "jobDescription": "...", "proposalText": "...", "screeningAnswers": [] }'
  ```

  `jobTitle` is required; derive it from the posting. Include `clientName` / `jobUrl` when the posting provides them.

Then print the proposal (and any screening answers, each labeled with its question) to the terminal so the user can paste it into Upwork.

## Rules

1. **Under 150 words for the body.** Shorter wins on mobile. Brevity reads as confidence.
2. **Them before you.** Their problem leads; your background supports. Never open with 3 paragraphs about yourself.
3. **No AI tells.** No "Certainly, here is..." preambles, no robotic symmetry, no functional emoji bullets (✅ 📌 🔹 ☑) — those scream AI. If an emoji appears at all, at most one, used the way a person would.
4. **No fluff** — drop "passionate", "dedicated", "committed", "excited", "thrilled", "leverage", "utilize", "innovative", "cutting-edge", "seamless", "robust".
5. **No generic openings** ("I came across your job posting" / "I'm a senior developer with X years").
6. **Be specific.** Real project names, metrics, tech, and links from the resume — referencing their actual job, not a template.
7. **One matched case study, not five.** Relevance beats volume.
8. **One CTA**, and make it a real next step (a question or a calendar link).
9. **Match tone.** Casual posting → casual; formal → professional.
10. **No fabrication.** Only reference resume content. Don't invent metrics or links.
11. **Don't mention freelance status** (Top Rated, JSS) in body — it's already on the profile. Exception: if the posting explicitly asks.
12. **First person** as the candidate.

## Output

Plain text proposal that pastes into Upwork's input. Use `**bold**` only on the line-1 hook (and sparingly on one key phrase if it genuinely helps a skim) — no markdown headers, no bullet lists in the body. Output screening-question answers separately, each labeled with its question.
