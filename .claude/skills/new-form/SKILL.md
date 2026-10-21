---
name: new-form
description: Build a form (dialog or page) with react-hook-form, Zod, translated validation and server field errors. Use for any create/edit/input UI.
---

# Novo formulário

Modelos: `src/components/users/invite-user-dialog.tsx`, `src/components/users/role-form-dialog.tsx`.

1. Schema com códigos, não frases: `createXSchema(t)` em `src/lib/validation`, usando `t("validation.<CODIGO>")`. Códigos novos entram em `messages/*/validation.json`.
2. `useForm({ resolver: zodResolver(createXSchema(code => t("validation." + code))) })`.
3. Cada campo: `Field` + `FieldLabel htmlFor` + `aria-invalid` + `aria-describedby` apontando para `FieldError`/`FieldDescription`.
4. Envio por `useMutation` + `bffRequest`. Em `VALIDATION_ERROR`, `applyFieldErrors(error.details, [campos permitidos], setError, t)`; demais erros em `<ErrorState error={...} />`.
5. Botão de envio desabilitado durante `isPending` com texto `common.actions.saving`; diálogos com `closeLabel={t("common.actions.close")}`.
6. Ao fechar o diálogo: `reset()` e limpar falha.

Aceite: validação local traduzida, erro de campo do servidor focado no primeiro campo, sem texto literal (o lint barra), teste de componente para o caminho de erro.
