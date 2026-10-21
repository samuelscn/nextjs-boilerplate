import type { z } from "zod";
import type { ApiErrorDetail } from "../http/api-error";

export function validationDetails(error: z.ZodError): ApiErrorDetail[] {
  return error.issues.slice(0, 100).map(issue => {
    let code = "INVALID_VALUE";
    if (issue.code === "too_small") code = issue.minimum === 1 ? "IS_NOT_EMPTY" : "MIN_LENGTH";
    if (issue.code === "too_big") code = "MAX_LENGTH";
    if (issue.code === "invalid_format") {
      if (issue.format === "email") code = "IS_EMAIL";
      if (issue.format === "uuid") code = "IS_UUID";
    }
    const field = issue.path.map(String).join(".");
    return { ...(field && field.length <= 128 ? { field } : {}), code };
  });
}
