import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const files = readdirSync("app.parts").filter((f) => f.endsWith(".js")).sort();
if (!files.length) throw new Error("app.parts is empty");
writeFileSync("app.assembled.js", files.map((f) => readFileSync(`app.parts/${f}`, "utf8")).join(""));
console.log("assembled", files.length, "parts -> app.assembled.js");
