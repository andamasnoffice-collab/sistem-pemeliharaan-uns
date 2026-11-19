import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const functionsSource = await readFile(new URL("../functions/index.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/legacy-main.js", import.meta.url), "utf8");
const htmlSource = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("Admin account-management endpoints require verified primary Admin", () => {
  assert.match(functionsSource, /const PRIMARY_ADMIN_UID = "cCEggFojkdNXlDneD3p3zHdreIg1"/);
  assert.match(functionsSource, /exports\.bootstrapPrimaryAdmin[\s\S]*?request\.auth\.uid !== PRIMARY_ADMIN_UID/);
  assert.match(functionsSource, /function requireAdmin\(request\)[\s\S]*?email_verified !== true/);
  assert.match(functionsSource, /function requirePrimaryAdmin\(request\)[\s\S]*?callerUid !== PRIMARY_ADMIN_UID/);
  for (const endpoint of ["createAdmin", "revokeAdmin", "listAdmins"]) {
    const start = functionsSource.indexOf("exports." + endpoint + " =");
    assert.notEqual(start, -1, endpoint + " endpoint must exist");
    const body = functionsSource.slice(start, functionsSource.indexOf("\n});", start));
    assert.match(body, /requirePrimaryAdmin\(request\)/, endpoint + " must require primary Admin");
  }
});

test("frontend exposes account management only to the confirmed primary Admin UID", () => {
  assert.match(appSource, /isPrimaryAdmin: false/);
  assert.match(appSource, /this\.isPrimaryAdmin = this\.isAdmin && user\.uid === "cCEggFojkdNXlDneD3p3zHdreIg1"/);
  assert.match(appSource, /if \(!this\.isPrimaryAdmin\) return;/);
  assert.match(appSource, /this\.isAdmin = false;\s*this\.isPrimaryAdmin = false;\s*this\.isAdminBootstrapEligible = false;/);
  assert.match(htmlSource, /v-if="isPrimaryAdmin" @click="openAdminManagement"/);
});
