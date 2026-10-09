import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const R = require("../rename-item.js");

function itemFixture() {
  return {
    id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    name: "Milk",
    status: "needed",
    agent_state: "in_cart",
    qty: "2",
    notes: "whole",
    category: "Food",
    subsection: "Dairy & Eggs",
    preferred_store_id: "store-1"
  };
}

function mockClient(onUpdate, error) {
  const calls = [];
  return {
    calls,
    from(table) {
      return {
        update(patch) {
          return {
            eq(col, id) {
              const call = { table, patch, col, id };
              calls.push(call);
              if (onUpdate) onUpdate(call);
              return Promise.resolve({ error: error || null });
            }
          };
        }
      };
    }
  };
}

function snapshotFields(row) {
  return {
    id: row.id,
    status: row.status,
    agent_state: row.agent_state,
    qty: row.qty,
    notes: row.notes,
    category: row.category,
    subsection: row.subsection,
    preferred_store_id: row.preferred_store_id
  };
}

const empty = R.prepareRename("Milk", "   ");
assert.equal(empty.ok, false);
assert.equal(empty.reason, "empty");
assert.equal(empty.hint, "Name can't be empty.");

const trimmed = R.prepareRename("Milk", "  Oat milk  ");
assert.equal(trimmed.ok, true);
assert.equal(trimmed.name, "Oat milk");
assert.equal(R.trimName("  Oat milk  "), "Oat milk");

const same = R.prepareRename("Milk", " Milk ");
assert.equal(same.ok, true);
assert.equal(same.unchanged, true);

assert.deepEqual(R.namePatch("Oat milk"), { name: "Oat milk" });
assert.deepEqual(Object.keys(R.namePatch("Oat milk")), ["name"]);

const saved = itemFixture();
const before = snapshotFields(saved);
const client = mockClient();
const result = await R.saveRename(client, saved, "  Oat milk  ");
assert.equal(result.ok, true);
assert.equal(result.id, saved.id);
assert.equal(result.id, before.id);
assert.deepEqual(result.patch, { name: "Oat milk" });
assert.equal(client.calls.length, 1);
assert.equal(client.calls[0].table, "lh_items");
assert.equal(client.calls[0].col, "id");
assert.equal(client.calls[0].id, before.id);
assert.deepEqual(client.calls[0].patch, { name: "Oat milk" });
assert.deepEqual(snapshotFields(saved), before);
assert.equal(saved.name, "Oat milk");

const rejected = itemFixture();
const rejectedBefore = { ...rejected };
const emptyClient = mockClient();
const emptyResult = await R.saveRename(emptyClient, rejected, " \n\t ");
assert.equal(emptyResult.ok, false);
assert.equal(emptyResult.reason, "empty");
assert.equal(emptyClient.calls.length, 0);
assert.deepEqual(rejected, rejectedBefore);

const failed = itemFixture();
const failClient = mockClient(null, { message: "write failed" });
const failResult = await R.saveRename(failClient, failed, "Bread");
assert.equal(failResult.ok, false);
assert.equal(failResult.reason, "save");
assert.equal(failed.name, "Milk");
assert.deepEqual(failClient.calls[0].patch, { name: "Bread" });
assert.equal(failClient.calls[0].id, failed.id);

const enterEditor = R.createEditor();
const enterActions = [];
enterEditor.start();
assert.equal(enterEditor.enter(), "save");
enterActions.push("save");
assert.equal(enterEditor.blur(), "ignore");
assert.deepEqual(enterActions, ["save"]);

const blurEditor = R.createEditor();
const blurActions = [];
blurEditor.start();
assert.equal(blurEditor.blur(), "save");
blurActions.push("save");
assert.equal(blurEditor.blur(), "ignore");
assert.deepEqual(blurActions, ["save"]);

const escapeEditor = R.createEditor();
const escapeActions = [];
escapeEditor.start();
assert.equal(escapeEditor.escape(), "cancel");
escapeActions.push("restore");
assert.equal(escapeEditor.blur(), "ignore");
assert.deepEqual(escapeActions, ["restore"]);
assert.equal(escapeEditor.enter(), "ignore");

const wishHtml = R.nameRowHtml("Grill", true, (s) => s);
assert.match(wishHtml, /aria-label="Rename"/);
assert.match(wishHtml, /class="rename-btn"/);
assert.match(wishHtml, /<div class="item-name">Grill<\/div>/);

const listHtml = R.nameRowHtml("Milk", false, (s) => s);
assert.match(listHtml, /data-act="rename"/);
assert.doesNotMatch(listHtml, /rename-btn/);

console.log("ok rename-item: same id, name-only patch, trim, empty rejected, escape, enter, blur");
