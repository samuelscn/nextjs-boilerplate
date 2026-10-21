import "server-only";
import { z } from "zod";
import { memberPageSchema, memberSchema, permissionCatalogSchema, roleSchema, rolesSchema } from "@/lib/validation/users";
import { productRequest } from "../api/product";
import type { MembersGateway } from "./gateway";

const empty = z.unknown();
const roleBody = (input: { name: string; slug: string; description: string; permissions: string[] }) =>
  ({ name: input.name, slug: input.slug, ...(input.description ? { description: input.description } : {}), permissions: input.permissions });

// API_MODE=live: every call goes to the Product API, which authorizes it.
export const liveMembersGateway: MembersGateway = {
  listMembers(query, { requestId }) {
    const search = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
    if (query.q) search.set("q", query.q);
    for (const role of query.role) search.append("role", role);
    for (const status of query.status) search.append("status", status);
    return productRequest("/access/members", memberPageSchema, { query: search, requestId });
  },
  invite(input, { requestId }) {
    return productRequest("/access/members/invitations", memberSchema, { method: "POST", body: input, requestId });
  },
  setStatus({ id, status }, { requestId }) {
    return productRequest(`/access/members/${id}/status`, memberSchema, { method: "PATCH", body: { status }, requestId });
  },
  async setRole({ memberId, roleId, assigned }, { requestId }) {
    await productRequest(`/access/members/${memberId}/roles/${roleId}`, empty, { method: assigned ? "PUT" : "DELETE", requestId });
  },
  listRoles({ requestId }) {
    return productRequest("/access/roles", rolesSchema, { requestId });
  },
  createRole(input, { requestId }) {
    return productRequest("/access/roles", roleSchema, { method: "POST", body: roleBody(input), requestId });
  },
  updateRole(id, input, { requestId }) {
    return productRequest(`/access/roles/${id}`, roleSchema, { method: "PUT", body: roleBody(input), requestId });
  },
  async deleteRole(id, { requestId }) {
    await productRequest(`/access/roles/${id}`, empty, { method: "DELETE", requestId });
  },
  permissionCatalog({ requestId }) {
    return productRequest("/access/permissions", permissionCatalogSchema, { requestId });
  },
};
