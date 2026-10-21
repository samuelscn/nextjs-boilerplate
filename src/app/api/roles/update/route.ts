import { getEnv } from "@/config/env";
import { HttpError } from "@/lib/http/error";
import { createBffHandler } from "@/server/api/route";
import { callContext, membersGateway } from "@/server/members";
import { roleSchema, roleUpdateSchema } from "@/lib/validation/users";

// Replaces a custom role's data and permission set.
export const dynamic = "force-dynamic";
export const POST = createBffHandler({
  method: "POST", permission: "role:update", input: roleUpdateSchema, output: roleSchema,
  execute: async (input, requestId) => {
    if (getEnv().APP_KIND !== "backoffice") throw new HttpError(404, "RESOURCE_NOT_FOUND");
    if (!input) throw new HttpError(400, "VALIDATION_ERROR");
    const { id, ...values } = input;
    return membersGateway().updateRole(id, values, await callContext(requestId));
  },
});
