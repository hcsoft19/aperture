# Clinic profiles and public showcases

Staff open **Clinic** in workspace navigation. Administrators manage public identity, logo and cover uploads, address, telephone, WhatsApp, email, contact name, website, social links, specialties, languages, opening hours, and public publishing. Profiles start unpublished. The public name can differ from the internal workspace name.

Booking is optional and disabled on new profiles. Administrators can show a labelled link to a WhatsApp number (including country code) or their existing HTTPS booking system. Aperture does not accept appointments, collect booking details, send messages, or provide a booking engine.

A saved slug creates `/clinics/<slug>`. Slugs use lowercase words and hyphens. Previous slugs remain reserved and redirect to the current clinic URL. Public result slugs remain stable when a page goes offline. Copy-link and locally generated QR-code downloads support social profiles, websites, and printed material. No external QR service receives clinic URLs.

## Publication and privacy

Public profile fields are stored separately from organizations and clinical records. Public results contain only an approved title, category, procedure, body area, description, optional treatment interval, and independent web image paths. Patient names, gender, chart IDs, notes, exact appointment dates, and private marketing permission references are not part of public result rows.

Administrators prepare a result from a completed clinical comparison, record a private permission reference, and explicitly confirm public marketing permission. Reference demos cannot be published through this workflow. Preparation creates a private draft; publication is a separate action. The clinic can publish contact information before any results are ready.

The application derives the clinic from verified membership, never a submitted organization ID. RLS limits writes to administrators and hides drafts from anonymous users. Public rendering uses a session-free Supabase client even for logged-in administrators, preventing a public URL from accidentally rendering private drafts. Private previews require membership in the same clinic; publication and uploads remain administrator-only.

Public images are separate, resized WebP copies with metadata removed. Private originals are unchanged. Both profiles and results must be published for anonymous image access. Media routes use `private, no-store`; offline pages do not expose new media access. Marketing permission withdrawal also deletes the public web copies, invalidating existing storage URLs to those objects. Previously downloaded images and third-party search caches cannot be recalled. Ordinary temporary unpublishing retains the web files for republication; previously issued Storage signed URLs may remain valid until their expiry.

Profile saves and publication changes are audited, and recent activity appears in Clinic settings. Roles, private gallery access, and patient sharing continue to work separately.

## SEO

Server-rendered clinic and result pages provide canonical URLs, titles, descriptions, social cards, descriptive image text, and MedicalClinic JSON-LD. Public galleries use crawlable pagination and category filters. Filter views are not indexed. Sitemap output contains published, search-enabled profiles and their published results. Search indexing can be disabled while a page remains shareable; the fictional demonstration clinic uses this option. Configure `NEXT_PUBLIC_SITE_URL` with the canonical production origin.

## Verification

Run `npm run lint`, `npm test`, and `npm run build`. The seeded local database access test can be run using:

```sh
docker exec -i supabase_db_aesthetic-photos psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/database/clinic-showcase.sql
```

The SQL test rolls back all mutations and checks draft isolation, permission requirements, public publication, private permission records, withdrawal, old slug reservation, and taking a page offline.

Custom domains, richer analytics, multiple practice locations, and an Aperture booking engine remain later phases.
