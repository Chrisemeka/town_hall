# Twnhall

## What is Twnhall?
Twnhall is a collaborative testing platform where developers can submit
their web applications to be tested by other developers in exchange for 
testing others in return. It bridges the gap for startups and solo 
developers who need real-world QA feedback but don't have the budget 
for a dedicated QA team.

## The Problem it Solves
Most early-stage developers and startups ship features without proper 
real-world testing. Hiring a QA engineer is expensive and out of reach 
for solo developers and small teams. Twnhall creates a community-driven 
alternative where testing is reciprocal — you test others to get tested.

## How it Works
1. **Submit a project** — A developer submits their web application under
   a category, then creates a mission: a structured test case of
   action/expected-result steps, built from scratch or from a template,
   targeted at mobile, desktop, or both.

2. **Test other projects** — Developers pick up missions from other
   projects and work through the test case step by step. For each step
   they see the builder's instruction verbatim and record what actually
   happened, marking it pass, fail, or blocked — with a summary and
   reproduction steps when it fails. Screenshots and a free-text note
   round the submission off.

3. **AI-powered insights** — Twnhall uses Gemini AI to analyse the audit
   log and generate a user-friendly breakdown of the findings. Because it
   knows which steps failed and how, it leads with those rather than
   paraphrasing a comment — making raw feedback actionable even for
   non-technical project owners.

## Target Audience
- Early-stage startups without a QA budget
- Solo developers building personal projects
- Developers who want real-world feedback before launch

## Tech Stack
- **Framework:** Next.js 16 (App Router)
- **AI:** Vercel AI SDK with Google Gemini 3 Flash Preview
- **Styling:** Tailwind CSS 4 & Framer Motion
- **Database:** Supabase
- **Auth:** Supabase Google Signin
- **Storage:** Supabase Storage
- **Schema Validation:** Zod 

## Getting Started

### Prerequisites
- Node.js v18+
- Package Manager: npm, yarn or pnpm
- Supabase CLI (Optional) for managing backend and database migrations 

### Installation
```bash
git clone https://github.com/Chrisemeka/town_hall.git
cd townhall
npm install
```

### Environment Variables
Create a `.env.local` file in the root directory:
NEXT_PUBLIC_SUPABASE_URL=your_key_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
GEMINI_API_KEY=your_key_here (gotten from [Google AI Studio](https://aistudio.google.com/))


### Running Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

## Core User Journeys
1. **Developer submits a project for testing**
2. **Developer picks up and completes a testing mission**
3. **Developer reviews AI-generated test result breakdown**

## Project Structure
```text
townhall/
├── actions/             # Server actions for mutations (auth, missions, projects, submissions)
├── app/                 # Next.js App Router root
│   ├── (developer)/     # Route group for developer-facing pages
│   ├── (tester)/        # Route group for tester-facing pages
│   ├── api/             # API routes
│   └── globals.css      # Global styles
├── components/          # Reusable React components (forms, UI cards, nav)
├── lib/                 # Utility functions and shared libraries (AI, Supabase client)
├── public/              # Static assets
└── middleware.ts        # Next.js middleware
```