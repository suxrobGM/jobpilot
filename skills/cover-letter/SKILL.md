---
name: cover-letter
description: Generate a tailored cover letter from a job description using the user's resume. Applies humanizer for natural tone.
argument-hint: "<job_description>"
---

# Cover Letter Generator

You are writing a cover letter for a job applicant. Your goal is to write a compelling, tailored cover letter that connects their experience to the role.

## Setup

Read and follow `${CLAUDE_PLUGIN_ROOT}/skills/_shared/setup.md` to load the
profile and resume from the JobPilot API. Then read the resume file at
`data.defaultResumeAbsolutePath` to build a full candidate profile (identity,
education, experience, skills, projects, research, awards).

## Process

### Step 1: Analyze the Job Description

Read the job description provided as the argument. Identify:

- Company name and what they do
- Role title and level
- Key responsibilities
- Required and preferred qualifications
- Tech stack and domain
- Company culture cues and values

### Step 2: Match Relevant Experience

From the candidate's resume, select the most relevant:

- 2-3 work experiences that align with the role
- 2-3 projects that demonstrate required skills
- Research work (if the role involves AI/ML/CV)
- Education details (if relevant to the role level)

### Step 3: Write the Cover Letter

Follow this structure:

**Header:**

```
[Full Name]
[City, State] | [Phone] | [Email]
[LinkedIn] | [GitHub] | [Website]
```

Use values from `data.profile.*` (firstName, lastName, email, phone, …).

**Opening paragraph (2-3 sentences):**

- State the role you're applying for
- Lead with your strongest, most relevant qualifier for this specific role
- Show you understand what the company does or what the team needs
- Do NOT use "I'm excited to apply" or "I'm writing to express my interest"

**Body paragraph 1 -- Relevant experience (3-5 sentences):**

- Connect your most relevant work experience to their needs
- Include specific metrics and outcomes
- Name projects and results, not just technologies
- Show you've solved problems similar to theirs

**Body paragraph 2 -- Technical depth (3-5 sentences):**

- Demonstrate deeper technical alignment with the role
- Reference specific projects or research that match their stack/domain
- Show understanding of their technical challenges
- If AI/ML role: reference publications and research

**Body paragraph 3 -- Why this company (2-3 sentences):**

- What specifically draws you to this role/company (be genuine, not generic)
- How your background uniquely positions you for their specific needs
- What you'd bring beyond the technical requirements

**Closing paragraph (2-3 sentences):**

- Express interest in discussing further
- Reference portfolio/GitHub if relevant
- Thank them for their time

**Sign-off:**

```
Best regards,
[Full Name]
```

### Step 4: Apply Humanizer

After writing the cover letter, invoke the `/jobpilot:humanizer` skill on the full text to remove any AI writing patterns. The final output must read as naturally written by a real person.

## Important Rules

1. **Keep it to one page.** 350-450 words for the body (excluding header/sign-off).
2. **No fluff.** Remove words like "passionate," "dedicated," "committed," "excited," "thrilled," "leverage," "utilize," "innovative," "cutting-edge," "eager," "dynamic."
3. **No generic openings.** Never start with "I am writing to express my interest" or "I was excited to see your posting."
4. **Be specific.** Reference actual project names, metrics, and technologies from the resume. Vague claims are ignored.
5. **Tailor aggressively.** Every sentence should connect to something in the job description. If a paragraph could apply to any job, rewrite it.
6. **Show, don't tell.** Instead of "I'm a strong communicator," show it through your writing. Instead of "I'm experienced in X," describe what you built with X.
7. **Match the company's tone.** Startup? Write conversationally. Enterprise/government? More formal.
8. **Do not invent experience.** Only reference projects and skills from the resume.
9. **Write in first person** as the candidate.
10. **For AI/ML/research roles:** Lead with research publications and academic background.
11. **For senior/lead roles:** Lead with years of experience, team collaboration, and architectural decisions.
12. **For startup roles:** Lead with breadth of shipped products and autonomy.

## Output Format

Output the complete cover letter with header and sign-off, formatted with proper spacing. Use plain text that can be pasted into any application form or converted to PDF.
