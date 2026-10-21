import { getEnv } from "@/config/env";
import { HttpError } from "@/lib/http/error";
import { createBffHandler } from "@/server/api/route";
import { callContext, membersGateway } from "@/server/members";
import { roleInputSchema, roleSchema } from "@/lib/validation/users";

// Creates a custom role. System roles are fixed.
export const dynamic = "force-dynamic";
export const POST = createBffHandler({
  method: "POST", permission: "role:create", input: roleInputSchema, output: roleSchema,
  execute: async (input, requestId) => {
    if (getEnv().APP_KIND !== "backoffice") throw new HttpError(404, "RESOURCE_NOT_FOUND");
    if (!input) throw new HttpError(400, "VALIDATION_ERROR");
    return membersGateway().createRole(input, await callContext(requestId));
  },
});
