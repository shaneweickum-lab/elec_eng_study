import { expect, test } from "@playwright/test";
import { freshStart } from "./helpers";

test("navigates the main sections", async ({ page }) => {
  await freshStart(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Industrial electrical maintenance");
  await page.getByRole("link", { name: "Open dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Main" }).first();
  await nav.getByRole("link", { name: "Academy" }).click();
  await expect(page.getByRole("heading", { name: "Learning pathways" })).toBeVisible();
  await page.getByRole("link", { name: /Tier 1/ }).first().click();
  await expect(page).toHaveURL(/\/academy\/tier-1/);
  await expect(page.getByText("Ohm's Law", { exact: true }).first()).toBeVisible();

  await page.goto("/academy/tier-2");
  await expect(page.getByText("Motor Control Circuits")).toBeVisible();
  await expect(page.getByText("Planned").first()).toBeVisible();

  await nav.getByRole("link", { name: "Simulator" }).click();
  await expect(page.getByText("Electrical Training Bench")).toBeVisible();
  await nav.getByRole("link", { name: "Challenges" }).click();
  await expect(page.getByText("Diagnose an Open Circuit")).toBeVisible();
  await nav.getByRole("link", { name: "Progress" }).click();
  await expect(page.getByRole("heading", { name: "Skill mastery and learning history" })).toBeVisible();
  await nav.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Preferences" })).toBeVisible();
});

test("planned environments are not presented as working", async ({ page }) => {
  await page.goto("/simulator/control-cabinet");
  await expect(page.getByText("is not available yet")).toBeVisible();
});
