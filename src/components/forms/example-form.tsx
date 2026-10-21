"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Field, FieldError, FieldLabel, Form, Input } from "@ginga/ui";
import { createExampleSchema, type ExampleResult, type ExampleValues } from "@/lib/validation/example";
import { ApiError, normalizeFrontendError, problemSchema } from "@/lib/http/api-error";
import { applyFieldErrors } from "@/lib/validation/form-errors";
import { ErrorState } from "../feedback";

export function ExampleForm({ submit }: { submit: (values: ExampleValues) => Promise<ExampleResult> }) {
  const t = useTranslations();
  const id = useId();
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<unknown>();
  const { register, handleSubmit, setError, setFocus, formState: { errors, isSubmitting } } = useForm<ExampleValues>({
    resolver: zodResolver(createExampleSchema(code => t("validation." + code))), defaultValues: { label: "" },
  });
  useEffect(() => {
    if (errors.label && !isSubmitting) setFocus("label");
  }, [errors.label, isSubmitting, setFocus]);
  const onSubmit = handleSubmit(async values => {
    setSaved(false); setFailure(undefined);
    try {
      const result = await submit(values);
      if (!result.ok) throw new ApiError(problemSchema.parse(result.error));
      setSaved(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR") applyFieldErrors(error.details, ["label"], setError, t);
      setFailure(normalizeFrontendError(error));
    }
  });
  return <Form onSubmit={onSubmit} noValidate className="stack">
    <Field data-invalid={Boolean(errors.label)}>
      <FieldLabel htmlFor={id}>{t("forms.label")}</FieldLabel>
      <Input id={id} maxLength={80} disabled={isSubmitting}
        aria-invalid={Boolean(errors.label)} aria-describedby={errors.label ? id + "-error" : undefined} {...register("label")} />
      {errors.label && <FieldError id={id + "-error"}>{errors.label.message}</FieldError>}
    </Field>
    {failure !== undefined && <ErrorState error={failure} />}
    <Button type="submit" disabled={isSubmitting}>{t(isSubmitting ? "common.actions.saving" : "common.actions.save")}</Button>
    {saved && <p role="status">{t("forms.saved")}</p>}
  </Form>;
}
