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
  await expect(page).toHaveURL(/merci/);
  await expect(
    page.getByRole("heading", { name: "Merci pour votre participation" }),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveCount(0);
  await expect(page.getByText("Acquis · 70 %")).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("assurance-vie-result")),
  ).toBeNull();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Merci pour votre participation" }),
  ).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem("assurance-vie-result", JSON.stringify({ score: 14 })),
  );
  await page.goto("/results");
  await expect(page).toHaveURL(/merci/);
  await expect(
    page.getByRole("heading", { name: "Merci pour votre participation" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("assurance-vie-result")),
  ).toBeNull();
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
  const pdf = await ranking;
  const path = await pdf.path();
  expect(readFileSync(path!).subarray(0, 4).toString()).toBe("%PDF");
  await page.getByRole("button", { name: "Candidats", exact: true }).click();
  const remove = page.getByRole("button", { name: "Supprimer la candidature de Candidat Navigateur", exact: true });
  page.once("dialog", (dialog) => dialog.dismiss());
  await remove.click();
  await expect(remove).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await remove.click();
  await expect(page.getByRole("status")).toHaveText("La candidature a été supprimée.");
  await expect(remove).toHaveCount(0);
  await page.getByRole("button", { name: "Classement", exact: true }).click();
  await expect(page.getByText("Candidat Navigateur", { exact: true })).toHaveCount(0);
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

test("réessayer une ancienne tentative ouvre un formulaire vide pour un nouvel utilisateur", async ({ page }) => {
  await page.goto("/");
  const stale = {
    attemptId: "11111111-1111-4111-8111-111111111111",
    token: "ancien-token-invalide", fullName: "Nouvelle Tentative", agency: "Agence Test",
    expiresAt: "2020-01-01T00:00:00.000Z", serverNow: "2020-01-01T00:00:00.000Z",
    answers: { 1: "a" }, pending: { 1: { selected: "a", revision: 1 } }, currentIndex: 12, away: true,
  };
  await page.evaluate((saved) => {
    localStorage.setItem("assurance-vie-session", JSON.stringify(saved));
    sessionStorage.setItem("result-access", "ancien-acces");
  }, stale);
  await page.goto("/");
  await page.route("**/api/attempts", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Service temporairement indisponible" } }) }));
  await page.getByRole("button", { name: "Réessayer le QCM" }).click();
  await expect(page).toHaveURL(/\/inscription$/);
  await expect(page.getByLabel("Nom et prénom")).toHaveValue("");
  await expect(page.getByLabel("Agence / entité")).toHaveValue("");
  expect(await page.evaluate(() => localStorage.getItem("assurance-vie-session"))).toBeNull();
  await page.reload();
  await expect(page.getByLabel("Nom et prénom")).toHaveValue("");
  await page.getByLabel("Nom et prénom").fill("Nouvel Utilisateur");
  await page.getByLabel("Agence / entité").fill("Nouvelle Agence");
  await page.getByRole("button", { name: "Commencer l’évaluation" }).click();
  await expect(page.getByRole("alert")).toContainText("Service temporairement indisponible");
  expect(await page.evaluate(() => localStorage.getItem("assurance-vie-session"))).toBeNull();
  await page.unroute("**/api/attempts");
  await page.getByRole("button", { name: "Commencer l’évaluation" }).click();
  await expect(page).toHaveURL(/\/quiz$/);
  await expect(page.getByText("QUESTION 1 / 20", { exact: true })).toBeVisible();
  const fresh = await page.evaluate(() => JSON.parse(localStorage.getItem("assurance-vie-session")!));
  expect(fresh.attemptId).not.toBe(stale.attemptId);
  expect(fresh.token).not.toBe(stale.token);
  expect(fresh.fullName).toBe("Nouvel Utilisateur");
  expect(fresh.agency).toBe("Nouvelle Agence");
  expect(fresh.answers).toEqual({});
  expect(fresh.pending).toEqual({});
  expect(new Date(fresh.expiresAt).getTime() - new Date(fresh.serverNow).getTime()).toBeGreaterThan(29 * 60000);
  expect(await page.evaluate(() => sessionStorage.getItem("result-access"))).toBeNull();
  await page.getByRole("radio").first().check();
  await expect(page.getByText("QUESTION 2 / 20", { exact: true })).toBeVisible();
  await expect(page.getByText("Toutes les réponses sont sauvegardées")).toBeVisible();
});

test("Habib chez Finasure consulte son corrigé après soumission et rechargement", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Nom et prénom").fill("Habib");
  await page.getByLabel("Agence / entité").fill("FINASURE");
  await page.getByRole("button", { name: "Commencer l’évaluation" }).click();
  await expect(page.getByRole("radio")).toHaveCount(4);
  await page.getByRole("button", { name: "Terminer l’évaluation", exact: true }).click();
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  await expect(page).toHaveURL(/results/);
  await expect(page.getByRole("heading", { name: "Vos résultats" })).toBeVisible();
  await expect(page.locator("article")).toHaveCount(20);
  await expect(page.getByText("Justification :", { exact: true })).toHaveCount(20);
  await page.reload();
  await expect(page.locator("article")).toHaveCount(20);
});
