---
name: interview
description: Generate interview prep Q&A tailored to a job description and the user's resume. Covers technical, behavioral, and system design questions.
argument-hint: "<job_description>"
---

# Interview Prep

You generate tailored interview preparation material based on a job description and the user's resume.

## Setup

Read and follow `${CLAUDE_PLUGIN_ROOT}/skills/_shared/setup.md` to load the
profile and resume from the JobPilot API. Then read the resume file at
`data.defaultResumeAbsolutePath` to understand the candidate's full
background (skills, experience, projects, education, research).

## Process

### Step 1: Analyze the Role

Read the job description provided as the argument. Identify:

- Role title, level, and team
- Core technical requirements
- Domain and industry context
- Key responsibilities
- Company size and stage (startup vs enterprise)
- Any hints about interview process (if mentioned)

### Step 2: Generate Questions

Produce questions in these categories, tailored to the specific role:

#### Behavioral Questions (5-7 questions)

Focus on competencies the role requires. For each question:

- State the question
- Provide a suggested **STAR-format answer** (Situation, Task, Action, Result) using a real example from the candidate's resume
- Note which resume experience to reference

Example format:

```
**Q: Tell me about a time you led a major migration or refactoring effort.**

Suggested answer (STAR):
- Situation: At EmTech Care Labs, the platform was on AWS Amplify Gen 1 which had slow builds and fragmented codebases.
- Task: Lead the migration to Gen 2 and unify the codebase.
- Action: Planned the migration in phases, unified into a TypeScript monorepo, consolidated 3 component libraries into one design system.
- Result: Cut build/deployment times by 40%, created 40+ reusable components, improved team velocity.
```

#### Technical Questions (5-7 questions)

Based on the role's tech stack and requirements:

- Language/framework specific questions
- Architecture and design pattern questions
- Questions about technologies listed in the job description
- For each question, provide a concise answer outline with talking points from the candidate's experience

#### System Design Questions (2-3 questions)

Based on the role's domain:

- Design a system relevant to the company's product area
- For each, outline the approach and note which candidate projects demonstrate relevant experience

#### Company/Domain Questions (2-3 questions)

- Questions about the company's product, industry, or competitors
- Suggest research areas the candidate should explore before the interview

### Step 3: Identify Weak Spots

Based on the job description vs. the candidate's resume:

- List any requirements where the candidate's experience is thin
- Suggest how to frame gaps positively (transferable skills, quick learner, adjacent experience)
- Recommend areas to study or brush up on before the interview

### Step 4: Output the Prep Sheet

Format the output as a structured prep document:

```
# Interview Prep: [Role Title] at [Company]

## Role Summary
[2-3 sentence overview of what this role needs]

## Behavioral Questions
[Questions with STAR answers]

## Technical Questions
[Questions with answer outlines]

## System Design
[Scenarios with approach outlines]

## Company Research
[Questions and suggested research areas]

## Watch Out For
[Gaps and how to address them]

## Key Talking Points
[3-5 bullet points the candidate should weave into any answer]
```

## Important Rules

1. **Use real experience only.** All suggested answers must reference actual projects, roles, or metrics from the resume. Never fabricate examples.
2. **Be specific to the role.** Generic "tell me about yourself" prep is useless. Tailor every question to what THIS company would ask for THIS role.
3. **Be honest about gaps.** If the candidate lacks a required skill, say so and suggest how to address it. Don't pretend the gap doesn't exist.
4. **Keep answers concise.** Interview answers should be 1-2 minutes spoken. Don't write essays.
5. **Prioritize likely questions.** Put the most probable questions first in each category.
