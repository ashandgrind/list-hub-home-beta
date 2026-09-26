import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const C = require("../categories.js");

const expect = [
  ["Eggs", "Food", "Dairy & Eggs"],
  ["Coffee", "Food", "Beverages"],
  ["Cottage cheese", "Food", "Dairy & Eggs"],
  ["Protein bars", "Food", "Snacks"],
  ["Chicken", "Food", "Meat & Seafood"],
  ["Shredded lettuce", "Food", "Produce"],
  ["Oikos yogurt", "Food", "Dairy & Eggs"],
  ["Cold yogurt pouches", "Food", "Dairy & Eggs"],
  ["Fruity Pebbles", "Food", "Breakfast & Cereal"],
  ["Ground beef", "Food", "Meat & Seafood"],
  ["New PC", "Electronics", "Computers"],
  ["NVIDIA DGX Spark", "Electronics", "Computers"],
  ["Traeger Woodbridge elite", "Outdoor & Sports", ""],
  ["Bananas", "Food", "Produce"],
  ["Tide pods", "Household", "Laundry"],
  ["Toilet paper", "Household", "Paper & Plastic"],
  ["Paper towels", "Household", "Paper & Plastic"],
  ["Ibuprofen", "Personal Care", "Health & Medicine"],
  ["Shampoo", "Personal Care", "Hygiene"],
  ["Diapers", "Personal Care", "Baby"],
  ["Cat litter", "Pets", ""],
  ["HDMI cable", "Electronics", "Accessories & Cables"],
  ["Motor oil", "Auto", ""],
  ["Socks", "Clothing", ""],
  ["Ice cream", "Food", "Frozen"],
  ["Frozen pizza", "Food", "Frozen"],
  ["Olive oil", "Food", "Pantry"],
  ["Canned tuna", "Food", "Pantry"]
];

let failed = 0;
for (const [name, section, subsection] of expect) {
  const got = C.classify(name);
  try {
    assert.equal(got.section, section, name + " section");
    assert.equal(got.subsection, subsection, name + " subsection");
  } catch (e) {
    failed++;
    console.error("FAIL", name, "got", got.section, "/", got.subsection, "expected", section, "/", subsection);
  }
}

const grouped = C.groupItems(expect.map(([name], i) => ({ id: String(i), name, category: C.classify(name).category })));
assert.ok(grouped[0] && grouped[0].section === "Food", "Food is first section with items");
assert.equal(grouped[0].subs[0].name, "Produce", "Produce is first food aisle present");
const foodSubs = grouped.find((g) => g.section === "Food").subs.map((s) => s.name);
assert.ok(!foodSubs.includes("Deli"), "empty Deli hidden");
assert.ok(foodSubs.indexOf("Frozen") === -1 || foodSubs.indexOf("Frozen") > foodSubs.indexOf("Produce"), "Frozen after Produce");

const legacyUser = C.resolveItem({ name: "Traeger Woodbridge elite", category: "Household", category_source: "user" });
assert.equal(legacyUser.section, "Outdoor & Sports", "legacy section-only user tag can move to a better new section");
const user = C.resolveItem({ name: "Traeger Woodbridge elite", category: "Household", subsection: "Home & Garden", category_source: "user" });
assert.equal(user.section, "Household", "explicit aisle correction is kept");
assert.equal(user.subsection, "Home & Garden", "explicit aisle correction is kept");

const html = C.renderGroups(
  [{ id: "1", name: "Eggs" }, { id: "2", name: "Chicken" }],
  (it) => '<article class="item" data-id="' + it.id + '">' + it.name + "</article>"
);
assert.match(html, /data-section="Food"/);
assert.match(html, /data-sub="Dairy &amp; Eggs"/);
assert.match(html, /data-sub="Meat &amp; Seafood"/);

if (failed) {
  console.error(failed + " classifier failures");
  process.exit(1);
}
console.log("ok", expect.length, "classifier cases + grouping");
