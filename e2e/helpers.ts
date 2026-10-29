import { expect, type Page } from "@playwright/test";

export async function freshStart(page: Page) {
  await page.goto("/dashboard");
  await page.evaluate(() => localStorage.clear());
}

/** Complete the Ohm's law knowledge check with correct answers. */
export async function passOhmsLawCheck(page: Page) {
  await page.goto("/academy/lesson/ohms-law");
  await page.getByTestId("q-q1-a").check();
  await page.getByTestId("q-q2-input").fill("200");
  await page.getByTestId("q-q3-c").check();
  await page.getByTestId("q-q4-b").check();
  await page.getByTestId("q-q5-input").fill("12.3");
  await page.getByTestId("q-q6-b").check();
  await page.getByTestId("submit-check").click();
  await expect(page.getByTestId("check-result")).toContainText("100 %");
  await expect(page.getByTestId("lesson-complete-badge")).toBeVisible();
}

export async function waitForBench(page: Page) {
  await expect(page.locator("[data-testid=bench-canvas][data-ready=true]")).toBeVisible({ timeout: 60_000 });
}
