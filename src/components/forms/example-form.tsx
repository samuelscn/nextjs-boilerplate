"use client";

import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Field, FieldError, FieldLabel, Form, Input } from "@ginga/ui";
import { exampleSchema, type ExampleResult, type ExampleValues } from "@/lib/validation/example";

export function ExampleForm({ submit }: { submit: (values: ExampleValues) => Promise<ExampleResult> }) {
  const id = useId();
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, setError, setFocus, formState: { errors, isSubmitting } } = useForm<ExampleValues>({
    resolver: zodResolver(exampleSchema), defaultValues: { label: "" },
  });
  useEffect(() => {
    if (errors.label && !isSubmitting) setFocus("label");
  }, [errors.label, isSubmitting, setFocus]);
  const onSubmit = handleSubmit(async values => {
    setSaved(false);
    try {
      const result = await submit(values);
      if (!result.ok) {
        if (result.fieldErrors?.label) setError("label", { message: result.fieldErrors.label }, { shouldFocus: true });
        setError("root", { message: result.message });
      } else setSaved(true);
    } catch { setError("root", { message: "Não foi possível salvar. Tente novamente." }); }
  });
  return <Form onSubmit={onSubmit} noValidate className="stack">
    <Field data-invalid={Boolean(errors.label)}>
      <FieldLabel htmlFor={id}>Texto</FieldLabel>
      <Input id={id} maxLength={80} disabled={isSubmitting}
        aria-invalid={Boolean(errors.label)} aria-describedby={errors.label ? id + "-error" : undefined} {...register("label")} />
      {errors.label && <FieldError id={id + "-error"}>{errors.label.message}</FieldError>}
    </Field>
    {errors.root && <p role="alert">{errors.root.message}</p>}
    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando…" : "Salvar"}</Button>
    {saved && <p role="status">Salvo.</p>}
  </Form>;
}
