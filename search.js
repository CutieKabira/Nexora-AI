// Vercel serverless function: /api/search?q=running+shoes&budget=3000
// Your SerpApi key lives ONLY in the Vercel env variable SERPAPI_KEY.
const BASE = { amazon: 92, flipkart: 90, myntra: 90, ajio: 88, "tata cliq": 88, croma: 90, "reliance digital": 90, nykaa: 90, snapdeal: 75, meesho: 72 };
const NAMES = ["Amazon", "Flipkart", "Myntra", "Ajio", "Croma", "Reliance Digital", "Tata CLiQ", "Nykaa", "Snapdeal", "Meesho"];

function canon(src) {
  const s = String(src || "").toLowerCase().replace("tatacliq", "tata cliq");
  return NAMES.find((n) => s.includes(n.toLowerCase())) || String(src || "Store");
}
function trust(site, rating, reviews) {
  let t = BASE[site.toLowerCase()] ?? 60;
  if (rating) t += Math.max(-9, Math.min(9, (rating - 3.5) * 6));
  if (reviews > 500) t += 3;
  return Math.round(Math.max(20, Math.min(98, t)));
}

module.exports = async (req, res) => {
  const key = process.env.SERPAPI_KEY;
  if (!key) return res.status(500).json({ error: "SERPAPI_KEY is not set in Vercel environment variables." });
  const q = String(req.query.q || "").trim().slice(0, 100);
  const budget = parseInt(req.query.budget, 10);
  if (!q || !budget) return res.status(400).json({ error: "Both q and budget are required." });
  try {
    const u = new URL("https://serpapi.com/search.json");
    Object.entries({ engine: "google_shopping", q, gl: "in", hl: "en", google_domain: "google.co.in", num: "40", api_key: key })
      .forEach(([k, v]) => u.searchParams.set(k, v));
    const r = await fetch(u);
    const data = await r.json();
    if (data.error) return res.status(502).json({ error: "SerpApi: " + data.error });
    const best = new Map(); // one best result per store
    for (const it of data.shopping_results || []) {
      const price = Number(it.extracted_price);
      const link = it.link || it.product_link;
      if (!price || price > budget || !link) continue;
      const site = canon(it.source);
      const row = { site, product: it.title, price, image: it.thumbnail || "", link, rating: it.rating || 0, reviews: it.reviews || 0 };
      row.trust = trust(site, row.rating, row.reviews);
      const old = best.get(site);
      if (!old || row.trust > old.trust || (row.trust === old.trust && row.price < old.price)) best.set(site, row);
    }
    const results = [...best.values()].sort((a, b) => b.trust - a.trust).slice(0, 8);
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate");
    res.status(200).json({ results });
  } catch (e) {
    res.status(500).json({ error: "Search failed. Please try again." });
  }
};
