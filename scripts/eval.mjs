import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.EVAL_BASE_URL || "http://localhost:3000";

function normalise(s) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreContains(answer, expected) {
  const a = normalise(answer);
  const e = normalise(expected);

  // Very rough: require that at least half of the expected words appear in the answer.
  const words = Array.from(new Set(e.split(" ").filter((w) => w.length >= 4)));
  if (words.length === 0) return 0;

  const hits = words.filter((w) => a.includes(w)).length;
  return hits / words.length;
}

async function main() {
  const samplePath = path.join(process.cwd(), "sample", "track-b-spec.md");
  const goldPath = path.join(process.cwd(), "eval", "gold.json");

  const text = fs.readFileSync(samplePath, "utf-8");
  const gold = JSON.parse(fs.readFileSync(goldPath, "utf-8"));

  console.log(`Ingesting sample doc via ${BASE_URL}...`);

  const ingestResp = await fetch(`${BASE_URL}/api/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Track B Spec",
      source: "sample",
      text,
      mode: "replace"
    })
  });

  const ingest = await ingestResp.json();
  if (!ingestResp.ok || !ingest.ok) {
    console.error("Ingest failed:", ingest);
    process.exit(1);
  }

  const docId = ingest.docId;
  console.log(`Doc ID: ${docId}`);
  console.log("");

  let pass = 0;

  for (let i = 0; i < gold.length; i++) {
    const { q, expected } = gold[i];
    const r = await fetch(`${BASE_URL}/api/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: q, docId })
    });
    const data = await r.json();

    const ans = data.answer || "";
    const s = scoreContains(ans, expected);
    const ok = s >= 0.5 && !data.noAnswer;

    if (ok) pass += 1;

    console.log(`Q${i + 1}: ${q}`);
    console.log(`Expected: ${expected}`);
    console.log(`Answer: ${ans.replace(/\n+/g, "\n")}`);
    console.log(`Score (rough): ${(s * 100).toFixed(0)}% -> ${ok ? "PASS" : "FAIL"}`);
    console.log("—".repeat(80));
  }

  console.log(`\nSummary: ${pass}/${gold.length} passed (rough keyword heuristic).`);
  console.log("Note: This is a very approximate automated check; manual review is still recommended.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
