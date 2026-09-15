# Formulários

Padrão: schema Zod → React Hook Form → campos @ginga/ui → Server Action ou BFF → Product API.

Exemplo neutro completo e testado: `src/lib/validation/example.ts` e `src/components/forms/example-form.tsx`. Não é montado como uma feature, não armazena dados e não possui fake endpoint. Serve de referência para composição, validação e tratamento de erro.

```tsx
"use client";
import { ExampleForm } from "@/components/forms/example-form";
import type { ExampleResult, ExampleValues } from "@/lib/validation/example";

// Em um produto, submit chama a Server Action ou rota BFF do contrato real.
export function FormSection({
  submit,
}: {
  submit: (values: ExampleValues) => Promise<ExampleResult>;
}) {
  return <ExampleForm submit={submit} />;
}
```

O exemplo usa zodResolver, register e handleSubmit. O Input é de @ginga/ui; FieldLabel, FieldError e aria-describedby associam os erros ao controle. Durante a requisição, campos e botão ficam desabilitados. Erro de campo vindo do servidor recebe foco quando o controle é reabilitado. Erros gerais são anunciados por role=alert; sucesso por role=status. Não renderize mensagens internas capturadas de exceções.

O callback retorna `{ ok: true }` ou `{ ok: false, error: ApiErrorResponse }`; também pode lançar ApiError vindo do bffRequest. O exemplo valida o DTO e traduz por code. createExampleSchema recebe tradutor de validation para mensagens Zod locais, sem estado global de locale.

Em VALIDATION_ERROR, applyFieldErrors usa details[], uma allowlist de FieldPath e setError do RHF. Exemplo: detail.field=email, detail.code=IS_EMAIL → validation.IS_EMAIL. Mensagens próprias/client/server são traduzidas por keys estáveis; message do backend nunca é contrato nem fallback visual neste template. Fields desconhecidos não são aplicados e o erro geral continua visível. 401 oferece login, 403 mostra acesso negado e 500 é sempre genérico. Veja [contrato completo](error-handling.md).

Valide novamente no servidor com o mesmo schema quando os contratos coincidirem. O helper createBffHandler faz isso para handlers JSON. Para Server Action, valide FormData explicitamente antes da operação. A Product API permanece responsável pela validação final, autorização e persistência. Validação do browser é somente UX.

Não criar form engine, wrappers genéricos de todos os campos ou senha no frontend de produto. MFA, password reset e login são redirecionados ao Ginga Identity.
