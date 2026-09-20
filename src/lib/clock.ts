/** Central server clock with an E2E-only override. */
export function serverNow() {
  const override = process.env.ATHAR_E2E === "true" ? process.env.ATHAR_TEST_NOW : undefined;
  if (override) {
    const date = new Date(override);
    if (!Number.isNaN(date.valueOf())) return date;
  }
  return new Date();
}

export function serverNowMs() { return serverNow().getTime(); }
