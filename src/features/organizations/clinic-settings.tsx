"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrganizationRole } from "@/features/access/workspace";
import {
  addOrganizationMemberAction,
  removeOrganizationMemberAction,
  renameOrganizationAction,
  setOrganizationMemberRoleAction,
} from "@/features/organizations/actions";
import {
  memberEmailSchema,
  organizationNameSchema,
  type MemberEmailValues,
  type OrganizationNameValues,
} from "@/features/organizations/schemas";

export type ClinicMember = {
  profileId: string;
  fullName: string | null;
  role: OrganizationRole;
};

type ClinicSettingsProps = {
  organizationId: string;
  organizationName: string;
  currentProfileId: string;
  isAdmin: boolean;
  members: ClinicMember[];
};

export function ClinicSettings({
  organizationId,
  organizationName,
  currentProfileId,
  isAdmin,
  members,
}: ClinicSettingsProps) {
  return (
    <div className="flex flex-col gap-8">
      <RenameClinicForm
        organizationId={organizationId}
        organizationName={organizationName}
        canEdit={isAdmin}
      />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Professionals</h2>
        <ul className="flex flex-col gap-3">
          {members.map((member) => (
            <li
              key={member.profileId}
              className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{member.fullName ?? "Unnamed professional"}</p>
                <p className="text-sm text-muted-foreground">
                  {member.role === "clinic_admin" ? "Clinic administrator" : "Professional"}
                  {member.profileId === currentProfileId ? " · You" : ""}
                </p>
              </div>
              {isAdmin ? (
                <MemberControls
                  organizationId={organizationId}
                  member={member}
                />
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      {isAdmin ? <AddMemberForm organizationId={organizationId} /> : null}
    </div>
  );
}

function RenameClinicForm({
  organizationId,
  organizationName,
  canEdit,
}: {
  organizationId: string;
  organizationName: string;
  canEdit: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"error" | "success" | null>(null);
  const form = useForm<OrganizationNameValues>({
    resolver: zodResolver(organizationNameSchema),
    defaultValues: { name: organizationName },
  });
  const nameError = form.formState.errors.name?.message;

  const onSubmit = form.handleSubmit(async (values) => {
    setMessage(null);
    const result = await renameOrganizationAction({ ...values, organizationId });
    setStatus(result.status);
    setMessage(result.message);
  });

  return (
    <form className="flex max-w-md flex-col gap-4" onSubmit={onSubmit} noValidate>
      <h2 className="text-lg font-semibold">Clinic</h2>
      {message ? (
        <p
          className={status === "success" ? "text-sm text-foreground" : "text-sm text-destructive"}
          role={status === "success" ? "status" : "alert"}
        >
          {message}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="organization-name">Clinic name</Label>
        <Input
          id="organization-name"
          disabled={!canEdit}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "organization-name-error" : undefined}
          {...form.register("name")}
        />
        {nameError ? (
          <p id="organization-name-error" className="text-sm text-destructive" role="alert">
            {nameError}
          </p>
        ) : null}
      </div>
      {canEdit ? (
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save clinic name"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          A clinic administrator can change this name.
        </p>
      )}
    </form>
  );
}

function AddMemberForm({ organizationId }: { organizationId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"error" | "success" | null>(null);
  const form = useForm<MemberEmailValues>({
    resolver: zodResolver(memberEmailSchema),
    defaultValues: { email: "" },
  });
  const emailError = form.formState.errors.email?.message;

  const onSubmit = form.handleSubmit(async (values) => {
    setMessage(null);
    const result = await addOrganizationMemberAction({ ...values, organizationId });
    setStatus(result.status);
    setMessage(result.message);
    if (result.status === "success") {
      form.reset();
    }
  });

  return (
    <form className="flex max-w-md flex-col gap-4" onSubmit={onSubmit} noValidate>
      <h2 className="text-lg font-semibold">Add a professional</h2>
      <p className="text-sm leading-6 text-muted-foreground">
        They need an account already. New members join as professionals.
      </p>
      {message ? (
        <p
          className={status === "success" ? "text-sm text-foreground" : "text-sm text-destructive"}
          role={status === "success" ? "status" : "alert"}
        >
          {message}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="member-email">Email</Label>
        <Input
          id="member-email"
          type="email"
          autoComplete="email"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "member-email-error" : undefined}
          {...form.register("email")}
        />
        {emailError ? (
          <p id="member-email-error" className="text-sm text-destructive" role="alert">
            {emailError}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Adding…" : "Add professional"}
      </Button>
    </form>
  );
}

function MemberControls({
  organizationId,
  member,
}: {
  organizationId: string;
  member: ClinicMember;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function changeRole(role: OrganizationRole) {
    setPending(true);
    setMessage(null);
    const result = await setOrganizationMemberRoleAction({
      organizationId,
      profileId: member.profileId,
      role,
    });
    setMessage(result.status === "error" ? result.message : null);
    setPending(false);
  }

  async function removeMember() {
    setPending(true);
    setMessage(null);
    const result = await removeOrganizationMemberAction({
      organizationId,
      profileId: member.profileId,
    });
    setMessage(result.status === "error" ? result.message : null);
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <label className="flex flex-col gap-1 text-sm">
        Role
        <select
          className="h-11 rounded-lg border border-input bg-background px-3"
          value={member.role}
          disabled={pending}
          onChange={(event) => {
            const role = event.target.value === "clinic_admin" ? "clinic_admin" : "professional";
            void changeRole(role);
          }}
        >
          <option value="clinic_admin">Clinic administrator</option>
          <option value="professional">Professional</option>
        </select>
      </label>
      <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => void removeMember()}>
        Remove
      </Button>
      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
