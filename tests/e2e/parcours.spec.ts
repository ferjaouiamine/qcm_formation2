import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import questions from "../../db/questions.json" with { type: "json" };
test("parcours candidat, reprise, mode hors ligne, correction et administration", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Faites le point sur vos connaissances.",
    }),
  ).toBeVisible();
  await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  await page.getByLabel("Nom et prénom").fill("Candidat Navigateur");
  await page.getByLabel("Agence / entité").fill("Agence Démonstration");
  await page.getByRole("button", { name: "Commencer l’évaluation" }).click();
  await expect(page.getByRole("timer")).toContainText("29:");
  await page.getByRole("radio").first().check();
  await expect(
    page.getByText("QUESTION 2 / 20", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Toutes les réponses sont sauvegardées"),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("le QCM a recommencé")).toBeVisible();
  await expect(
    page.getByText("QUESTION 1 / 20", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("0 / 20 questions renseignées")).toBeVisible();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await page.getByRole("button", { name: "J’ai compris" }).click();
  for (let i = 0; i < 14; i++) {
    const q = questions[i];
    const label = q.options.find((o) => o.id === q.correct)!.label;
    await page
      .getByRole("radio", {
        name: new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      })
      .check();
    await expect(
      page.getByText("Toutes les réponses sont sauvegardées"),
    ).toBeVisible();
    await expect(
      page.getByText(`QUESTION ${i + 2} / 20`, { exact: true }),
    ).toBeVisible();
  }
  await context.setOffline(true);
  await page.getByRole("radio").nth(1).check();
  await expect(
    page.getByText("QUESTION 16 / 20", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("en attente de synchronisation")).toBeVisible();
  await context.setOffline(false);
  await expect(
    page.getByText("Toutes les réponses sont sauvegardées"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Terminer l’évaluation", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "5 question(s) sans réponse",
  );
  await page.getByRole("button", { name: "Continuer le QCM" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Terminer l’évaluation", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  await expect(page).toHaveURL(/results/);
  await expect(page.getByText("Acquis · 70 %")).toBeVisible();
  await expect(page.locator("article")).toHaveCount(20);
  await page.getByRole("button", { name: "Erreurs uniquement" }).click();
  await expect(page.locator("article")).toHaveCount(6);
  await page.reload();
  await expect(page.getByText("Acquis · 70 %")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger le PDF" }).click();
  const pdf = await download;
  const path = await pdf.path();
  expect(readFileSync(path!).subarray(0, 4).toString()).toBe("%PDF");
  await page.goto("/admin");
  await page.getByLabel("Adresse e-mail").fill("e2e@example.test");
  await page.getByLabel("Mot de passe").fill("test-browser-password-123");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(
    page.getByRole("heading", { name: "Vue d’ensemble", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("14 / 20", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Candidats", exact: true }).click();
  await expect(page.getByText("Candidat Navigateur")).toBeVisible();
  await page.getByRole("button", { name: "Voir", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Candidat Navigateur" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Classement", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Classement des candidats" }),
  ).toBeVisible();
  const ranking = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter en PDF" }).click();
  await ranking;
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(
    page.getByRole("button", { name: "Se connecter" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("affichage mobile sans débordement et navigation au clavier", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByLabel("Nom et prénom")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/accueil-mobile.png",
    fullPage: true,
  });
  await page.getByLabel("Nom et prénom").fill("Mobile Test");
  await page.getByLabel("Agence / entité").fill("Agence Mobile");
  await page.getByRole("button", { name: "Commencer l’évaluation" }).click();
  await expect(page.getByRole("radio")).toHaveCount(4);
  await page.getByRole("radio").first().focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByText("QUESTION 2 / 20", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Précédente" }).click();
  await expect(page.getByRole("radio").first()).toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/question-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Question 20, sans réponse", exact: true })
    .click();
  await page.getByRole("radio").first().check();
  await expect(
    page.getByText("Toutes les réponses sont sauvegardées"),
  ).toBeVisible();
  await expect(
    page.getByText("QUESTION 20 / 20", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page).toHaveURL(/quiz/);
});
