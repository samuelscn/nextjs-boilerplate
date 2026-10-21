"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import {
  Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
  Field, FieldError, FieldLabel, Form, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@ginga/ui";
import { bffRequest } from "@/lib/http/browser";
import { ApiError, normalizeFrontendError } from "@/lib/http/api-error";
import { applyFieldErrors } from "@/lib/validation/form-errors";
import { createInviteSchema, userSchema, type InviteValues, type Role } from "@/lib/validation/users";
import { ErrorState } from "../feedback";
import { roleLabel } from "./labels";

export function InviteUserDialog({ roles }: { roles: Role[] }) {
  const t = useTranslations();
  const tRoles = useTranslations("backoffice.users.roles");
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState<unknown>();
  const { register, control, handleSubmit, setError, reset, formState: { errors } } = useForm<InviteValues>({
    resolver: zodResolver(createInviteSchema(code => t("validation." + code))), defaultValues: { email: "", roleId: "" },
  });
  const invite = useMutation({
    mutationFn: (values: InviteValues) => bffRequest("/api/users/invite", userSchema, { method: "POST", body: values }),
    onSuccess: () => { setOpen(false); reset(); router.refresh(); },
    onError: error => {
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR") applyFieldErrors(error.details, ["email", "roleId"], setError, t);
      setFailure(normalizeFrontendError(error));
    },
  });
  const items = Object.fromEntries(roles.map(role => [role.id, roleLabel(role.id, tRoles)]));
  return <Dialog open={open} onOpenChange={next => { setOpen(next); if (!next) { setFailure(undefined); reset(); } }}>
    <DialogTrigger render={<Button />}><PlusIcon />{t("backoffice.users.invite.action")}</DialogTrigger>
    <DialogContent closeLabel={t("common.actions.close")}>
      <DialogHeader><DialogTitle>{t("backoffice.users.invite.title")}</DialogTitle><DialogDescription>{t("backoffice.users.invite.description")}</DialogDescription></DialogHeader>
      <Form noValidate className="stack" onSubmit={handleSubmit(values => { setFailure(undefined); invite.mutate(values); })}>
        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor={id + "-email"}>{t("backoffice.users.invite.email")}</FieldLabel>
          <Input id={id + "-email"} type="email" autoComplete="off" maxLength={254} disabled={invite.isPending}
            aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? id + "-email-error" : undefined} {...register("email")} />
          {errors.email && <FieldError id={id + "-email-error"}>{errors.email.message}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.roleId)}>
          <FieldLabel htmlFor={id + "-role"}>{t("backoffice.users.invite.role")}</FieldLabel>
          <Controller control={control} name="roleId" render={({ field }) =>
            <Select items={items} name={field.name} value={field.value || null} onValueChange={value => field.onChange(value ?? "")} disabled={invite.isPending}>
              <SelectTrigger id={id + "-role"} aria-invalid={Boolean(errors.roleId)} aria-describedby={errors.roleId ? id + "-role-error" : undefined}>
                <SelectValue placeholder={t("backoffice.users.invite.rolePlaceholder")} />
              </SelectTrigger>
              <SelectContent>{roles.map(role => <SelectItem key={role.id} value={role.id}>{items[role.id]}</SelectItem>)}</SelectContent>
            </Select>} />
          {errors.roleId && <FieldError id={id + "-role-error"}>{errors.roleId.message}</FieldError>}
        </Field>
        {failure !== undefined && <ErrorState error={failure} />}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>{t("common.actions.cancel")}</DialogClose>
          <Button type="submit" disabled={invite.isPending}>{t(invite.isPending ? "common.actions.saving" : "backoffice.users.invite.submit")}</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>;
}
