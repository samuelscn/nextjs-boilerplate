import { getEnv } from "@/config/env";
import { HttpError } from "@/lib/http/error";
import { createBffHandler } from "@/server/api/route";
import { callContext, membersGateway } from "@/server/members";
import { changeStatusSchema, memberSchema } from "@/lib/validation/users";

// Suspends or reactivates a member. Suspension removes every permission.
export const dynamic = "force-dynamic";
export const POST = createBffHandler({
  method: "POST", permission: "member:update", input: changeStatusSchema, output: memberSchema,
  execute: async (input, requestId) => {
    if (getEnv().APP_KIND !== "backoffice") throw new HttpError(404, "RESOURCE_NOT_FOUND");
    if (!input) throw new HttpError(400, "VALIDATION_ERROR");
    return membersGateway().setStatus(input, await callContext(requestId));
  },
});
