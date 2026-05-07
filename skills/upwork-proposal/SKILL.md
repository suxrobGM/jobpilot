---
name: upwork-proposal
description: Generate an Upwork proposal from a job description using the user's resume. Applies humanizer for natural tone.
argument-hint: "<job_description>"
---

# Upwork Proposal Generator

You are writing an Upwork job proposal for a freelancer. Your goal is to write a concise, relevant, and winning proposal that directly addresses the client's needs.

## Setup

Read and follow `${CLAUDE_PLUGIN_ROOT}/skills/_shared/setup.md` to load the
profile and resume from the JobPilot API. Then read the resume file at
`data.defaultResumeAbsolutePath` to build a full candidate profile (identity,
skills, experience, projects, research).

## Process

### Step 1: Analyze the Job Description

Read the job description provided as the argument. Identify:

- What the client needs built or fixed
- Required technologies and skills
- Project scope and timeline clues
- Pain points or challenges the client mentions
- Any specific questions the client asks

### Step 2: Match Relevant Experience

From the candidate's resume, select ONLY the experience, projects, and skills that directly relate to this job. Do not list everything -- be selective and targeted. Pick 2-3 most relevant projects or experiences.

### Step 3: Write the Proposal

Follow this structure:

**Opening (1-2 sentences):**

- Address the client's specific need directly
- Show you understand the problem, not just the tech stack
- Do NOT start with "Hi" or "Dear client" or "I'm excited to apply"

**Relevant Experience (2-3 short paragraphs):**

- Connect your specific past work to what the client needs
- Include concrete metrics and results (users, performance gains, etc.)
- Reference specific projects by name with brief context
- Focus on outcomes, not just technologies used

**Approach (1-2 sentences):**

- Briefly describe how you'd tackle this specific project
- Show technical understanding of their problem

**Closing (1-2 sentences):**

- Suggest next steps (call, questions, prototype)
- Keep it confident but not pushy

### Step 4: Apply Humanizer

After writing the proposal, invoke the `/jobpilot:humanizer` skill on the full text to remove any AI writing patterns. The final output must read as naturally written by a real person.

## Important Rules

1. **Keep it under 200 words.** Upwork clients skim proposals. Brevity wins.
2. **No fluff.** Remove words like "passionate," "dedicated," "committed," "excited," "thrilled," "leverage," "utilize," "innovative," "cutting-edge."
3. **No generic openings.** Never start with "I came across your job posting" or "I'm a senior developer with X years of experience."
4. **Be specific.** Reference actual project names, actual metrics, actual tech from the resume. Vague claims lose.
5. **Answer their questions.** If the job posting asks specific questions, answer them directly.
6. **Match their tone.** If the posting is casual, write casually. If it's formal, be professional.
7. **One call-to-action.** End with one clear next step.
8. **Do not invent experience.** Only reference projects and skills from the resume.
9. **Do not mention freelance platform status** (Top Rated, JSS) in the body -- it's already visible on the profile. Exception: if the posting specifically asks about freelancing track record.
10. **Write in first person** as the candidate.

## Output Format

Output the proposal text ready to paste into Upwork. No markdown headers, no formatting -- just clean paragraphs that work in Upwork's plain text input.
