<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Aperture — agent conventions

Medical aesthetics before-and-after photography. Mobile-first Next.js app. One clinic's records must never leak to another clinic or to another patient.

Working name is **Aperture** until a brand is chosen. The continuation specification is `docs/specification.md`. Phase status and open decisions live in `docs/implementation-plan.md`.

## Stack

- Next.js App Router, TypeScript strict, Tailwind CSS, shadcn/ui, Lucide
- Supabase Auth, Postgres, Storage, and SSR (`@supabase/ssr`) through this Next.js app
- Zod and React Hook Form at the boundary of every mutation
- Vitest and React Testing Library now. Playwright when a critical workflow exists end to end

Do not add a separate backend, Java, Nest, Express, React Native, Flutter, or a paid service that has not been approved. Do not put the Supabase service-role key in the repo or in a `NEXT_PUBLIC_` variable.

## Authorization

- Verify the caller with `supabase.auth.getClaims()`. Do not authorize from `getSession()` or from `user_metadata`.
- Proxy redirects are not enough. Server actions, route handlers, and RLS policies enforce access.
- Clinic roles live in `organization_members`. Patient links live in `patient_accounts`. Read them on the server. Do not invent a role on the client or in `user_metadata`.
- Clinical photographs, when they arrive, go in a private bucket. Originals stay immutable.
- Demonstration portraits in `local-photos/` stay on this machine. Do not commit or push them.

## Product boundaries

- The MVP includes guided capture, comparisons, and revocable patient sharing. Originals stay immutable. A demonstration host already exists; do not deploy again, or point it at real patients, without confirmation.
- The public landing page uses a blush and wine palette and an interactive preview of `public/demo-portraits.png`. The signed-in app stays a warm neutral surface with a muted green accent. Figtree remains the typeface.
- Do not hardcode the facial protocol into the camera. It will be versioned in the database.
- Do not collect extra patient data, and do not use real patient health information in development.
- Show plain error messages. Do not render raw database or auth internals.

## Code

- Keep business logic in `src/features` and `src/lib`. Keep `src/components` presentational.
- Validate on the server even when the form already validated.
- Prefer small server actions over new route handlers, except redirects such as the auth callback.
- Read `cookies()` or `headers()` only inside a `<Suspense>` boundary while Cache Components are enabled.
- Touch targets stay at least 44px. Body text stays at least 16px. Every control has a visible name.
