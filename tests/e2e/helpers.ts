import { expect, type Page } from "@playwright/test";

/** Report live Gemini as available so mocked live-mode tests are deterministic. */
export async function mockStatus(page: Page, availability = "available") {
  await page.route("**/api/ai/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        configured: true,
        model: "gemini-3.5-flash-lite",
        fallbackModel: "gemini-3.5-flash",
        availability,
        lastErrorCategory:
          availability === "unavailable" ? "daily-quota" : null,
        lastErrorAt: null,
        lastSuccessAt: null,
        fallbackActive: false,
        scriptedRecommended: availability === "unavailable",
        retryAt:
          availability === "unavailable"
            ? new Date(Date.now() + 5 * 3600000).toISOString()
            : null,
        models: [],
        photoAnalysis: false,
        realAccountAI: false,
      }),
    }),
  );
}
export async function createJamie(page: Page) {
  await page.goto("/onboarding?demo=1");
  await page.getByLabel("I am at least 18 years old.").check();
  await page
    .getByRole("button", { name: "Explore the predefined demonstration" })
    .click();
  await page.getByRole("button", { name: "Send fictional sample 1" }).click();
  await page.getByRole("button", { name: "Send fictional sample 2" }).click();
  await page.getByRole("button", { name: "Review my profile" }).click();
  await page
    .getByLabel("I’ve reviewed this profile and approve sharing it.")
    .check();
  await page
    .getByRole("button", { name: "Approve & meet your introductions" })
    .click();
  await expect(page).toHaveURL("/discover");
}
