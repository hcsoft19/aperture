const CHECKS = ["app", "database-not-contacted"] as const;

export type HealthCheckName = (typeof CHECKS)[number];

export type HealthReport = {
  ok: true;
  checks: readonly HealthCheckName[];
};

/**
 * Names the local app check. It does not contact the database or any other host.
 */
export function healthReport(): HealthReport {
  return {
    ok: true,
    checks: [...CHECKS],
  };
}
