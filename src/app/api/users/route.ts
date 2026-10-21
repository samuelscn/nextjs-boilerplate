import { getEnv } from "@/config/env";
import { HttpError } from "@/lib/http/error";
import { createBffHandler } from "@/server/api/route";
import { callContext, membersGateway } from "@/server/members";
import { memberPageSchema, usersQuerySchema } from "@/lib/validation/users";

// Next pages of the member list for incremental loading (mobile infinite scroll). Same query schema as the page.
export const dynamic = "force-dynamic";
export const GET = createBffHandler({
  method: "GET", permission: "member:read", input: usersQuerySchema, output: memberPageSchema,
  execute: async (input, requestId) => {
    if (getEnv().APP_KIND !== "backoffice") throw new HttpError(404, "RESOURCE_NOT_FOUND");
    if (!input) throw new HttpError(400, "VALIDATION_ERROR");
    return membersGateway().listMembers(input, await callContext(requestId));
  },
});
