-- Staff can see a chart from the clinic column on the row itself.
-- Looking the clinic up by the new chart id fails during insert ... returning,
-- so creating a chart was rejected even for a clinic member.

drop policy patients_select on public.patients;

create policy patients_select
  on public.patients
  for select
  to authenticated
  using (
    (select private.is_org_staff(organization_id))
    or (select private.is_patient_self(id))
  );
