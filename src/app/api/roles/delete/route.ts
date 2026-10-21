import { getEnv } from "@/config/env";
import { HttpError } from "@/lib/http/error";
import { createBffHandler } from "@/server/api/route";
import { callContext, membersGateway } from "@/server/members";
import { okSchema, roleIdSchema } from "@/lib/validation/users";

// Deletes a custom role and its assignments.
export const dynamic = "force-dynamic";
export const POST = createBffHandler({
  method: "POST", permission: "role:delete", input: roleIdSchema, output: okSchema,
  execute: async (input, requestId) => {
    if (getEnv().APP_KIND !== "backoffice") throw new HttpError(404, "RESOURCE_NOT_FOUND");
    if (!input) throw new HttpError(400, "VALIDATION_ERROR");
    await membersGateway().deleteRole(input.id, await callContext(requestId));
    return { ok: true as const };
  },
});
