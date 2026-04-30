import { expect, test } from "@playwright/test";

test("homepage renders the marketing landing", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Financial Planner/i);
  // Scope to the page header so we don't trip Playwright's strict mode on
  // the matching brand link inside the footer (LandingHeader and
  // LandingFooter both expose a "Financial Planner" link to /).
  await expect(
    page.getByRole("banner").getByRole("link", { name: /Financial Planner/i })
  ).toBeVisible();
});
