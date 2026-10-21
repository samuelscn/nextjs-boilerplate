import { getEnv } from "@/config/env";
import { HttpError } from "@/lib/http/error";
import { createBffHandler } from "@/server/api/route";
import { callContext, membersGateway } from "@/server/members";
import { inviteSchema, memberSchema } from "@/lib/validation/users";

// Invites by email with an initial role; the invitee becomes active on first sign-in.
export const dynamic = "force-dynamic";
export const POST = createBffHandler({
  method: "POST", permission: "member:invite", input: inviteSchema, output: memberSchema,
  execute: async (input, requestId) => {
    if (getEnv().APP_KIND !== "backoffice") throw new HttpError(404, "RESOURCE_NOT_FOUND");
    if (!input) throw new HttpError(400, "VALIDATION_ERROR");
    return membersGateway().invite(input, await callContext(requestId));
  },
});
