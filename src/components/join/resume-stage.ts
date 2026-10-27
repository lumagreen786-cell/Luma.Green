/** Resume from schema issues without showing validation errors before input. */
export function resumeStage(
  groups: readonly (readonly string[])[],
  issues: readonly { path: readonly PropertyKey[] }[],
): number {
  if (issues.length === 0) return Math.max(0, groups.length - 1);
  const index = groups.findIndex((fields) =>
    issues.some((issue) => fields.includes(String(issue.path[0]))),
  );
  return Math.max(0, index);
}
