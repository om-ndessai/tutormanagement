// A Zod verdict as the console's forms show it: the first message for each field, under the field
// (the web's FormField error), keyed as the server's fieldErrors are.
export function firstErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
