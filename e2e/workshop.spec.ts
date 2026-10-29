import { expect, test } from "@playwright/test";
import { freshStart, waitForBench } from "./helpers";

test("change parameters and save a circuit in the workshop", async ({ page }) => {
  await freshStart(page);
  await page.goto("/workshop");
  await waitForBench(page);
  await page.getByTestId("preset-workshop-single").click();
  await page.getByRole("tab", { name: "Circuit" }).click();
  await page.getByTestId("part-row-R1").click();
  await page.getByTestId("resistance-R1").fill("470");
  await page.getByTestId("apply-resistance-R1").click();
  await page.getByTestId("tab-instruments").click();
  await page.getByTestId("supply-output").click();
  await page.getByTestId("meter-mode-dc-voltage").click();
  await page.getByTestId("probe-red").selectOption("T2");
  await page.getByTestId("probe-black").selectOption("T8");
  await expect(page.getByTestId("meter-display")).toHaveText("12.00");
  await page.getByRole("tab", { name: "Workshop" }).click();
  await page.getByTestId("project-name").fill("470 ohm test");
  await page.getByTestId("save-project").click();
  await page.reload();
  await waitForBench(page);
  await expect(page.getByTestId("project-list")).toContainText("470 ohm test");
});
