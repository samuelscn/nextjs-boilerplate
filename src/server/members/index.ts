import "server-only";
import { randomUUID } from "node:crypto";
import { getAuthEnv } from "@/config/env";
import { HttpError } from "@/lib/http/error";
import { getSession } from "../auth";
import type { CallContext, MembersGateway } from "./gateway";
import { liveMembersGateway } from "./live";
import { mockMembersGateway } from "./mock";

export type { MembersGateway } from "./gateway";
export function membersGateway(): MembersGateway {
  return getAuthEnv().API_MODE === "live" ? liveMembersGateway : mockMembersGateway();
}
export async function callContext(requestId: string = randomUUID()): Promise<CallContext> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "AUTHENTICATION_REQUIRED");
  return { actor: session.user.id, requestId };
}
