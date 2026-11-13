drop policy sessions_select on public.photo_sessions;

create policy sessions_select
  on public.photo_sessions
  for select
  to authenticated
  using (
    (select private.can_staff_patient(private.treatment_patient_id(treatment_id)))
    or (
      released_to_patient
      and status = 'completed'
      and (select private.is_patient_self(private.treatment_patient_id(treatment_id)))
    )
  );
