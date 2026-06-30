import type { ValidationIssue } from './types';

export interface ValidationIssueSummary {
  code: string;
  message: string;
  paths: string[];
  count: number;
}

export function summarizeValidationIssues(issues: ValidationIssue[]): ValidationIssueSummary[] {
  const summaries = new Map<string, ValidationIssueSummary>();

  for (const issue of issues) {
    const key = `${issue.code}\u0000${issue.message}`;
    const existing = summaries.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.paths.includes(issue.path)) {
        existing.paths.push(issue.path);
      }
      continue;
    }

    summaries.set(key, {
      code: issue.code,
      message: issue.message,
      paths: [issue.path],
      count: 1,
    });
  }

  return [...summaries.values()];
}
