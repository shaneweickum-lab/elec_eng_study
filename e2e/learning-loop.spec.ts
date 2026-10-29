import { expect, test } from "@playwright/test";
import { freshStart, passOhmsLawCheck, waitForBench } from "./helpers";

/**
 * The first-release definition of done:
 * Academy → Ohm's law lesson → workbench → change values → measure →
 * complete a challenge → feedback → progress saved.
 */
test("complete learner loop", async ({ page }) => {
  await freshStart(page);

  // Academy → lesson
  await page.goto("/academy/tier-1");
  await page.getByTestId("lesson-link-ohms-law").click();
  await expect(page.getByRole("heading", { level: 1, name: "Ohm's Law" })).toBeVisible();

  // Interactive demonstration uses the solver: 12 V across 240 Ω = 50 mA.
  await expect(page.getByTestId("explorer-current")).toHaveText("50.0 mA");

  // Knowledge check → lesson complete → enter the workbench
  await passOhmsLawCheck(page);
  await page.getByTestId("lesson-challenge-dc-current-basic").click();
  await expect(page).toHaveURL(/\/challenges\/dc-current-basic/);
  await waitForBench(page);

  // Start an independent attempt
  await page.getByTestId("start-independent").click();
  await expect(page.getByTestId("task-panel")).toBeVisible();

  // De-energized: open link J1 and insert the meter in series across T1–T2.
  await page.getByRole("tab", { name: "Circuit" }).click();
  await page.getByTestId("part-row-J1").click();
  await page.getByTestId("jumper-J1").click();
  await page.getByTestId("tab-instruments").click();
  await page.getByTestId("meter-mode-dc-current").click();
  await page.getByTestId("probe-red").selectOption("T1");
  await page.getByTestId("probe-black").selectOption("T2");

  // Change a circuit value, then energize.
  await page.getByTestId("supply-voltage-input").fill("10");
  await page.getByTestId("supply-voltage-input").press("Enter");
  await page.getByTestId("supply-output").click();

  // Read the instrument and log the reading.
  await expect(page.getByTestId("meter-unit")).toHaveText("mA");
  const display = (await page.getByTestId("meter-display").textContent())!;
  const milliamps = Number(display);
  expect(milliamps).toBeGreaterThan(0);
  await page.getByTestId("log-reading").click();
  await page.getByRole("tab", { name: "Circuit" }).click();
  await expect(page.getByTestId("readings-log")).toContainText(display);

  // Calculated answer (agrees with the reading to well within 2 %).
  await page.getByRole("tab", { name: "Challenge" }).click();
  await page.getByTestId("answer-predict").fill(`${milliamps}m`);
  await page.getByTestId("submit-challenge").click();

  // Feedback
  await expect(page.getByTestId("challenge-result")).toBeVisible();
  await expect(page.getByTestId("result-status")).toHaveText("Passed");
  await expect(page.getByTestId("result-safety")).toHaveText("100");

  // Progress saved: survives a reload and appears on the progress page.
  await page.reload();
  await page.goto("/progress");
  await expect(page.getByTestId("attempts-table")).toContainText("Current in a Basic DC Circuit");
  await expect(page.getByTestId("attempts-table")).toContainText("Passed");
  await page.goto("/challenges");
  await expect(page.getByTestId("challenge-link-target-current")).toHaveText("Start");
});

test("unsafe technique is recorded and scored separately", async ({ page }) => {
  await freshStart(page);
  await passOhmsLawCheck(page);
  await page.goto("/challenges/dc-current-basic");
  await waitForBench(page);
  await page.getByTestId("start-guided").click();
  await page.getByTestId("tab-instruments").click();
  await page.getByTestId("supply-output").click();
  // Ohmmeter on a live circuit.
  await page.getByTestId("meter-mode-resistance").click();
  await page.getByTestId("probe-red").selectOption("T2");
  await page.getByTestId("probe-black").selectOption("T8");
  await expect(page.getByTestId("meter-readout")).toContainText("Invalid: circuit energized");
  await page.getByRole("tab", { name: "Circuit" }).click();
  await expect(page.getByTestId("safety-log")).toContainText("energized");
  await page.getByRole("tab", { name: "Challenge" }).click();
  await page.getByTestId("submit-challenge").click();
  await expect(page.getByTestId("result-safety")).not.toHaveText("100");
});

test("selecting a terminal on the isometric canvas", async ({ page }) => {
  await page.goto("/simulator/training-bench");
  await waitForBench(page);
  const canvas = page.getByTestId("bench-canvas");
  const box = (await canvas.boundingBox())!;
  const pos = await page.evaluate(() => (window as unknown as { __ieaBench: { postScreenPosition(id: string): { x: number; y: number } } }).__ieaBench.postScreenPosition("T9"));
  await page.mouse.click(box.x + pos.x, box.y + pos.y);
  await expect(page.getByRole("tabpanel", { name: "Inspect" }).getByText("Terminal T9")).toBeVisible();
  await page.getByTestId("place-red").click();
  await page.getByTestId("tab-instruments").click();
  await expect(page.getByTestId("probe-red")).toHaveValue("T9");
});
