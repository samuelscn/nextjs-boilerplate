import { getEnv } from "@/config/env";
import { HttpError } from "@/lib/http/error";
import { createBffHandler } from "@/server/api/route";
import { callContext, membersGateway } from "@/server/members";
import { okSchema, roleAssignmentSchema } from "@/lib/validation/users";

// Assigns or unassigns one role; members may hold several roles.
export const dynamic = "force-dynamic";
export const POST = createBffHandler({
  method: "POST", permission: "role:assign", input: roleAssignmentSchema, output: okSchema,
  execute: async (input, requestId) => {
    if (getEnv().APP_KIND !== "backoffice") throw new HttpError(404, "RESOURCE_NOT_FOUND");
    if (!input) throw new HttpError(400, "VALIDATION_ERROR");
    await membersGateway().setRole(input, await callContext(requestId));
    return { ok: true as const };
  },
});
