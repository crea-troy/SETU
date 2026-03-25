/**
 * SETU Energy Tracker
 * Shows real environmental impact of saving tokens
 * Makes the invisible visible — CO2 saved per message
 *
 * Based on real data:
 * - GPT-4 query ≈ 0.001-0.01 kWh per query
 * - Average grid: 0.4 kg CO2 per kWh
 * - Output tokens cost 5x more energy than input
 */

const ENERGY = (() => {
  const KEY = "setu_energy_v1";

  // Energy per 1000 tokens (kWh) — output tokens
  const KWH_PER_1K_OUTPUT = {
    "gpt-4":     0.003,
    "gpt-4o":    0.002,
    "chatgpt":   0.002,
    "claude":    0.002,
    "perplexity":0.001,
    "gemini":    0.0015,
    "grok":      0.001,
    "default":   0.002,
  };

  // CO2 kg per kWh (global average grid)
  const CO2_KG_PER_KWH = 0.4;

  // Equivalents for human understanding
  const EQUIVALENTS = [
    { grams: 1,    label: "1g CO2",         icon: "💨" },
    { grams: 5,    label: "charging a phone 30 min", icon: "📱" },
    { grams: 10,   label: "LED bulb on 2 hours",     icon: "💡" },
    { grams: 50,   label: "driving 300 meters",      icon: "🚗" },
    { grams: 100,  label: "driving 600 meters",      icon: "🚗" },
    { grams: 500,  label: "flying 4km",              icon: "✈️" },
    { grams: 1000, label: "driving 6km",             icon: "🚗" },
    { grams: 5000, label: "planting a tree offsets", icon: "🌳" },
  ];

  function kwhFor(tokens, model) {
    const rate = KWH_PER_1K_OUTPUT[model] || KWH_PER_1K_OUTPUT.default;
    return tokens / 1000 * rate;
  }

  function co2grams(kwh) {
    return kwh * CO2_KG_PER_KWH * 1000; // grams
  }

  function getEquivalent(grams) {
    for (let i = EQUIVALENTS.length - 1; i >= 0; i--) {
      if (grams >= EQUIVALENTS[i].grams) return EQUIVALENTS[i];
    }
    return EQUIVALENTS[0];
  }

  function fmtCO2(grams) {
    if (grams < 1)    return (grams * 1000).toFixed(0) + "mg CO₂";
    if (grams < 1000) return grams.toFixed(1) + "g CO₂";
    return (grams/1000).toFixed(2) + "kg CO₂";
  }

  // ── Record energy saved ──────────────────────────
  function record(model, outputTokensSaved) {
    const kwh    = kwhFor(outputTokensSaved, model);
    const grams  = co2grams(kwh);
    const data   = load();
    const today  = new Date().toISOString().slice(0,10);

    data.totalKwh   = (data.totalKwh   || 0) + kwh;
    data.totalGrams = (data.totalGrams || 0) + grams;
    data.totalSaved = (data.totalSaved || 0) + outputTokensSaved;

    if (!data.daily) data.daily = {};
    if (!data.daily[today]) data.daily[today] = {kwh:0,grams:0,tokens:0};
    data.daily[today].kwh    += kwh;
    data.daily[today].grams  += grams;
    data.daily[today].tokens += outputTokensSaved;

    // Keep 30 days
    const keys = Object.keys(data.daily).sort().slice(-30);
    const nd = {}; keys.forEach(k => nd[k] = data.daily[k]);
    data.daily = nd;

    save(data);
    return { kwh, grams, fmtGrams: fmtCO2(grams) };
  }

  // ── Get stats ────────────────────────────────────
  function getStats() {
    const data    = load();
    const today   = new Date().toISOString().slice(0,10);
    const thisM   = new Date().toISOString().slice(0,7);
    const daily   = data.daily || {};
    const tod     = daily[today] || {kwh:0,grams:0,tokens:0};
    let mGrams = 0, mKwh = 0;
    Object.entries(daily).forEach(([k,v]) => {
      if (k.startsWith(thisM)) { mGrams += v.grams||0; mKwh += v.kwh||0; }
    });

    const totalGrams = data.totalGrams || 0;
    const eq = getEquivalent(totalGrams);
    const treeDays = (totalGrams / 21).toFixed(1); // tree absorbs ~21g CO2/day

    return {
      totalKwh:    (data.totalKwh || 0).toFixed(4),
      totalGrams,
      totalFmt:    fmtCO2(totalGrams),
      totalTokens: data.totalSaved || 0,
      equivalent:  eq,
      treeDays,

      todayGrams:  tod.grams || 0,
      todayFmt:    fmtCO2(tod.grams || 0),
      todayKwh:    (tod.kwh || 0).toFixed(5),

      monthGrams:  mGrams,
      monthFmt:    fmtCO2(mGrams),
      monthKwh:    mKwh.toFixed(4),

      // For 1M users projection
      scale1M: {
        gramsPerDay:  (tod.grams * 1000000).toFixed(0),
        kwhPerDay:    (tod.kwh   * 1000000).toFixed(2),
        treesPerMonth:(mGrams * 1000000 / 21 / 30).toFixed(0),
      },
    };
  }

  // ── Preview before sending ───────────────────────
  function preview(outputTokensSaved, model) {
    const kwh   = kwhFor(outputTokensSaved, model);
    const grams = co2grams(kwh);
    const eq    = getEquivalent(grams);
    return {
      grams,
      fmt:   fmtCO2(grams),
      kwh:   kwh.toFixed(5),
      eq,
      message: grams < 0.1
        ? `Saving ${(grams*1000).toFixed(0)}mg CO₂`
        : `Saving ${fmtCO2(grams)} — ${eq.icon} ${eq.label}`,
    };
  }

  function load()  { try { return JSON.parse(localStorage.getItem(KEY)||"{}"); } catch { return {}; } }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }

  return { record, getStats, preview, fmtCO2, getEquivalent };
})();

if (typeof module !== "undefined") module.exports = ENERGY;
