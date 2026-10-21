"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  Button, Checkbox, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Field, FieldDescription, FieldError, FieldLabel, Form, Input, Label, Textarea,
} from "@ginga/ui";
import { bffRequest } from "@/lib/http/browser";
import { ApiError, normalizeFrontendError } from "@/lib/http/api-error";
import { applyFieldErrors } from "@/lib/validation/form-errors";
import { createRoleSchema, roleSchema, type PermissionCatalog, type Role, type RoleValues } from "@/lib/validation/users";
import { ErrorState } from "../feedback";
import { permissionLabel, resourceLabel } from "./labels";
import { useNotify } from "@/hooks/use-notify";

const slugify = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/gu, "").toLowerCase()
  .replace(/[^a-z0-9]+/gu, "-").replace(/^[^a-z]+|-+$/gu, "").slice(0, 80);

// Create (role undefined) or edit a custom role. The permission matrix is grouped by resource
// from the API catalog; the API rejects permissions the editor does not hold.
export function RoleFormDialog({ role, catalog, open, onOpenChange }: { role?: Role | undefined; catalog: PermissionCatalog; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations();
  const tForm = useTranslations("backoffice.users.rolesTab.form");
  const tPermissions = useTranslations("backoffice.permissions");
  const router = useRouter();
  const id = useId();
  const [failure, setFailure] = useState<unknown>();
  const notify = useNotify();
  const defaults: RoleValues = { name: role?.name ?? "", slug: role?.slug ?? "", description: role?.description ?? "", permissions: role?.permissions ?? [] };
  const { register, control, handleSubmit, setError, setValue, reset, getFieldState, formState: { errors } } = useForm<RoleValues>({
    resolver: zodResolver(createRoleSchema(code => t("validation." + code))), defaultValues: defaults,
  });
  const save = useMutation({
    mutationFn: (values: RoleValues) => role
      ? bffRequest("/api/roles/update", roleSchema, { method: "POST", body: { ...values, id: role.id } })
      : bffRequest("/api/roles/create", roleSchema, { method: "POST", body: values }),
    onSuccess: () => { onOpenChange(false); notify.success("backoffice.users.rolesTab.saved"); router.refresh(); },
    onError: error => {
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR") applyFieldErrors(error.details, ["name", "slug", "description", "permissions"], setError, t);
      setFailure(normalizeFrontendError(error));
    },
  });
  const field = (name: keyof RoleValues) => ({ invalid: Boolean(errors[name]), id: `${id}-${name}`, error: errors[name] ? `${id}-${name}-error` : undefined });
  return <Dialog open={open} onOpenChange={next => { onOpenChange(next); if (!next) { setFailure(undefined); reset(defaults); } }}>
    <DialogContent closeLabel={t("common.actions.close")} className="sm:max-w-2xl">
      <DialogHeader><DialogTitle>{tForm(role ? "editTitle" : "createTitle")}</DialogTitle><DialogDescription>{tForm("description")}</DialogDescription></DialogHeader>
      <Form noValidate className="grid gap-4" onSubmit={handleSubmit(values => { setFailure(undefined); save.mutate(values); })}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={field("name").invalid}>
            <FieldLabel htmlFor={field("name").id}>{tForm("name")}</FieldLabel>
            <Input id={field("name").id} maxLength={120} disabled={save.isPending} aria-invalid={field("name").invalid} aria-describedby={field("name").error}
              {...register("name", { onChange: event => { if (!role && !getFieldState("slug").isDirty) setValue("slug", slugify(event.target.value)); } })} />
            {errors.name && <FieldError id={field("name").error}>{errors.name.message}</FieldError>}
          </Field>
          <Field data-invalid={field("slug").invalid}>
            <FieldLabel htmlFor={field("slug").id}>{tForm("slug")}</FieldLabel>
            <Input id={field("slug").id} maxLength={80} disabled={save.isPending} aria-invalid={field("slug").invalid}
              aria-describedby={[`${id}-slug-hint`, field("slug").error].filter(Boolean).join(" ")} {...register("slug")} />
            <FieldDescription id={`${id}-slug-hint`}>{tForm("slugHint")}</FieldDescription>
            {errors.slug && <FieldError id={field("slug").error}>{errors.slug.message}</FieldError>}
          </Field>
        </div>
        <Field data-invalid={field("description").invalid}>
          <FieldLabel htmlFor={field("description").id}>{tForm("descriptionField")}</FieldLabel>
          <Textarea id={field("description").id} rows={2} maxLength={500} disabled={save.isPending} aria-invalid={field("description").invalid} aria-describedby={field("description").error} {...register("description")} />
          {errors.description && <FieldError id={field("description").error}>{errors.description.message}</FieldError>}
        </Field>
        <fieldset className="grid gap-3" aria-describedby={errors.permissions ? `${id}-permissions-error` : undefined} aria-invalid={Boolean(errors.permissions)}>
          <legend className="mb-1 text-sm font-medium">{tForm("permissions")}</legend>
          <Controller control={control} name="permissions" render={({ field: permissions }) =>
            <div className="grid gap-3 sm:grid-cols-2">{catalog.groups.map(group => <div key={group.resource} role="group" aria-labelledby={`${id}-${group.resource}`} className="grid content-start gap-2 rounded-lg border p-3">
              <p id={`${id}-${group.resource}`} className="text-sm font-medium">{resourceLabel(group.resource, tPermissions)}</p>
              {group.permissions.map(permission => <div key={permission} className="flex items-center gap-2">
                <Checkbox id={`${id}-${permission}`} disabled={save.isPending} checked={permissions.value.includes(permission)}
                  onCheckedChange={checked => permissions.onChange(checked ? [...permissions.value, permission] : permissions.value.filter(value => value !== permission))} />
                <Label htmlFor={`${id}-${permission}`} className="font-normal">{permissionLabel(permission, tPermissions)}</Label>
              </div>)}
            </div>)}</div>} />
          {errors.permissions && <FieldError id={`${id}-permissions-error`}>{errors.permissions.message}</FieldError>}
        </fieldset>
        {failure !== undefined && <ErrorState error={failure} />}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>{t("common.actions.cancel")}</DialogClose>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? t("common.actions.saving") : tForm("submit")}</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>;
}
