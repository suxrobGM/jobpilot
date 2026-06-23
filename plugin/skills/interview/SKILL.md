---
name: interview
description: Produce a tailored interview prep sheet (behavioral, technical, system design, company) from a job description and the user's resume.
argument-hint: "<job_description>"
---

# Interview Prep

Generate interview prep tailored to a JD and the candidate's resume.

## Setup

Follow `../shared/setup.md`. Then `Read` the resume file at `primaryResumeSourceAbsolutePath` for the candidate's full background.

## Step 1: Analyze the Role

From the argument, identify: role title + level + team, core technical requirements, domain/industry, key responsibilities, company size/stage, any interview-process hints.

## Step 2: Generate Questions

### Behavioral (5–7)

Focus on competencies the role requires. For each: question + suggested **STAR answer** (Situation, Task, Action, Result) using a real example from the resume + the experience to reference.

Example:

```
**Q: Tell me about a time you led a major migration.**

Suggested answer (STAR):
- Situation: At EmTech Care Labs, the platform was on AWS Amplify Gen 1 with slow builds.
- Task: Lead the migration to Gen 2 and unify the codebase.
- Action: Phased migration, unified TypeScript monorepo, consolidated 3 component libraries into one design system.
- Result: Cut build/deploy time 40%, created 40+ reusable components, improved velocity.
```

### Technical (5–7)

Based on the role's stack and requirements: language/framework, architecture and patterns, technologies listed in the JD. For each: concise answer outline with talking points from the candidate's experience.

### System Design (2–3)

Scenarios relevant to the company's product area. For each: outline the approach + which candidate projects demonstrate relevant experience.

### Company / Domain (2–3)

Questions about the company's product, industry, competitors. Suggest research areas to explore before the interview.

## Step 3: Identify Weak Spots

List requirements where the candidate's experience is thin. Suggest how to frame each gap positively (transferable skills, adjacent experience, quick-learner). Recommend areas to brush up on.

## Step 4: Output

```
# Interview Prep: [Role] at [Company]

## Role Summary
[2-3 sentences]

## Behavioral Questions
## Technical Questions
## System Design
## Company Research
## Watch Out For
## Key Talking Points
[3-5 bullets to weave into any answer]
```

## Rules

1. **Real experience only.** Every suggested answer references real projects/roles/metrics. Never fabricate.
2. **Tailor to this role.** Generic "tell me about yourself" prep is useless.
3. **Be honest about gaps.** Don't pretend they don't exist.
4. **Concise answers.** 1–2 minutes spoken, not essays.
5. **Probability-order.** Most likely questions first in each category.
