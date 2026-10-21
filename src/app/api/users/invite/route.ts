import { getEnv } from "@/config/env";
import { HttpError } from "@/lib/http/error";
import { createBffHandler } from "@/server/api/route";
import { usersStore } from "@/server/users/store";
import { inviteSchema, userSchema } from "@/lib/validation/users";

export const dynamic = "force-dynamic";
export const POST = createBffHandler({
  method: "POST", permission: "member:invite", input: inviteSchema, output: userSchema,
  execute: async input => {
    if (getEnv().APP_KIND !== "backoffice") throw new HttpError(404, "RESOURCE_NOT_FOUND");
    if (!input) throw new HttpError(400, "VALIDATION_ERROR");
    return usersStore.invite(input);
  },
});
