import { expect, test } from "@playwright/test";

test("lesson terminology shows definitions on hover, focus and tap", async ({ page }) => {
  await page.goto("/academy/lesson/ohms-law");
  const term = page.locator("[data-glossary=coulomb]").first();
  await expect(term).toBeVisible();

  await term.hover();
  await expect(page.getByTestId("glossary-tip-coulomb").first()).toContainText("SI unit of electric charge");
  await page.mouse.move(0, 0);
  await page.keyboard.press("Escape");

  // Keyboard users reach terms with Tab; touch users tap them.
  const ammeter = page.locator("[data-glossary=ammeter]").first();
  await ammeter.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("glossary-tip-ammeter").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await ammeter.click();
  await expect(page.getByTestId("glossary-tip-ammeter").first()).toBeVisible();

  // Each term is linked once per section, not on every occurrence.
  const section = page.locator("#measuring");
  await expect(section.locator("[data-glossary=ammeter]")).toHaveCount(1);

  // Full list for reference and screen readers.
  await page.getByTestId("key-terms").locator("summary").click();
  await expect(page.getByTestId("key-terms")).toContainText("Clamp meter");
});

test("safety lesson links standards and safety terms", async ({ page }) => {
  await page.goto("/academy/lesson/electrical-safety-fundamentals");
  for (const id of ["nfpa-70e", "lockout-tagout", "live-dead-live", "arc-flash", "qualified-person"]) {
    await expect(page.locator(`[data-glossary=${id}]`).first()).toBeVisible();
  }
});
