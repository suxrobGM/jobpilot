---
name: interview
description: Produce a tailored interview prep sheet (behavioral, technical, system design, company) from a job description and the user's resume.
argument-hint: "<job_description>"
---

# Interview prep

Prep for one role, from its job description and the candidate's resume.

## Setup

Follow `../_shared/setup.md`, then `GET /api/resumes/<id>` (the caller's `resumeId`, else
`user.primaryResumeId`). Work from its `content`.

## 1. Read the role

Note the title, level and team; the core technical requirements; the domain; the main
responsibilities; company size and stage; any hints about the interview process.

## 2. Questions

Most likely first in each group. Every answer draws on real resume experience, named.

- **Behavioral (5-7)**, on the competencies the role needs. Each: the question and a STAR outline
  (situation, task, action, result) from one real role or project.
- **Technical (5-7)**, on the stack and requirements. Each: an answer outline with talking points
  from the candidate's work.
- **System design (2-3)**, in the company's product area. Each: the approach, and which of the
  candidate's projects show relevant experience.
- **Company (2-3)**: product, market, competitors, and what to research beforehand.

Example:

```text
Q: Tell me about a time you led a major migration.
- Situation: at EmTech Care Labs the platform ran on Amplify Gen 1 with slow builds.
- Task: move to Gen 2 and unify the codebase.
- Action: phased migration into one TypeScript monorepo; merged 3 component libraries.
- Result: build and deploy time down 40%; 40+ shared components.
```

## 3. Weak spots

Requirements where the candidate is thin. For each, an honest answer they could say out loud: the
closest thing they have done, named, and how they would close the gap. No "I'm a quick learner".
Then what to brush up on.

## 4. Output

```text
# Interview prep: <role> at <company>

## Role summary        (2-3 sentences)
## Behavioral
## Technical
## System design
## Company research
## Watch out for
## Key talking points  (3-5 bullets to weave into any answer)
```

Answers are talking points for one or two minutes out loud: short phrases in the candidate's
words, not paragraphs to memorize. Never invent experience.
