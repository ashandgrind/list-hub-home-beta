/* List Hub two-level categories (section > subsection).
   Works in the browser (window.LHCats) and in Node (module.exports). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LHCats = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SECTIONS = [
    {
      name: "Food",
      emoji: "🍎",
      legacy: "Food",
      subs: [
        { name: "Produce", emoji: "🥬" },
        { name: "Meat & Seafood", emoji: "🥩" },
        { name: "Deli", emoji: "🥪" },
        { name: "Dairy & Eggs", emoji: "🥛" },
        { name: "Bakery & Bread", emoji: "🍞" },
        { name: "Breakfast & Cereal", emoji: "🥣" },
        { name: "Pantry", emoji: "🫙" },
        { name: "Snacks", emoji: "🍪" },
        { name: "Beverages", emoji: "🥤" },
        { name: "Frozen", emoji: "🧊" }
      ]
    },
    {
      name: "Household",
      emoji: "🧻",
      legacy: "Household",
      subs: [
        { name: "Cleaning", emoji: "🧹" },
        { name: "Paper & Plastic", emoji: "🧻" },
        { name: "Laundry", emoji: "🧺" },
        { name: "Kitchen", emoji: "🍳" },
        { name: "Home & Garden", emoji: "🪴" },
        { name: "Tools & Hardware", emoji: "🔧" }
      ]
    },
    {
      name: "Personal Care",
      emoji: "🧴",
      legacy: "Personal care",
      subs: [
        { name: "Health & Medicine", emoji: "💊" },
        { name: "Hygiene", emoji: "🚿" },
        { name: "Beauty", emoji: "💄" },
        { name: "Baby", emoji: "🍼" }
      ]
    },
    { name: "Pets", emoji: "🐾", legacy: "Pets", subs: [] },
    {
      name: "Electronics",
      emoji: "⚡",
      legacy: "Electronics",
      subs: [
        { name: "Computers", emoji: "💻" },
        { name: "Accessories & Cables", emoji: "🔌" },
        { name: "Audio & Video", emoji: "🎧" },
        { name: "Smart Home", emoji: "🏡" }
      ]
    },
    { name: "Outdoor & Sports", emoji: "🚴", legacy: "Hardware", subs: [] },
    { name: "Clothing", emoji: "👕", legacy: "Clothing", subs: [] },
    { name: "Auto", emoji: "🚗", legacy: "Hardware", subs: [] },
    { name: "Other", emoji: "📦", legacy: "Other", subs: [] }
  ];

  var LEGACY_SECTIONS = [
    "Food",
    "Household",
    "Personal care",
    "Health",
    "Electronics",
    "Pets",
    "Baby",
    "Hardware",
    "Clothing",
    "Other"
  ];

  var DEFAULT_SUB = {
    Food: "Pantry",
    Household: "Cleaning",
    "Personal Care": "Hygiene",
    "Personal care": "Hygiene",
    Health: "Health & Medicine",
    Electronics: "Accessories & Cables",
    Pets: "",
    Baby: "Baby",
    Hardware: "Tools & Hardware",
    Clothing: "",
    "Outdoor & Sports": "",
    Auto: "",
    Other: ""
  };

  var SUB_TO_SECTION = {};
  var SECTION_BY_NAME = {};
  var SUB_EMOJI = {};
  SECTIONS.forEach(function (sec) {
    SECTION_BY_NAME[sec.name] = sec;
    SECTION_BY_NAME[sec.name.toLowerCase()] = sec;
    (sec.subs || []).forEach(function (sub) {
      SUB_TO_SECTION[sub.name] = sec.name;
      SUB_TO_SECTION[sub.name.toLowerCase()] = sec.name;
      SUB_EMOJI[sub.name] = sub.emoji;
    });
  });
  SUB_TO_SECTION["Health & Medicine"] = "Personal Care";
  SUB_TO_SECTION.Baby = "Personal Care";
  SUB_TO_SECTION["Tools & Hardware"] = "Household";

  var LEGACY_TO_SECTION = {
    Food: "Food",
    Household: "Household",
    "Personal care": "Personal Care",
    "Personal Care": "Personal Care",
    Health: "Personal Care",
    Electronics: "Electronics",
    Pets: "Pets",
    Baby: "Personal Care",
    Hardware: "Household",
    Clothing: "Clothing",
    Other: "Other",
    Auto: "Auto",
    "Outdoor & Sports": "Outdoor & Sports"
  };

  function norm(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 160);
  }

  function pad(s) {
    return " " + norm(s) + " ";
  }

  /* More specific rules first. Each rule: [section, subsection, regex] */
  var RULES = [
    ["Pets", "", /\b(dog|dogs|puppy|puppies|cat food|cat litter|kitten|kitty|pet|pets|litter|kibble|flea|chew toy|bird ?seed|fish food|aquarium|leash|collar|purina|friskies|meow mix|pedigree|milk-?bone|greenies|temptations|fancy feast|wet food|pet treat)\b/],
    ["Pets", "", /\b(cats?|cat)\b/],

    ["Personal Care", "Baby", /\b(baby|babies|diaper|diapers|wipes|formula|pacifier|infant|toddler|onesie|sippy|pampers|huggies|teether|baby food|nursing)\b/],

    ["Personal Care", "Health & Medicine", /\b(medicine|meds|tylenol|advil|ibuprofen|acetaminophen|aspirin|allergy|claritin|zyrtec|benadryl|vitamins?|multivitamin|band-?aids?|bandages?|first aid|thermometer|cough|nyquil|dayquil|antacid|tums|pepto|prescription|isopropyl|rubbing alcohol|hydrogen peroxide|neosporin|melatonin|probiotic|contact solution|covid test|gauze|mucinex|flonase|eye drops|saline|antibiotic ointment)\b/],
    ["Personal Care", "Beauty", /\b(makeup|mascara|lipstick|lip gloss|foundation|concealer|eyeliner|blush|nail polish|perfume|cologne|moisturizer|sunscreen|face wash|cleanser|serum|toner|hair dye|hair gel|hairspray|dry shampoo|chapstick|lip balm|olay|neutrogena|cerave|loreal|maybelline)\b/],
    ["Personal Care", "Hygiene", /\b(shampoo|conditioner|soap|body wash|toothpaste|toothbrush|floss|mouthwash|deodorant|antiperspirant|razors?|shaving|lotion|tampons?|pads\b|feminine|q-?tips|cotton swabs|cotton balls|hair ties|dove|colgate|crest|gillette|old spice|secret deodorant|degree deodorant|mouthwash|hand soap|bar soap)\b/],

    ["Electronics", "Computers", /\b(pc|laptop|desktop|macbook|imac|chromebook|computer|nvidia|gpu|graphics card|ram\b|ssd\b|motherboard|cpu\b|monitor|webcam|router|nas\b|dgx|thinkpad|keyboard|mouse\b|printer|ink cartridge|toner)\b/],
    ["Electronics", "Audio & Video", /\b(headphones|earbuds|airpods|speaker|soundbar|tv\b|television|roku|fire stick|chromecast|projector|microphone)\b/],
    ["Electronics", "Smart Home", /\b(smart plug|smart bulb|smart home|alexa|echo dot|google nest|thermostat|doorbell cam|security cam|ring cam|hue bulb)\b/],
    ["Electronics", "Accessories & Cables", /\b(batter(y|ies)|aa|aaa|9v|charger|charging|cable|usb|usb-c|lightning cable|phone case|power bank|adapter|sd card|memory card|flash drive|remote|duracell|energizer|extension cord)\b/],

    ["Auto", "", /\b(motor oil|wiper|windshield|antifreeze|coolant|car wash|tire|jumper|brake fluid|transmission fluid|fuel injector|armor all|rain-?x|car battery|auto|automotive)\b/],
    ["Outdoor & Sports", "", /\b(traeger|weber|grill|smoker|camping|tent|sleeping bag|kayak|bike|bicycle|helmet|dumbbell|yoga|soccer|basketball|fishing|tackle|cooler|lawn mower|propane tank)\b/],

    ["Household", "Laundry", /\b(laundry|detergent|fabric softener|dryer sheets|tide|downy|gain detergent|oxiclean|bleach|clothespins|lint roller)\b/],
    ["Household", "Cleaning", /\b(cleaner|lysol|clorox|windex|sponges?|mop|broom|swiffer|vacuum|dish soap|dishwasher|cascade|dawn|febreze|air freshener|magic eraser|disinfectant|scrub|comet|ajax)\b/],
    ["Household", "Paper & Plastic", /\b(paper towels?|toilet paper|tissues?|kleenex|napkins|trash bags?|garbage bags?|aluminum foil|foil|plastic wrap|saran|ziploc|zip-?lock|sandwich bags|storage bags|parchment|wax paper|paper plates|plastic cups|cutlery|bounty|charmin|glad|hefty|solo cups)\b/],
    ["Household", "Kitchen", /\b(light ?bulbs?|trash can|dish rack|cutting board|spatula|tupperware|food storage|mixing bowl|bakeware|pots? and pans|skillet|slow cooker|air fryer|coffee maker|water filter)\b/],
    ["Household", "Home & Garden", /\b(hose|mulch|fertilizer|potting soil|seeds|weed killer|lawn|garden|plant|planter|candle|matches|lighter|air filter|furnace filter|furnace)\b/],
    ["Household", "Tools & Hardware", /\b(screws?|nails|bolts?|drill|hammer|wrench|screwdriver|pliers|tape measure|duct tape|electrical tape|super glue|caulk|paint|primer|sandpaper|wd-?40|zip ties|ladder|hinge|anchors|toolbox)\b/],

    ["Clothing", "", /\b(socks?|shirts?|t-shirts?|tees?|pants|jeans|shorts|underwear|boxers|bras?|dress|skirt|jacket|coat|hoodie|sweater|shoes|sneakers|boots|sandals|slippers|hat|gloves|scarf|belt|pajamas|leggings|swimsuit)\b/],

    ["Food", "Frozen", /\b(frozen|ice cream|popsicle|gelato|eggo|pizza rolls|tater tots|frozen pizza|frozen veggies|frozen fruit|ice pops|popsicles|tv dinner|hot pockets)\b/],
    ["Food", "Pantry", /\b(canned|can of|jarred|jar of)\b/],
    ["Food", "Produce", /\b(banana|bananas|apples?|oranges?|lemons?|limes?|grapes|berries|strawberr(y|ies)|blueberr(y|ies)|raspberr(y|ies)|avocados?|tomato(es)?|potato(es)?|onions?|garlic|lettuce|spinach|kale|carrots?|celery|broccoli|peppers?|cucumbers?|mushrooms?|corn on|fresh corn|salad mix|salad kit|cilantro|parsley|basil|ginger|zucchini|squash|mango|pineapple|watermelon|cantaloupe|peach(es)?|pear|kiwi|cabbage|coleslaw|green onion|scallion|produce|fruit|veggies|vegetables|herbs)\b/],
    ["Food", "Meat & Seafood", /\b(chicken|beef|steak|ground beef|pork|bacon|sausage|ham(?!burger)|turkey|fish|salmon|tuna(?! helper)|shrimp|tofu|meat|wings|ribs|brisket|hot dogs?|franks|cod|tilapia|crab|lobster|ground turkey|chicken breast|chicken thighs)\b/],
    ["Food", "Deli", /\b(deli|lunch meat|sliced ham|sliced turkey|salami|prosciutto|rotisserie|hummus|prepared salad|colby jack slices)\b/],
    ["Food", "Dairy & Eggs", /\b(milk|eggs?|butter|cheese|yogurt|yoghurt|oikos|cream|creamer|half and half|sour cream|cottage cheese|whipping cream|heavy cream|string cheese|cheddar|mozzarella|parmesan|american cheese|cream cheese|almond milk|oat milk|soy milk)\b/],
    ["Food", "Bakery & Bread", /\b(bread|bagels?|tortillas?|buns|muffins?|cake|croissants?|donuts?|doughnuts?|rolls|pita|naan|english muffins?|hot dog buns|hamburger buns|bakery)\b/],
    ["Food", "Breakfast & Cereal", /\b(cereal|oats|oatmeal|granola|fruity pebbles|cheerios|frosted flakes|lucky charms|pancake|waffle|syrup|breakfast|pop tarts?)\b/],
    ["Food", "Frozen", /\b(pizza)\b/],
    ["Food", "Beverages", /\b(juice|coffee|tea|\bwater\b|soda|beer|wine|seltzer|kombucha|gatorade|coke|pepsi|sprite|la croix|k-?cups|espresso|energy drink|sparkling water|bottled water)\b/],
    ["Food", "Snacks", /\b(chips|crackers|cookies|snacks?|nuts|protein bars?|granola bars?|chocolate|candy|gum|popcorn|pretzels|trail mix|fruit snacks|jerky|goldfish)\b/],
    ["Food", "Pantry", /\b(canned|can of|beans|rice|pasta|spaghetti|noodles|flour|sugar|salt|olive oil|cooking oil|vinegar|ketchup|mustard|mayo|mayonnaise|sauce|salsa|peanut butter|jelly|jam|honey|soup|broth|spices?|cinnamon|vanilla|baking|seasoning|ramen|tuna helper|oil(?! change)|condiment|dry goods|pantry)\b/]
  ];

  function matchRules(name) {
    var t = pad(name);
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i][2].test(t)) {
        return { section: RULES[i][0], subsection: RULES[i][1] || "", via: "rule" };
      }
    }
    return null;
  }

  function sectionMeta(name) {
    if (!name) return SECTION_BY_NAME.Other;
    return SECTION_BY_NAME[name] || SECTION_BY_NAME[String(name).toLowerCase()] || null;
  }

  function knownSubsection(name) {
    if (!name) return "";
    if (SUB_TO_SECTION[name]) return name;
    var lower = String(name).toLowerCase();
    for (var key in SUB_TO_SECTION) {
      if (key.toLowerCase() === lower) {
        return key === key.toLowerCase() ? name : key;
      }
    }
    return "";
  }

  function displaySection(legacyOrSection, subsection) {
    var sub = knownSubsection(subsection);
    if (sub && SUB_TO_SECTION[sub]) return SUB_TO_SECTION[sub];
    if (legacyOrSection && LEGACY_TO_SECTION[legacyOrSection]) return LEGACY_TO_SECTION[legacyOrSection];
    if (sectionMeta(legacyOrSection)) return sectionMeta(legacyOrSection).name;
    return "Other";
  }

  function legacySection(section, subsection) {
    var sub = knownSubsection(subsection);
    if (sub === "Baby") return "Baby";
    if (sub === "Health & Medicine") return "Health";
    if (sub === "Tools & Hardware") return "Hardware";
    var sec = displaySection(section, sub);
    if (sec === "Outdoor & Sports" || sec === "Auto") return "Hardware";
    var meta = sectionMeta(sec);
    return (meta && meta.legacy) || (LEGACY_SECTIONS.indexOf(section) >= 0 ? section : "Other");
  }

  function defaultSub(section) {
    var d = DEFAULT_SUB[section];
    return d == null ? "" : d;
  }

  function classify(name, hint) {
    hint = hint || {};
    var fromHint = hint.text ? matchRules(String(hint.text)) : null;
    var fromName = matchRules(name);
    var hit = fromName || fromHint;
    var hintedSection = hint.section || hint.category || "";
    var hintedSub = hint.subsection || "";

    if (hintedSub && knownSubsection(hintedSub)) {
      var sec = displaySection(hintedSection, hintedSub);
      return finish(sec, knownSubsection(hintedSub), hint.source || "hint");
    }

    if (hit) {
      if (hintedSection && LEGACY_TO_SECTION[hintedSection] && LEGACY_TO_SECTION[hintedSection] !== hit.section) {
        /* Name rules win over a coarse barcode/AI section when they disagree
           only if the name is specific; otherwise honor the hinted section. */
        if (!fromName && fromHint) return finish(hit.section, hit.subsection, hint.source || "hint");
      }
      return finish(hit.section, hit.subsection, hint.source || "local");
    }

    if (hintedSection) {
      var mapped = displaySection(hintedSection, "");
      return finish(mapped, defaultSub(mapped === "Personal Care" && hintedSection === "Health" ? "Health" : mapped), hint.source || "local");
    }

    return finish("Other", "", "local");
  }

  function finish(section, subsection, source) {
    section = displaySection(section, subsection);
    subsection = knownSubsection(subsection);
    if (!subsection) subsection = defaultSub(section);
    if (subsection && SUB_TO_SECTION[subsection] && SUB_TO_SECTION[subsection] !== section) {
      section = SUB_TO_SECTION[subsection];
    }
    var unknown = section === "Other" && !subsection;
    return {
      section: section,
      subsection: subsection || "",
      category: legacySection(section, subsection),
      legacy: legacySection(section, subsection),
      source: source || "local",
      unknown: unknown,
      emoji: (sectionMeta(section) || {}).emoji || "📦",
      subEmoji: SUB_EMOJI[subsection] || "",
      label: subsection ? section + " · " + subsection : section,
      chip: subsection || section
    };
  }

  function fromStored(category, subsection, name, opts) {
    opts = opts || {};
    var sub = knownSubsection(subsection);
    if (sub) return finish(displaySection(category, sub), sub, opts.source || "cache");
    if (name) {
      var inferred = classify(name, { section: category });
      if (!category) return inferred;
      var mapped = displaySection(category, "");
      if (inferred.section === mapped) return inferred;
      if (opts.trustSection) return finish(mapped, defaultSub(category === "Health" ? "Health" : mapped), opts.source || "cache");
      return inferred;
    }
    if (category) return finish(displaySection(category, ""), defaultSub(LEGACY_TO_SECTION[category] || category), opts.source || "cache");
    return classify(name || "");
  }

  function fromAI(result, name) {
    if (!result) return classify(name);
    var section = result.section || result.category || "";
    var subsection = result.subsection || "";
    if (subsection) return finish(displaySection(section, subsection), subsection, "ai");
    return classify(name, { section: section, source: "ai", text: result.hint || "" });
  }

  function resolveItem(item, cache) {
    cache = cache || {};
    var key = norm(item && item.name);
    var cached = cache[key];
    var category = (item && item.category) || (cached && (cached.category || cached)) || "";
    var subsection = (item && item.subsection) || (cached && cached.subsection) || "";
    if (typeof cached === "string" && !subsection) {
      /* bootstrap cats is still name -> legacy section string */
      category = category || cached;
    }
    if (item && item.category_source === "user" && subsection) {
      return fromStored(category, subsection, item.name, { trustSection: true, source: "user" });
    }
    if (subsection) return fromStored(category, subsection, item.name);
    return classify(item && item.name, { section: category, source: item && item.category_source });
  }

  function groupItems(items, resolve) {
    resolve = resolve || function (it) {
      return resolveItem(it);
    };
    var buckets = {};
    (items || []).forEach(function (it) {
      var cat = resolve(it);
      var sec = cat.section || "Other";
      var sub = cat.subsection || "";
      if (!buckets[sec]) buckets[sec] = { section: sec, emoji: cat.emoji || "📦", items: [], subs: {} };
      buckets[sec].items.push(it);
      if (!buckets[sec].subs[sub]) buckets[sec].subs[sub] = [];
      buckets[sec].subs[sub].push(it);
    });
    return SECTIONS.filter(function (sec) {
      return buckets[sec.name];
    }).map(function (sec) {
      var b = buckets[sec.name];
      var subList;
      if (!sec.subs.length) {
        subList = [{ name: "", emoji: "", items: b.items }];
      } else {
        subList = sec.subs
          .filter(function (sub) {
            return b.subs[sub.name] && b.subs[sub.name].length;
          })
          .map(function (sub) {
            return { name: sub.name, emoji: sub.emoji, items: b.subs[sub.name] };
          });
        if (b.subs[""] && b.subs[""].length) {
          subList.push({ name: "", emoji: "", items: b.subs[""] });
        }
      }
      return {
        section: sec.name,
        emoji: sec.emoji,
        count: b.items.length,
        items: b.items,
        subs: subList
      };
    });
  }

  function renderGroups(items, renderItem, resolve) {
    return groupItems(items, resolve)
      .map(function (g) {
        var body = g.subs
          .map(function (s) {
            var head = s.name
              ? '<div class="subhead" data-sub="' +
                esc(s.name) +
                '"><span>' +
                (s.emoji ? s.emoji + " " : "") +
                esc(s.name) +
                "</span></div>"
              : "";
            return head + s.items.map(renderItem).join("");
          })
          .join("");
        return (
          '<section class="group" data-section="' +
          esc(g.section) +
          '"><div class="group-title"><span>' +
          g.emoji +
          " " +
          esc(g.section) +
          " · " +
          g.count +
          "</span></div>" +
          body +
          "</section>"
        );
      })
      .join("");
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pickerHtml(selected) {
    selected = selected || {};
    return SECTIONS.map(function (sec) {
      var subs = sec.subs.length ? sec.subs : [{ name: sec.name, emoji: sec.emoji, leaf: true }];
      var buttons = subs
        .map(function (sub) {
          var leaf = sub.leaf ? sec.name : sub.name;
          var on =
            (selected.subsection && selected.subsection === (sub.leaf ? "" : sub.name) && selected.section === sec.name) ||
            (!selected.subsection && selected.section === sec.name && (sub.leaf || sub.name === defaultSub(sec.name)));
          return (
            '<button type="button" class="chip-btn' +
            (on ? " on" : "") +
            '" data-section="' +
            esc(sec.name) +
            '" data-sub="' +
            esc(sub.leaf ? "" : sub.name) +
            '">' +
            (sub.emoji || sec.emoji) +
            " " +
            esc(leaf) +
            "</button>"
          );
        })
        .join("");
      return (
        '<div class="cat-sec"><div class="cat-sec-title">' +
        sec.emoji +
        " " +
        esc(sec.name) +
        "</div><div class=\"cat-grid\">" +
        buttons +
        "</div></div>"
      );
    }).join("");
  }

  function barcodeHint(lookup) {
    lookup = lookup || {};
    var type = String(lookup.type || "");
    var src = String(lookup.source || "");
    var section = null;
    if (type === "food" || /food/.test(src)) section = "Food";
    else if (type === "beauty" || /beauty/.test(src)) section = "Personal Care";
    else if (type === "petfood" || /petfood/.test(src)) section = "Pets";
    var text = [lookup.name, lookup.brand, lookup.categories].filter(Boolean).join(" | ");
    return classify(lookup.name || text, { section: section || "", text: text, source: "barcode" });
  }

  function sortIndex(section, subsection) {
    var si = -1;
    for (var i = 0; i < SECTIONS.length; i++) {
      if (SECTIONS[i].name === section) {
        si = i;
        break;
      }
    }
    if (si < 0) si = SECTIONS.length;
    var subI = 0;
    var sec = SECTIONS[si];
    if (sec && sec.subs && subsection) {
      for (var j = 0; j < sec.subs.length; j++) {
        if (sec.subs[j].name === subsection) {
          subI = j;
          break;
        }
      }
    }
    return si * 100 + subI;
  }

  return {
    SECTIONS: SECTIONS,
    LEGACY_SECTIONS: LEGACY_SECTIONS,
    classify: classify,
    fromStored: fromStored,
    fromAI: fromAI,
    resolveItem: resolveItem,
    groupItems: groupItems,
    renderGroups: renderGroups,
    pickerHtml: pickerHtml,
    barcodeHint: barcodeHint,
    sortIndex: sortIndex,
    displaySection: displaySection,
    legacySection: legacySection,
    knownSubsection: knownSubsection,
    norm: norm
  };
});
