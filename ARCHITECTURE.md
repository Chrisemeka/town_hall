# TownHall — Architecture Overview

## What is TownHall?
TownHall is a collaborative testing platform where developers can submit 
their web applications to be tested by other developers in exchange for 
testing others in return.

## Tech Stack
- **Framework:** Next.js 16 (App Router)
- **AI:** Vercel AI SDK with Google Gemini 1.5 Flash
- **Styling:** Tailwind CSS 4 & Framer Motion
- **Database:** Supabase
- **Auth:** Supabase Google Signin
- **Storage:** Supabase Storage
- **Schema Validation:** Zod 

## Folder Structure
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

## Key Modules
- action
- components
- lib

## Known Technical Debt
**Type safety**: Multiple `as any` casts indicate tactical shortcuts — types should be properly defined