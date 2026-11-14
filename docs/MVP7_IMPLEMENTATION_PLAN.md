# MVP 7 — Clinic Treatment Catalog & Smart Dropdowns

## Executive summary

Replace free-text inputs in the treatment form with searchable, creatable dropdowns populated from a per-clinic catalog. Each clinic maintains its own list of treatment names, categories, procedure types, products, and body areas. Users can select existing values or create new ones inline without losing form state.

## Current state audit

### Treatment form fields (New/Edit Treatment)

| Field | Current control | Database column | Validation |
|-------|-----------------|-----------------|------------|
| Treatment | `<Input>` | `treatments.name` | 1–120 chars, required |
| Category | `<Input>` | `treatments.category` | 1–80 chars, required |
| Procedure / type | `<Input>` | `treatments.procedure_type` | 0–80 chars, optional |
| Product / drug | `<Input>` | `treatments.product_name` | 0–120 chars, optional |
| Photography protocol | `<select>` | `treatments.protocol_code` | enum, **unchanged** |
| Body area | `<Input>` | `treatments.body_area` | 1–80 chars, required |
| Status | `<select>` | `treatments.status` | enum |
| Start date | `<Input type="date">` | `treatments.start_date` | date |
| Notes | `<Textarea>` | `treatments.description` | 0–2000 chars |

### Key exclusion

**Photography protocol** is excluded from catalog changes. It references versioned protocol rows and is tied to camera guidance. The existing `<select>` remains.

### Existing treatments

The database already contains treatments with free-text values. These must be preserved:
- Historical treatment records remain unchanged
- Existing values become selectable options via backfill
- Legacy text that doesn't match any catalog entry displays as-is in Edit

## Schema design

### Option: Unified `clinic_catalog_options` table

A single table handles all five option types with a discriminator column:

```sql
create type public.catalog_option_type as enum (
  'treatment_name',
  'category',
  'procedure_type',
  'product',
  'body_area'
);

create table public.clinic_catalog_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  option_type public.catalog_option_type not null,
  normalized_key text not null,
  display_name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_catalog_options_display_name_length check (
    char_length(btrim(display_name)) between 1 and 120
  ),
  constraint clinic_catalog_options_unique_per_org unique (
    organization_id, option_type, normalized_key
  )
);
```

### Normalization

`normalized_key` is the lowercased, trimmed value for uniqueness:
```sql
normalized_key = lower(btrim(display_name))
```

### Indexes

```sql
create index clinic_catalog_options_org_type_active_idx
  on public.clinic_catalog_options (organization_id, option_type, is_active);

create index clinic_catalog_options_org_type_sort_idx
  on public.clinic_catalog_options (organization_id, option_type, sort_order, display_name);
```

## RLS policies

Following the existing pattern from `treatment_templates`:

```sql
-- Staff can read their clinic's catalog
create policy clinic_catalog_options_select_staff
  on public.clinic_catalog_options
  for select
  to authenticated
  using ((select private.is_org_staff(organization_id)));

-- Admin or professional can insert new options
create policy clinic_catalog_options_insert_staff
  on public.clinic_catalog_options
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.is_org_staff(organization_id))
  );

-- Admin can update/deactivate options
create policy clinic_catalog_options_update_admin
  on public.clinic_catalog_options
  for update
  to authenticated
  using ((select private.is_org_staff(organization_id)))
  with check ((select private.is_org_admin(organization_id)));
```

## CRUD service

### Server actions (`src/features/catalog/actions.ts`)

```typescript
// List options for a type
export async function listCatalogOptions(type: CatalogOptionType): Promise<CatalogOption[]>

// Create new option (inline from dropdown)
export async function createCatalogOption(
  type: CatalogOptionType,
  displayName: string
): Promise<{ status: 'success'; option: CatalogOption } | { status: 'error'; message: string }>

// Update option (admin)
export async function updateCatalogOption(
  id: string,
  updates: { displayName?: string; isActive?: boolean; sortOrder?: number }
): Promise<ActionResult>

// Deactivate option (soft delete)
export async function deactivateCatalogOption(id: string): Promise<ActionResult>
```

### Validation rules

1. **Duplicates**: Case-insensitive matching via `normalized_key`
2. **Blank values**: Rejected (min 1 char after trim)
3. **Length limits**: 120 chars max for treatment_name/product, 80 chars for others
4. **In-use protection**: Options with existing treatments cannot be deleted (only deactivated)

## UI components

### Searchable creatable combobox

Use shadcn/ui `Combobox` pattern with:
- Type-ahead search filtering
- Keyboard navigation (Arrow keys, Enter, Escape)
- `+ Create "value"` option when no exact match
- Mobile touch support with min 44px targets
- Loading and error states

### Component structure

```
src/features/catalog/
├── actions.ts           # Server actions
├── schemas.ts           # Zod schemas
├── queries.ts           # Data fetching
├── catalog-combobox.tsx # Reusable dropdown
├── catalog-dialog.tsx   # Inline create dialog
└── catalog-admin.tsx    # Settings management UI
```

### Treatment form integration

Replace `<TextField>` components with `<CatalogCombobox>`:

```tsx
<CatalogCombobox
  type="treatment_name"
  value={form.watch("name")}
  onChange={(value) => form.setValue("name", value)}
  onCreateNew={(displayName) => createCatalogOption("treatment_name", displayName)}
  error={errors.name?.message}
/>
```

## Migration strategy

### Phase 1: Schema and backfill

1. Add `clinic_catalog_options` table with RLS
2. Extract distinct values from existing treatments per clinic
3. Insert as catalog options with `is_active = true`

### Phase 2: UI replacement

4. Add `CatalogCombobox` component
5. Replace text inputs in `TreatmentForm`
6. Preserve legacy value display in Edit mode

### Phase 3: Admin management

7. Add Clinic Settings > Catalog Management page
8. List/search/rename/deactivate options

### Backfill query

```sql
insert into public.clinic_catalog_options (organization_id, option_type, normalized_key, display_name, created_by)
select distinct
  p.organization_id,
  'treatment_name'::catalog_option_type,
  lower(btrim(t.name)),
  btrim(t.name),
  (select profile_id from organization_members where organization_id = p.organization_id and role = 'clinic_admin' limit 1)
from treatments t
join patients p on p.id = t.patient_id
where btrim(t.name) <> ''
on conflict (organization_id, option_type, normalized_key) do nothing;

-- Repeat for category, procedure_type, product_name, body_area
```

## Testing plan

### Unit tests

- Zod schema validation (length, trim, required)
- Normalized key generation
- Duplicate detection

### Integration tests (RLS)

- Cross-tenant isolation: Clinic A cannot see Clinic B's options
- Role permissions: Professional can create, only admin can deactivate
- Staff-only access: Patients cannot read catalog

### E2E flows

- Create treatment with new category (inline create)
- Edit treatment preserving legacy value
- Deactivate option still shows on historical treatments
- Mobile combobox interaction

## Open questions / decisions

1. **Field relationships**: Should Category→Procedure be linked? Current decision: No, keep fields independent. Revisit in FRA-80 if clinical domain requires it.

2. **Default values**: Should new clinics get seeded options? Current decision: No, let each clinic build their own vocabulary.

3. **Audit trail**: Should we track who created/modified options? Current decision: Yes, via `created_by` and `updated_at`.

## Files to be modified

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDDHHMMSS_clinic_catalog.sql` | New table, enum, RLS, indexes |
| `src/types/database.ts` | Regenerate from schema |
| `src/features/catalog/*.ts` | New feature module |
| `src/features/patients/treatment-form.tsx` | Replace inputs with comboboxes |
| `src/features/patients/schemas.ts` | Add catalog option schema |
| `src/app/(staff)/settings/catalog/page.tsx` | New admin page |
| `tests/database/clinic-catalog.sql` | RLS tests |
| `tests/unit/catalog.test.ts` | Validation tests |

## Dependencies

- MVP 1–6 database migrations applied
- shadcn/ui Combobox component available
- No external services required

## Risks

1. **Migration safety**: Backfill must be idempotent and not modify existing treatment records
2. **Performance**: Large catalogs need proper indexing (covered above)
3. **Concurrent creation**: Two users creating same value simultaneously - handled by unique constraint with graceful error

## Timeline estimate

Not applicable — autonomous agent implementation.
