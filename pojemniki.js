"use strict";
// Pojemniki gridfinity (zakładka „Pojemniki gridfinity”): układy pojemników w siatce płyty konkretnej szuflady albo
// skrzynki (etap 2), parametry pojemnika, podgląd 3D całego układu, pliki STL / ZIP.
// Bryły liczy serwer (pojemniki.py, manifold3d), podgląd rysuje renderer okna 3D (vizRenderer z wizualizacja.js).
// Układ = pojemniki jednej szuflady albo skrzynki. Od 2026-11-01 (prośba użytkownika: „poziomy się mieszają, chciałbym
// projektować każdy poziom osobno”) każdy egzemplarz z projektu ma własny układ: klucz „i:<zestaw>:<warstwa>:<kolumna>:<front>”
// (id zestawu i warstwy, kolumna w układzie warstwy – np. lewa i prawa S w 2×S, front od góry; skrzynka – front 0),
// cel (rodzina, głębokość, wysokość, płyta) zawsze z projektu, ilość = ilość zestawu (off = pominięty). Układy spoza
// projektu: klucz „m:<n>”, cel i ilość (qty) ręcznie. Zapisywane z projektem: state.binSets [{ key, t, items, qty?, off? }],
// state.binCur (klucz), state.binVer = 2, state.bin (wzór nowych pojemników). items: [{ x, y, w, d, p }] – x, y kratka
// lewego przedniego rogu (y = 0 przy froncie), w × d rozmiar w kratkach, p parametry. Na liście części pojemnik to plik
// „@gridfinity/<nazwa>.stl” z parametrami (gen); druk.py generuje go przy przygotowaniu wydruku, okno 3D stawia pojemniki
// na płycie w szufladzie (binVizParts).
// Globalne z głównego skryptu (state, el, tr, num, chk, sel, save, LANG, SERVER, PRINT, FAMILIES, fmtTime, fmtG,
// locale) są używane dopiero przy rysowaniu zakładki.

const BIN_DEFAULT = { h: 3, nx: 1, ny: 1, rant: true, etykieta: "tyl", uchwyt: true, magnesy: false, lekkie: true };
// Kratki płyt (pomiar plików 2026-11-01): szuflady S 3 (płyta z uchwytami 2), M 5 (z 2 uchwytami 4), L 6, XL 8;
// skrzynki S 3, M 5, L 7, XL 9 – zawsze × głębokość.
const BIN_COLS = { d: { S: 3, M: 5, L: 6, XL: 8 }, s: { S: 3, M: 5, L: 7, XL: 9 } };
// Miejsce na pojemnik nad dnem (mm): pudełka szuflad 37,5/85,5/181,5 − dno 3 (pomiar 2026-11-05; wcześniej przyjęte 2 –
// 2F dawało 11 zamiast 10 jednostek, decyzja użytkownika „Tak, popraw”; pełna przegródka USSA 1F ma 34,5); skrzynki – krawędź modułu
// 50,8/84,8/180,8 − dno 9,8 − kołnierz wieka 7 (wnętrze wieka niezmierzone – z zapasem). Jak pojemniki.py:
// pojemnik leży 0,65 mm nad dnem, luz 0,5 mm, rant 4,4 mm, jednostka 7 mm.
const BIN_ROOM = { d: { 1: 34.5, 2: 82.5, 4: 178.5 }, s: { 1: 34, 2: 68, 4: 164 } };
const BIN_CELL = 36;  // px na kratkę w edytorze
const BIN_SERVER_VER = 11;  // potrzebna wersja generatora na serwerze (pojemniki.WERSJA)

const BIN = { canvas: null, R: null, cache: new Map(), sel: -1, pick: null, fitKey: "", err: "",
  cam: { yaw: 0.62, pitch: 0.6, dist: 600 }, drag: null, box: null };

// ---------- cel (szuflada / skrzynka) ----------
function binTargetFix(t) {
  t = Object.assign({ typ: "d", fam: "S", d: 4, h: 1, plyta: "grid" }, t || {});
  if (!["d", "s"].includes(t.typ)) t.typ = "d";
  if (!BIN_COLS.d[t.fam]) t.fam = "S";
  t.d = Math.max(3, Math.min(7, parseInt(t.d) || 4));
  t.h = [1, 2, 4].includes(+t.h) ? +t.h : 1;
  if (t.fam === "XL") t.h = 1;  // XL tylko 1F
  const plyty = binPlates(t).map(([v]) => v);
  if (!plyty.includes(t.plyta)) t.plyta = plyty[0];
  return t;
}
function binPlates(t) {
  if (t.typ === "s") return [["grid", tr("płyta skrzynki")]];
  if (t.fam === "S") return [["grid", tr("zwykła płyta")], ["grid1", tr("płyta z 1 uchwytem")], ["grid2", tr("płyta z 2 uchwytami")]];
  if (t.fam === "M") return [["grid", tr("zwykła płyta")], ["grid2", tr("płyta z 2 uchwytami")]];
  return [["grid2", tr("płyta z uchwytami")]];
}
const binGridSize = t => [t.typ === "d" && t.plyta !== "grid" && (t.fam === "S" || t.fam === "M") ? BIN_COLS.d[t.fam] - 1 : BIN_COLS[t.typ][t.fam], t.d];
const binCeil = t => BIN_ROOM[t.typ][t.h] - 0.5;  // najwyżej tu może sięgać wierzch pojemnika (mm nad dnem)
const binSeat = t => t.seat == null ? 0.65 : t.seat;  // spód pojemnika nad dnem: płyta USSA 0,65, generowana 0 / 3 (magnesy)
const binMaxH = (t, rant) => Math.floor((binCeil(t) - binSeat(t) - (rant ? 4.4 : 0)) / 7);
// obrys płyty USSA szuflady / skrzynki (pomiar plików 2026-11-01; XL szuflady – z bryły obróconego pliku) – taki ma też
// płyta generowana: szuflady 42·d + 8 (XL + 9), skrzynki 42·d + 14,9
const BIN_PLATE = { d: { S: 125.8, M: 214.7, L: 290.4, XL: 361 }, s: { S: 154.8, M: 244, L: 318.7, XL: 408.4 } };
const binPlateSize = t => [BIN_PLATE[t.typ][t.fam], Math.round((42 * t.d + (t.typ === "s" ? 14.9 : t.fam === "XL" ? 9 : 8)) * 10) / 10];
// płyta generowana układu własnego w częściach mieszczących się na stole drukarki z „Przygotuj wydruk” (cięcia po kratkach)
function binPlateParts(set, whole) {
  const t = set.t, [c, r] = binGridSize(t), [sx, sy] = binPlateSize(t);
  const bed = (state.job && state.job.bed) || [256, 256], lim = Math.max(80, Math.min(bed[0], bed[1]) - 10);
  const px = whole ? 1 : Math.min(c, Math.ceil(sx / lim)), py = whole ? 1 : Math.min(r, Math.ceil(sy / lim));
  const out = [];
  for (let iy = 0; iy < py; iy++) for (let ix = 0; ix < px; ix++) out.push({ typ: "plyta", c, r, sx, sy, magnesy: !!set.plateMag, px, py, ix, iy });
  return out;
}
const binTargetLabel = t => tr(t.typ === "d" ? "szuflada {fam}{d} {h}F" : "skrzynka {fam}{d} {h}F", { fam: t.fam, d: t.d, h: t.h }) +
  (t.typ === "d" && t.plyta !== "grid" && (t.fam === "S" || t.fam === "M") ? ", " + binPlates(t).find(([v]) => v === t.plyta)[1] : "");
const binTargetKey = t => [t.typ, t.fam, t.d, t.h, t.plyta].join("|");

// szuflady z wkładem gridfinity i skrzynki z płytą w projekcie (ilość = zestawy × ich liczba)
function binProjectTargets() {
  const m = new Map();
  for (const st of state.stacks) for (const l of st.layers) l.cols.forEach((c, k) => {
    const fam = FAMILIES[l.layout][k];
    const add = t => { t = binTargetFix(t); const key = binTargetKey(t); const e = m.get(key) || { t, qty: 0 }; e.qty += st.qty; m.set(key, e); };
    if (l.type === "D") c.pattern.forEach((h, k) => { if (insGrid(insOf(c, k))) add({ typ: "d", fam, d: st.depth, h, plyta: insOf(c, k) }); });
    if (l.type !== "D" && c.grid) add({ typ: "s", fam, d: st.depth, h: l.height });
  });
  return [...m.values()];
}

// ---------- egzemplarze z projektu i układy ----------
const binKey = (st, l, ci, k) => `i:${st.id}:${l.id}:${ci}:${k}`;
// każda szuflada z wkładem gridfinity (każdy front modułu osobno) i każda skrzynka z płytą – w każdej warstwie i kolumnie
function binInstances() {
  const out = [];
  for (const st of state.stacks) st.layers.forEach((l, li) => l.cols.forEach((c, ci) => {
    const fam = FAMILIES[l.layout][ci], side = l.cols.length > 1 ? (ci === 0 ? tr("lewa") : tr("prawa")) : "";
    const where = [st.name, li === 0 ? tr("Warstwa 1 (spód)") : tr("Warstwa {n}", { n: li + 1 })];
    const add = (k, t, extra) => {
      t = binTargetFix(t);
      out.push({ key: binKey(st, l, ci, k), t, qty: st.qty, label: [...where, [binTargetLabel(t), side, extra].filter(Boolean).join(", ")].join(" · ") });
    };
    if (l.type === "D")
      c.pattern.forEach((h, k) => insGrid(insOf(c, k)) && add(k, { typ: "d", fam, d: st.depth, h, plyta: insOf(c, k) }, c.pattern.length > 1 ? tr("szuflada {k} od góry", { k: k + 1 }) : ""));
    if (l.type !== "D" && c.grid) add(0, { typ: "s", fam, d: st.depth, h: l.height }, "");
  }));
  return out;
}
// projekty sprzed podziału na egzemplarze: układ miał cel (wszystkie takie szuflady) i nazwę – trafia do każdej szuflady
// tego celu w projekcie, a gdy jej nie ma – staje się układem własnym. Pojemniki spoza siatki celu (cel zmieniany po
// zaprojektowaniu – zgłoszenie użytkownika) przenosi do celu z projektu, w którego siatce mieszczą się wszystkie.
function binMigrate() {
  const old = (state.binSets || []).filter(s => !s.key);
  state.binSets = (state.binSets || []).filter(s => s.key);
  const inst = binInstances(), targets = binProjectTargets();
  for (const s of old) {
    const items = Array.isArray(s.items) ? s.items : [];
    let t = binTargetFix(s.t);
    if (!items.every(it => binInside(it, t))) { const f = targets.find(x => items.every(it => binInside(it, x.t))); if (f) t = f.t; }
    const match = s.qty === "none" ? [] : inst.filter(i => binTargetKey(i.t) === binTargetKey(t) && !state.binSets.some(x => x.key === i.key));
    if (match.length) for (const i of match) state.binSets.push({ key: i.key, t: i.t, items: JSON.parse(JSON.stringify(items)) });
    else if (items.length) {
      const m = state.binSets.find(x => x.key === binNewManual(t));
      m.items = items; m.qty = typeof s.qty === "number" ? s.qty : s.qty === "none" ? 0 : 1;
    }
  }
  state.binVer = 2;
  if (typeof state.binCur !== "string") state.binCur = null;
}
function binNewManual(t) {
  let n = 1;
  while (state.binSets.some(s => s.key === "m:" + n)) n++;
  state.binSets.push({ key: "m:" + n, t: binTargetFix(t), qty: 1, items: [] });
  return "m:" + n;
}
function binSets() {
  state.bin = Object.assign({ ...BIN_DEFAULT }, state.bin || {});
  if (!Array.isArray(state.binSets)) state.binSets = [];
  if (state.binVer !== 2) binMigrate();
  const inst = new Map(binInstances().map(i => [i.key, i]));
  for (const s of state.binSets) {
    s.items = Array.isArray(s.items) ? s.items : [];
    const i = inst.get(s.key);
    s.t = binTargetFix(i ? i.t : s.t);  // egzemplarz: cel zawsze z projektu (zmiana frontów, wkładu, głębokości)
    // układ własny z płytą generowaną: kratki jak zwykła płyta, pojemniki stoją niżej (0 mm) albo na dnie z magnesami (3 mm)
    if (!i && s.plate === "gen") { s.t.plyta = binPlates(s.t)[0][0]; s.t.seat = s.plateMag ? 3 : 0; }
    else delete s.t.seat;
    if (!i && s.plate !== "ussa") s.t.noUssa = true; else delete s.t.noUssa;
  }
  const keys = [...inst.keys(), ...state.binSets.map(s => s.key)];
  if (!keys.includes(state.binCur)) state.binCur = keys[0] || binNewManual();
  return state.binSets;
}
// układ egzemplarza powstaje przy pierwszym otwarciu
function binSet() {
  let s = state.binSets.find(x => x.key === state.binCur);
  if (!s) {
    const i = binInstances().find(x => x.key === state.binCur);
    s = { key: state.binCur, t: i ? i.t : binTargetFix(), items: [] };
    state.binSets.push(s);
  }
  return s;
}
function binSetLabel(s, inst) {
  const i = inst.get(s.key);
  if (i) return i.label;
  return s.key.startsWith("m:") ? tr("własny układ: {t}", { t: binTargetLabel(s.t) }) : tr("(usunięta z projektu) {t}", { t: binTargetLabel(s.t) });
}
// przycisk przy szufladzie / skrzynce w edytorze zestawu: liczba pojemników i przejście do jej układu
function binButton(st, l, ci, k) {
  if (Array.isArray(state.binSets) && state.binVer !== 2) binMigrate();
  const key = binKey(st, l, ci, k), s = (state.binSets || []).find(x => x.key === key), n = s ? s.items.length : 0;
  return el("button", { class: "small", title: tr("Zaprojektuj pojemniki gridfinity dla tej szuflady ({n} szt.)", { n }), onclick: () => {
    state.binCur = key; state.tab = "bins"; BIN.sel = -1; update();
    const r = document.getElementById("result");
    if (r) r.scrollIntoView({ behavior: "smooth", block: "start" });
  } }, "✎ " + n);
}
// kopia warstwy / zestawu: układy kopiowanych egzemplarzy (klucze „i:<zestaw>:<warstwa>:” → nowe id)
function binCopyLayouts(from, to) {
  if (!Array.isArray(state.binSets)) return;
  for (const s of [...state.binSets]) if (s.key && s.key.startsWith(from) && s.items.length)
    state.binSets.push({ ...JSON.parse(JSON.stringify(s)), key: to + s.key.slice(from.length) });
}
// napisy na półkach (pojemniki.py – _parametry_pojemnika, 2026-11-03): [{ t, s }] dla przegródki k = j·nx + i (j = 0 – przedni
// rząd); jak w Pythonie: do nx·ny przegródek, tekst do 40 znaków, nieznany symbol – bez, puste na końcu usunięte
function binNapisy(p) {
  if (p.etykieta === "brak" || !Array.isArray(p.napisy)) return [];
  const n = p.napisy.slice(0, (p.nx || 1) * (p.ny || 1)).map(x => ({ t: String((x && x.t) || "").slice(0, 40),
    s: x && x.s && (typeof labSymKnown !== "function" || labSymKnown(x.s)) ? x.s : "" }));
  while (n.length && !n[n.length - 1].t.trim() && !n[n.length - 1].s) n.pop();
  return n;
}
const binFull = it => { const p = { ...it.p, w: it.w, d: it.d }; p.napisy = binNapisy(p); return p; };
// Płyty USSA skrzynek M i L (pomiar wszystkich plików 2026-11-01; XL przez analogię – pliki pod kątem, niezmierzone) nie
// mają kieszeni na środku przedniego rzędu (pole zabudowane z wycięciem na palec przy krawędzi) – zgłoszenie użytkownika:
// pojemnik na tym polu wchodził w płytę. Płyty S i wszystkie płyty szuflad mają komplet kieszeni.
const binBlocked = t => t.typ === "s" && t.fam !== "S" && !t.noUssa ? [[(BIN_COLS.s[t.fam] - 1) / 2, 0]] : [];
const binHitsBlocked = (x, y, w, d, t) => binBlocked(t).some(([bx, by]) => bx >= x && bx < x + w && by >= y && by < y + d);
const binInside = (it, t) => { const [c, r] = binGridSize(t); return it.x >= 0 && it.y >= 0 && it.x + it.w <= c && it.y + it.d <= r && !binHitsBlocked(it.x, it.y, it.w, it.d, t); };
// czy prostokąt kratek jest wolny (pomijając pojemnik nr skip)
function binFree(set, x, y, w, d, skip = -1) {
  const [c, r] = binGridSize(set.t);
  if (x < 0 || y < 0 || x + w > c || y + d > r || binHitsBlocked(x, y, w, d, set.t)) return false;
  return set.items.every((it, i) => i === skip || it.x >= x + w || it.x + it.w <= x || it.y >= y + d || it.y + it.d <= y);
}
function binAdd(set, x, y, w, d) {
  // świeży projekt: wzór pojemnika jeszcze nieustawiony (ustawia go dopiero zakładka pojemników)
  const q = state.bin = Object.assign({ ...BIN_DEFAULT }, state.bin || {}), p = { h: Math.min(q.h, binMaxH(set.t, q.rant)), nx: Math.min(q.nx, 4 * w), ny: Math.min(q.ny, 4 * d),
    rant: q.rant, etykieta: q.etykieta, uchwyt: q.uchwyt, magnesy: q.magnesy, lekkie: q.lekkie !== false };
  set.items.push({ x, y, w, d, p });
  return set.items.length - 1;
}

// ---------- lista części, szacunek, okno 3D ----------
const BIN_FILE = "@gridfinity/";
const BIN_GEN = new Map();   // plik „@gridfinity/…” → parametry (lista części, okno 3D)
const BIN_META = new Map();  // plik → opis z serwera (cm³, cm² – szacunek czasu i filamentu)
const BIN_ASK = new Set();
let BIN_ASK_T = 0;
// nazwa jak pojemniki.nazwa() w Pythonie (ta sama nazwa pliku w ZIP-ie, w liście części i w folderze stl/)
function binName(p) {
  if (p.typ === "plyta") {
    let n = `gridfinity_plyta_${p.c}x${p.r}_${Math.round(p.sx * 10) / 10}x${Math.round(p.sy * 10) / 10}`;
    if (p.magnesy) n += "_magnesy";
    if (p.px * p.py > 1) n += `_czesc_${p.iy * p.px + p.ix + 1}z${p.px * p.py}`;
    return n;
  }
  let n = `gridfinity_${p.w}x${p.d}x${p.h}`;
  if (p.nx * p.ny > 1) n += `_przegr_${p.nx}x${p.ny}`;
  n += { tyl: "_etykieta", przod: "_etykieta_przod", brak: "" }[p.etykieta] || "";
  if (p.uchwyt) n += "_uchwyt";
  if (!p.rant) n += "_bez_rantu";
  if (p.magnesy) n += "_magnesy";
  if (p.lekkie === false && !p.magnesy) n += "_pelne_dno";  // brak pola (starsze układy) = lekkie, jak w pojemniki.py
  const nap = binNapisy(p), wkl = p.styl_napisu === "wklesly";
  if (nap.length && typeof labFnv === "function")  // skrót z treści – jak pojemniki._nazwa_pojemnika
    n += (wkl ? "_napis_wkl_" : "_napis_") + labFnv(nap.map(x => `${x.t}~${x.s}`).join("|") + "|" + (wkl ? "wklesly" : "wpuszczony")).slice(0, 6);
  return n;
}
const binFileOf = p => { const f = BIN_FILE + binName(p) + ".stl"; BIN_GEN.set(f, p); return f; };
// plik płyty USSA dla celu (jak addDrawer: zwykła / z uchwytami, brak wariantu → zwykła; skrzynka – Universal/Baseplates)
function binUssaPlateRx(t) {
  const w = t.fam.toLowerCase(), d = t.d;
  if (t.typ === "s") return R`^02\. sustainers/05\. universal/baseplates/[^/]+/${w}${d}( part \d)?( gridfinity)? baseplate\.stl$`;
  const base = R`^01\. drawers/[^/]+/${w}${d}/gridfinity baseplate/${w}${d} baseplate( part \d)?\.stl$`;
  const rx = t.plyta === "grid2" ? R`^01\. drawers/[^/]+/${w}${d}/gridfinity baseplate/${w}${d} (baseplate_with 2 handles|gridfinity baseplate 2_handles)\.stl$`
    : t.plyta === "grid1" ? R`^01\. drawers/[^/]+/${w}${d}/gridfinity baseplate/${w}${d} baseplate_with 1 handle\.stl$` : base;
  return rx !== base && !findAll(rx).length ? base : rx;
}
// egzemplarze z projektu – ilość zestawu (bez „off”), układy własne – qty; szuflady usunięte z projektu – pomijane
function binAddToBom(b) {
  if (!Array.isArray(state.binSets) || !state.binSets.length) return;
  if (state.binVer !== 2) binMigrate();
  const inst = new Map(binInstances().map(i => [i.key, i]));
  for (const s of state.binSets) {
    const i = inst.get(s.key), manual = (s.key || "").startsWith("m:");
    if (!i && !manual) continue;
    const t = i ? i.t : binTargetFix(s.t), n = i ? (s.off ? 0 : i.qty) : (+s.qty || 0);
    if (!n) continue;
    const label = binSetLabel(s, inst);
    for (const it of s.items || []) if (binInside(it, t)) {
      const p = binFull(it);
      b.addGen("Pojemniki gridfinity", label, binFileOf(p), n, p);
    }
    // układ własny: płyta pod pojemniki (prośba użytkownika 2026-11-01) – USSA z biblioteki albo generowana
    if (manual && s.plate === "ussa")
      b.add("Wkłady", t.typ === "s" ? "{fam}{d} baseplate gridfinity (skrzynka)" : "{fam}{d} baseplate gridfinity", binUssaPlateRx(t), n, { all: true, v: { fam: t.fam, d: t.d } });
    if (manual && s.plate === "gen") for (const p of binPlateParts(s)) b.addGen("Pojemniki gridfinity", label, binFileOf(p), n, p);
  }
}

// szacunek jak dla części bez danych z arkusza: model z cm³ i cm² (dane_druku.js); opis z serwera – w tle, potem
// przerysowanie wyniku
function binEstimate(file) {
  const m = BIN_META.get(file);
  if (!m) { binAskMeta(file); return null; }
  const M = PRINT.model;
  return { sec: M.t[0] * m.cm3 + M.t[1] * m.cm2, g: M.g[0] * m.cm3 + M.g[1] * m.cm2, src: "geom" };
}
function binAskMeta(file) {
  if (BIN_ASK.has(file) || !BIN_GEN.has(file) || !SERVER.ok || !SERVER.pojemniki) return;
  BIN_ASK.add(file);
  clearTimeout(BIN_ASK_T);
  BIN_ASK_T = setTimeout(async () => {
    const files = [...BIN_ASK].filter(f => !BIN_META.has(f));
    if (!files.length) return;
    try {
      const r = await api("/api/pojemnik/meta", { bins: files.map(f => BIN_GEN.get(f)) });
      r.meta.forEach((m, i) => BIN_META.set(files[i], m));
      renderResult();
    } catch (e) { files.forEach(f => BIN_ASK.delete(f)); console.warn("pojemniki – opis", e); }
  }, 100);
}

// Środek siatki kieszeni płyty USSA szuflady względem środka płyty [x w prawo, z do przodu] (mm). Pomiar przekrojem płyt
// S3–S6, M3–M4, L4–L6 (2026-11-03, zgłoszenie użytkownika ze zrzutem: pojemniki obok kieszeni płyty S4 z 1 uchwytem):
// kieszenie 2 mm od tylnej krawędzi i 6 mm od przedniej (−2 w z); płyta S z 1 uchwytem to zwykła siatka bez ostatniej
// kolumny – uchwyt przy X max pliku (z prawej), kieszenie przesunięte o pół kratki w lewo. XL i skrzynki – osobno.
const binGridOff = t => t.typ !== "d" || t.fam === "XL" ? [0, 0] : [t.fam === "S" && t.plyta === "grid1" ? -21.1 : 0, -2];

// okno 3D: pojemniki układu egzemplarza key (cel t z projektu) na płycie – środek płyty (cx, zc; szuflady S/M/L – kieszenie
// przesunięte o binGridOff), spód płyty y0 (pojemnik 0,65 mm wyżej, na fazkach kieszeni), xf – wysunięcie szuflady
function binVizParts(S, key, t, cx, y0, zc, xf, col) {
  if (zc == null || !Array.isArray(state.binSets)) return;
  if (state.binVer !== 2) binMigrate();
  t = binTargetFix(t);
  const set = state.binSets.find(s => s.key === key);
  if (!set || set.off || !set.items.length) return;
  const [ogx, ogz] = binGridOff(t);
  cx += ogx; zc += ogz;
  const [gc, gr] = binGridSize(t), X0 = cx - gc * 21, Z1 = zc + gr * 21, d = xf && xf.t ? xf.t : [0, 0, 0];
  for (const it of set.items) {
    if (!binInside(it, t)) continue;
    const e = vizStlGet(binFileOf(binFull(it)));
    if (e.status !== "ok") continue;
    const tx = X0 + (it.x + it.w / 2) * 42 + d[0], ty = y0 + 0.65 + d[1], tz = Z1 - (it.y + it.d / 2) * 42 + d[2];
    const M = new Float32Array([1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, tx, ty, tz, 1]);
    S.parts.push({ e, M, col });
    if (e.text) S.parts.push({ e: e.text, M, col: binTextCol() });
  }
}

// ---------- podgląd 3D ----------
function binView() {
  if (BIN.canvas) return BIN.canvas;
  const c = BIN.canvas = el("canvas", { class: "bin-canvas" });
  const gl = c.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
  try { if (gl) BIN.R = vizRenderer(gl); } catch (e) { console.error(e); }
  // lewy przycisk – obrót, prawy (i środkowy) – przesuwanie (jak w oknie 3D, vizPan); dwuklik – widok od nowa
  c.addEventListener("contextmenu", e => e.preventDefault());
  c.addEventListener("pointerdown", e => { BIN.drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.button === 1 }; c.setPointerCapture(e.pointerId); });
  c.addEventListener("pointermove", e => {
    if (BIN.drag && !e.buttons) BIN.drag = null;  // przycisk puszczony bez pointerup (prawy – menu kontekstowe)
    if (!BIN.drag) return;
    const dx = e.clientX - BIN.drag.x, dy = e.clientY - BIN.drag.y;
    if (BIN.drag.pan) {
      BIN.pan = vAdd(BIN.pan || [0, 0, 0], vizPan(BIN.cam, dx, dy, c.clientHeight));
      if (BIN.base) BIN.look = vAdd(BIN.base, BIN.pan);
    } else {
      BIN.cam.yaw -= dx * 0.008;
      BIN.cam.pitch = Math.max(-1.3, Math.min(1.5, BIN.cam.pitch + dy * 0.006));
    }
    BIN.drag.x = e.clientX; BIN.drag.y = e.clientY;
    binDraw();
  });
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) c.addEventListener(t, () => { BIN.drag = null; });
  c.addEventListener("wheel", e => { e.preventDefault(); BIN.cam.dist = Math.max(60, Math.min(4000, BIN.cam.dist * Math.exp(e.deltaY * 0.0012))); binDraw(); }, { passive: false });
  c.addEventListener("dblclick", () => { BIN.cam.yaw = 0.62; BIN.cam.pitch = 0.6; BIN.fitKey = ""; binRefresh(); });
  new ResizeObserver(() => binDraw()).observe(c);
  return c;
}

// siatka pojemnika z serwera (pamięć po pełnych parametrach); po wczytaniu – przebudowa sceny
function binMesh(p) {
  const key = JSON.stringify(p);
  let e = BIN.cache.get(key);
  if (e) return e;
  e = { status: "loading" };
  BIN.cache.set(key, e);
  fetch("/api/pojemnik", { method: "POST", headers: { "X-Lang": LANG, "Content-Type": "application/json" }, body: JSON.stringify(p) })
    .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText); return r.arrayBuffer(); })
    .then(buf => {
      const h = new DataView(buf), nv = h.getUint32(4, true), nt = h.getUint32(8, true), nm = h.getUint32(12, true);
      e.meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 16, nm)));
      BIN_META.set(binFileOf(p), e.meta);
      e.mesh = { pos: new Float32Array(buf, 16 + nm, nv * 3), idx: new Uint32Array(buf, 16 + nm + nv * 12, nt * 3) };
      binSplitText(e.mesh, e.meta, e);
      e.status = "ok";
    })
    .catch(err => { e.status = "err"; BIN.err = err.message; })
    .finally(() => binRefresh());
  return e;
}

// litery napisu wpuszczonego (meta.text = [wierzchołki, trójkąty] pojemnika; dalej litery z indeksami od 0) – osobna
// siatka `out.text`, rysowana kolorem napisu (state.labelTextColor, jak w 3MF); wspólne z oknem 3D (vizStlGet)
function binSplitText(m, meta, out) {
  if (!meta || !Array.isArray(meta.text)) return;
  const [nv, nt] = meta.text;
  out.text = { pos: m.pos.subarray(nv * 3), idx: m.idx.subarray(nt * 3), status: "ok", meta: {} };
  m.pos = m.pos.subarray(0, nv * 3);
  m.idx = m.idx.subarray(0, nt * 3);
}
const binTextCol = () => vHex(state.labelTextColor || "#000000");

// układ w oknie 3D: X w prawo, Z pliku w górę, front szuflady do patrzącego (+z); krawędzie kratek na liniach podłogi
function binRefresh() {
  binInfo();
  const set = state.binSets && binSet();
  if (!BIN.R || !set || !BIN.canvas || !BIN.canvas.isConnected) return;
  const t = set.t, [gc, gr] = binGridSize(t), ox = gc % 2 ? 21 : 0, oz = gr % 2 ? 21 : 0;
  const css = getComputedStyle(document.documentElement), accent = vHex(css.getPropertyValue("--accent"));
  // kolor pojemników z okna Wizualizacja 3D (szósty kolor palety); wybrany – jaśniejszy albo ciemniejszy odcień
  const other = state.viz && state.viz.bins ? vHex(state.viz.bins) : vMix(accent, vHex(css.getPropertyValue("--panel")), 0.4);
  const selCol = vMix(other, 0.299 * other[0] + 0.587 * other[1] + 0.114 * other[2] < 0.45 ? V_WHITE : V_BLACK, 0.35);
  const X0 = ox - gc * 21, X1 = ox + gc * 21, Z0 = oz - gr * 21, Z1 = oz + gr * 21;
  const parts = [], used = new Set();
  let top = 10;
  set.items.forEach((it, i) => {
    if (!binInside(it, t)) return;
    const p = binFull(it), e = binMesh(p);
    used.add(JSON.stringify(p));
    if (e.status !== "ok") return;
    const tx = X0 + (it.x + it.w / 2) * 42, tz = Z1 - (it.y + it.d / 2) * 42;
    const M = new Float32Array([1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, tx, binSeat(t), tz, 1]);
    parts.push({ e: e.mesh, M, col: i === BIN.sel ? selCol : other });
    if (e.text) parts.push({ e: e.text, M, col: binTextCol() });
    top = Math.max(top, e.meta.size[2]);
  });
  const ussa = set.key.startsWith("m:") ? set.plate === "ussa" : true;
  const plRx = ussa && t.fam !== "XL" && typeof vizStlFile === "function" ? binUssaPlateRx(t) : null, plFile = plRx && vizStlFile(plRx);
  if (plFile && SERVER.ok) {
    const e = vizStlGet(plFile);
    if (e.status === "ok") {
      // płyta szuflady (42·d + 8): kieszenie przesunięte względem jej środka o binGridOff (2 mm do tyłu, S z 1 uchwytem –
      // pół kratki w lewo); skrzynki: kratki 7,1 mm od przodu płyty (strona z zabudowanym polem), 7,8 od tyłu
      const [pw, pd] = binPlateSize(t), [ogx, ogz] = binGridOff(t), cfg = { axes: "X,Z,Y" };
      const zf = t.typ === "s" ? Z1 + 7.1 : oz + pd / 2 - ogz, px = ox - ogx;
      const a = [px - pw / 2, 0, zf - pd], b = [px + pw / 2, 0, zf];
      const f = vizStlFit(e, cfg, pw), r = vizStlMatrix(f, a, b, cfg, null);
      parts.push({ e, M: r.M, col: vMix(other, [0.55, 0.55, 0.55], 0.65) });
    } else if (e.status === "loading" && !BIN.plWait) {
      BIN.plWait = true;
      const poll = setInterval(() => { if (e.status !== "loading") { clearInterval(poll); BIN.plWait = false; binRefresh(); } }, 300);
    }
  }
  if (set.key.startsWith("m:") && set.plate === "gen") {  // płyta generowana w całości (części tylko w pliku)
    const p = binPlateParts(set, true)[0], e = binMesh(p);
    used.add(JSON.stringify(p));
    if (e.status === "ok") parts.push({ e: e.mesh, M: new Float32Array([1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, ox, 0, oz, 1]), col: vMix(other, [0.5, 0.5, 0.5], 0.6) });
  }
  // płyta: obrys i kratki na podłodze
  const lin = [], L = [0, 0, 0, 0.35], Lc = [0, 0, 0, 0.12], y = 0.3;
  const ln = (a, b, c) => lin.push(...a, ...c, ...b, ...c);
  for (let i = 0; i <= gc; i++) ln([X0 + i * 42, y, Z0], [X0 + i * 42, y, Z1], i % gc ? Lc : L);
  for (let j = 0; j <= gr; j++) ln([X0, y, Z0 + j * 42], [X1, y, Z0 + j * 42], j % gr ? Lc : L);
  // strop: najwyższy dopuszczalny wierzch pojemnika w tej szufladzie / skrzynce – czerwona ramka z kratkami
  // (prośba użytkownika 2026-11-01: „widać maksymalną wysokość, do jakiej możemy projektować”)
  const H = binCeil(t), R = [0.86, 0.24, 0.18, 0.75], Rc = [0.86, 0.24, 0.18, 0.22];
  for (let i = 0; i <= gc; i++) ln([X0 + i * 42, H, Z0], [X0 + i * 42, H, Z1], i % gc ? Rc : R);
  for (let j = 0; j <= gr; j++) ln([X0, H, Z0 + j * 42], [X1, H, Z0 + j * 42], j % gr ? Rc : R);
  for (const [x, z] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]]) ln([x, y, z], [x, H, z], Rc);
  top = Math.max(top, H);
  BIN.R.upload({ m: { tri: [], lin, lo: [X0, 0, Z0], hi: [X1, top, Z1] }, parts, rects: [[X0, Z0, X1, Z1]] });
  // siatki, których żaden pojemnik już nie używa – zwolnione (bufory na karcie i pamięć)
  for (const [k, e] of BIN.cache) if (!used.has(k) && e.status !== "loading") { if (e.mesh) BIN.R.drop(e.mesh); BIN.cache.delete(k); }
  const fk = binTargetKey(t);
  if (BIN.fitKey !== fk) {
    BIN.fitKey = fk;
    const c = BIN.canvas, asp = c.clientWidth / Math.max(1, c.clientHeight);
    BIN.cam.dist = Math.hypot(X1 - X0, Z1 - Z0, Math.max(top, 60)) / 2 / Math.sin(VIZ_FOV / 2) * (asp < 1 ? 1 / asp : 1) * 1.02;
    BIN.pan = [0, 0, 0];
  }
  BIN.look = vAdd([ox, Math.max(top, 30) / 3, oz], BIN.pan || [0, 0, 0]);  // + przesunięcie prawym przyciskiem
  BIN.base = [ox, Math.max(top, 30) / 3, oz];
  binDraw();
}

function binDraw() {
  const c = BIN.canvas;
  if (!c || !BIN.R || !BIN.look || !c.isConnected) return;
  const gl = c.getContext("webgl2"), dpr = Math.min(2, window.devicePixelRatio || 1), w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  gl.viewport(0, 0, c.width, c.height);
  const cam = BIN.cam, cp = Math.cos(cam.pitch), t = BIN.look;
  const eye = vAdd(t, vMul([Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp], cam.dist));
  const VP = M4.mul(M4.persp(VIZ_FOV, w / h, cam.dist * 0.05, cam.dist * 20), M4.look(eye, t, [0, 1, 0]));
  const css = getComputedStyle(document.documentElement);
  BIN.R.draw(VP, eye, vMix(vHex(css.getPropertyValue("--bg")), vHex(css.getPropertyValue("--panel")), 0.55));
}

// ---------- pobieranie ----------
async function binPost(path, body, name) {
  try {
    const r = await fetch(path, { method: "POST", headers: { "X-Lang": LANG, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
    // nazwa z serwera, gdy to on wybiera rodzaj pliku (3MF albo ZIP przy kilku płytach)
    const cd = /filename\*=UTF-8''([^;]+)/.exec(r.headers.get("Content-Disposition") || "");
    const a = el("a", { href: URL.createObjectURL(await r.blob()), download: name || (cd ? decodeURIComponent(cd[1]) : "pojemniki") });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    const info = r.headers.get("X-Ostrzezenia");  // płyty 3MF: ostrzeżenia z układania (za wysoki, za duży…)
    if (info) { const w = JSON.parse(decodeURIComponent(info)).warnings || []; if (w.length) alert(w.join("\n\n")); }
  } catch (e) { alert(e.message); }
}
const binSafe = s => String(s).replace(/[\\/:*?"<>|]+/g, "_").trim() || "pojemniki";
function binDownloadAll() {
  const set = binSet(), items = set.items.filter(it => binInside(it, set.t));
  if (!items.length) return;
  const name = binSafe(binSetLabel(set, new Map(binInstances().map(i => [i.key, i]))));
  const plate = set.key.startsWith("m:") && set.plate === "gen" ? binPlateParts(set).map(p => ({ p, qty: 1 })) : [];
  binPost("/api/pojemnik/zip", { name, bins: [...items.map(it => ({ p: binFull(it), qty: 1 })), ...plate] }, name + ".zip");
}
// pojemniki układu ułożone na płytach drukarki z „Przygotuj wydruk” (ta sama drukarka, odstęp, projekt slicera, kolory
// części) – jeden plik 3MF; układ własny razem ze swoją płytą (USSA albo generowaną), bo nie ma jej w projekcie
const binHasPlate = set => set.key.startsWith("m:") && (set.plate === "gen" || set.plate === "ussa");
function binDownload3mf() {
  const set = binSet(), t = set.t, inside = set.items.filter(it => binInside(it, t));
  if (!inside.length && !binHasPlate(set)) return;  // sama płyta układu własnego też (prośba użytkownika 2026-11-02)
  const name = binSafe(binSetLabel(set, new Map(binInstances().map(i => [i.key, i]))));
  const q = new Map(), add = (file, gen) => { const e = q.get(file) || { file, qty: 0, gen }; e.qty++; q.set(file, e); };
  for (const it of inside) { const p = binFull(it); add(binFileOf(p), p); }
  if (set.key.startsWith("m:") && set.plate === "gen") binPlateParts(set).forEach(p => add(binFileOf(p), p));
  if (set.key.startsWith("m:") && set.plate === "ussa") findAll(binUssaPlateRx(t)).forEach(f => add(f, null));
  const j = state.job, pr = PRINTERS[j.printer];
  const items = [...q.values()].map(e => {
    const est = estimate(e.file), color = partColor(e.file);
    return { file: e.file, qty: e.qty, label: name, sec: est ? est.sec : 0, g: est ? est.g : 0, ...(e.gen ? { gen: e.gen } : {}),
      ...(color ? { color, color_name: colorName(color) } : {}), ...(e.gen && typeof labTextColor === "function" ? labTextColor(e.gen) : {}) };
  });
  binPost("/api/pojemnik/3mf", { name, items, opts: { printer: j.printer, bed: j.bed, gap: j.gap, project: !!(j.project && pr && pr.bambu) } });
}
function binDownloadOne(it) {
  const e = BIN.cache.get(JSON.stringify(binFull(it)));
  const p = binFull(it), dwie = p.napisy.length && p.styl_napisu !== "wklesly";  // napis wpuszczony – ZIP z dwiema częściami
  binPost("/api/pojemnik/stl", p, dwie ? null : ((e && e.meta && e.meta.name) || "gridfinity") + ".stl");
}

// ---------- opis: liczba, filament, czas, ostrzeżenia ----------
function binInfo() {
  const box = document.getElementById("binInfo");
  if (!box || !state.binSets) return;
  const set = binSet(), t = set.t, [gc, gr] = binGridSize(t), kids = [];
  const ok = set.items.filter(it => binInside(it, t)), out = set.items.length - ok.length;
  const cells = ok.reduce((n, it) => n + it.w * it.d, 0);
  const kinds = new Set(ok.map(it => JSON.stringify(binFull(it))));
  kids.push(el("div", {}, tr("{n} pojemników ({k} rodzajów) · zajęte {a} z {b} kratek", { n: ok.length, k: kinds.size, a: cells, b: gc * gr })));
  kids.push(el("div", { class: "hint" }, tr("Czerwona ramka: najwyżej {mm} mm nad dnem – pojemnik do {a} jedn. z rantem, {b} bez rantu.",
    { mm: Math.round(binCeil(t)), a: binMaxH(t, true), b: binMaxH(t, false) })));
  const metas = ok.map(it => BIN.cache.get(JSON.stringify(binFull(it)))).filter(e => e && e.status === "ok").map(e => e.meta);
  if (PRINT && ok.length && metas.length === ok.length) {
    const g = metas.reduce((s, m) => s + PRINT.model.g[0] * m.cm3 + PRINT.model.g[1] * m.cm2, 0);
    const sec = metas.reduce((s, m) => s + PRINT.model.t[0] * m.cm3 + PRINT.model.t[1] * m.cm2, 0) * state.speed;
    kids.push(el("div", {}, tr("≈ {time} druku · ≈ {mass} filamentu", { time: fmtTime(sec), mass: fmtG(g) })));
  } else if (ok.length && metas.length < ok.length) kids.push(el("div", { class: "hint" }, tr("liczę bryłę…")));
  const tall = ok.filter(it => it.p.h > binMaxH(t, it.p.rant)).length;
  if (tall) kids.push(el("div", { class: "err" }, tr("{n} pojemników jest za wysokich – zmniejsz wysokość.", { n: tall })));
  if (out) kids.push(el("div", { class: "err" }, tr("{n} pojemników wychodzi poza siatkę albo stoi na zabudowanym polu płyty – przesuń je albo usuń; nie trafią do pliku ZIP ani na listę części.", { n: out })));
  if (BIN.err) kids.push(el("div", { class: "err" }, BIN.err));
  box.replaceChildren(...kids);
}

// ---------- edytor siatki ----------
function binGridEl(set, rerender) {
  const t = set.t, [gc, gr] = binGridSize(t), C = BIN_CELL;
  const g = el("div", { class: "bin-grid", style: `width:${gc * C}px;height:${gr * C}px` });
  for (let y = 0; y < gr; y++) for (let x = 0; x < gc; x++)
    g.append(el("div", { class: "bin-cell", style: `left:${x * C}px;top:${(gr - 1 - y) * C}px;width:${C}px;height:${C}px` }));
  for (const [x, y] of binBlocked(t))  // pole zabudowane w płycie USSA skrzynki
    g.append(el("div", { class: "bin-cell blocked", title: tr("Pole zabudowane w płycie USSA (wycięcie na palec) – bez kieszeni."),
      style: `left:${x * C}px;top:${(gr - 1 - y) * C}px;width:${C}px;height:${C}px` }));
  set.items.forEach((it, i) => {
    const bad = !binInside(it, t) || it.p.h > binMaxH(t, it.p.rant);
    g.append(el("div", { class: "bin-item" + (i === BIN.sel ? " sel" : "") + (bad ? " bad" : ""),
      style: `left:${it.x * C + 2}px;top:${(gr - it.y - it.d) * C + 2}px;width:${it.w * C - 4}px;height:${it.d * C - 4}px`,
      title: tr("kliknij, aby wybrać"),
      onpointerdown: e => { e.stopPropagation(); BIN.sel = BIN.sel === i ? -1 : i; rerender(); } },
      `${it.w}×${it.d}×${it.p.h}`));
  });
  const pick = el("div", { class: "bin-pick", hidden: true });
  g.append(pick);
  const cellAt = e => {
    const r = g.getBoundingClientRect();
    return [Math.max(0, Math.min(gc - 1, Math.floor((e.clientX - r.left) / C))), Math.max(0, Math.min(gr - 1, gr - 1 - Math.floor((e.clientY - r.top) / C)))];
  };
  const rect = () => { const [a, b] = BIN.pick.a, [c, d] = BIN.pick.b; return [Math.min(a, c), Math.min(b, d), Math.abs(a - c) + 1, Math.abs(b - d) + 1]; };
  const show = () => {
    const [x, y, w, d] = rect(), free = binFree(set, x, y, w, d);
    Object.assign(pick.style, { left: x * C + "px", top: (gr - y - d) * C + "px", width: w * C + "px", height: d * C + "px" });
    pick.hidden = false; pick.classList.toggle("bad", !free); pick.textContent = `${w}×${d}`;
  };
  g.addEventListener("pointerdown", e => { BIN.pick = { a: cellAt(e), b: cellAt(e) }; g.setPointerCapture(e.pointerId); show(); });
  g.addEventListener("pointermove", e => { if (BIN.pick) { BIN.pick.b = cellAt(e); show(); } });
  g.addEventListener("pointerup", () => {
    if (!BIN.pick) return;
    const [x, y, w, d] = rect();
    BIN.pick = null;
    if (w <= 8 && d <= 8 && binFree(set, x, y, w, d)) { BIN.sel = binAdd(set, x, y, w, d); save(); }
    rerender();
  });
  return el("div", { class: "bin-gridwrap" }, el("div", { class: "hint" }, tr("tył")), g, el("div", { class: "hint" }, tr("przód")));
}

// formularz: wybrany pojemnik albo wzór nowych
function binForm(set, rerender) {
  const it = set.items[BIN.sel], t = set.t;
  const q = it ? it.p : state.bin;
  const ch = (k, fn) => v => { q[k] = v; if (fn) fn(); save(); rerender(); };
  const row = (label, ...kids) => el("label", { class: "bin-row" }, el("span", {}, label), ...kids);
  const mx = binMaxH(t, q.rant);
  const kids = [];
  if (it) {
    const resize = (k) => v => {
      const w = k === "w" ? v : it.w, d = k === "d" ? v : it.d;
      if (!binFree(set, it.x, it.y, w, d, BIN.sel)) { alert(tr("Brak miejsca – obok są inne pojemniki albo koniec siatki.")); rerender(); return; }
      it.w = w; it.d = d; it.p.nx = Math.min(it.p.nx, 4 * w); it.p.ny = Math.min(it.p.ny, 4 * d); save(); rerender();
    };
    kids.push(el("h3", {}, tr("Wybrany pojemnik")),
      row(tr("szerokość (× 42 mm)"), num(it.w, resize("w"), 1, 8)),
      row(tr("głębokość (× 42 mm)"), num(it.d, resize("d"), 1, 8)));
  } else {
    kids.push(el("h3", {}, tr("Nowe pojemniki")),
      el("p", { class: "hint" }, tr("Przeciągnij po wolnych kratkach, aby wstawić pojemnik; kliknij pojemnik, aby go zmienić.")));
  }
  kids.push(
    row(tr("wysokość (× 7 mm)"), num(q.h, ch("h"), 2, 26)),
    el("p", { class: q.h > mx ? "err" : "hint" }, tr("Tu zmieści się najwyżej {n} jedn.", { n: mx })),
    row(tr("przegródki wzdłuż szerokości"), num(q.nx, ch("nx"), 1, it ? 4 * it.w : 8)),
    row(tr("przegródki wzdłuż głębokości"), num(q.ny, ch("ny"), 1, it ? 4 * it.d : 8)),
    row(tr("półka na etykietę"), sel(q.etykieta, [["tyl", tr("z tyłu")], ["przod", tr("z przodu")], ["brak", tr("bez półki")]], ch("etykieta"))),
    chk(q.uchwyt, tr("zaokrąglone dno przy przedniej ściance (łatwiej wybrać drobiazgi)"), ch("uchwyt")),
    chk(q.rant, tr("rant do układania pojemników jeden na drugim"), ch("rant")),
    chk(q.magnesy, tr("otwory na magnesy 6 × 2 mm w spodzie"), ch("magnesy")),
    // lekkie dno – tylko bez magnesów (z magnesami pełne, decyzja użytkownika)
    q.magnesy ? null : chk(q.lekkie !== false, tr("lekkie dno – wnętrze kratek wyżłobione w stopce (dno ok. 1 mm zamiast 6 mm)"), ch("lekkie")));
  if (it && q.etykieta !== "brak") kids.push(binNapisyForm(it, q, rerender));
  const btns = [];
  if (it) {
    btns.push(el("button", { onclick: () => binDownloadOne(it) }, tr("Pobierz STL")),
      el("button", { onclick: () => { BIN.sel = -1; rerender(); } }, tr("Gotowe")));
  } else {
    btns.push(el("button", { title: tr("wysokość, półka, zaokrąglenie, rant, magnesy i dno jak we wzorze; przegródki bez zmian"), onclick: () => {
      for (const x of set.items) Object.assign(x.p, { h: q.h, etykieta: q.etykieta, uchwyt: q.uchwyt, rant: q.rant, magnesy: q.magnesy, lekkie: q.lekkie !== false });
      save(); rerender();
    } }, tr("Zastosuj do wszystkich")),
      el("button", { onclick: () => { state.bin = { ...BIN_DEFAULT }; save(); rerender(); } }, tr("Domyślne")));
  }
  kids.push(el("div", { class: "row", style: "margin-top:8px" }, ...btns));
  return el("div", { class: "bin-form" }, ...kids);
}

// napisy na półkach wybranego pojemnika: styl, kolor liter (wspólny z etykietami), napis i symbol każdej przegródki
function binNapisyForm(it, q, rerender) {
  const a = document.activeElement, pisze = a && a.classList && a.classList.contains("bin-nap")
    ? [a.dataset.k, a.selectionStart, a.selectionEnd] : null;
  const n = q.nx * q.ny, nap = q.napisy = Array.isArray(q.napisy) ? q.napisy : [];
  const zap = k => nap[k] = nap[k] || { t: "", s: "" };
  const e = BIN.cache.get(JSON.stringify(binFull(it))), lit = (e && e.meta && e.meta.letters) || {};
  const wkl = q.styl_napisu === "wklesly";
  const box = el("div", { class: "bin-nap-box" }, el("h3", {}, tr("Napisy na półkach")),
    el("label", { class: "bin-row" }, el("span", {}, tr("styl napisu")), sel(wkl ? "wklesly" : "wpuszczony",
      [["wpuszczony", tr("wpuszczony – drugi filament, równo z półką")], ["wklesly", tr("wklęsły – jeden kolor")]], v => { q.styl_napisu = v; save(); rerender(); })),
    wkl ? null : el("label", { class: "bin-row" }, el("span", {}, tr("kolor napisu (wspólny z etykietami)")),
      sel(state.labelTextColor || "#000000", COLOR_PALETTE.map(([h, nm]) => [h, tr(nm)]), v => { state.labelTextColor = v; save(); rerender(); })),
    el("p", { class: "hint" }, n > 1 ? tr("Przegródki od lewej, najpierw przedni rząd.") : null));
  for (let k = 0; k < n; k++) {
    const x = nap[k] || { t: "", s: "" }, polys = x.s && typeof labSymPolys === "function" ? labSymPolys(x.s) : null;
    const inp = el("input", { type: "text", class: "bin-nap", "data-k": k, maxlength: 40, placeholder: tr("napis"), style: "flex:1;min-width:80px",
      oninput: ev => { zap(k).t = ev.target.value; save(); clearTimeout(BIN.napT); BIN.napT = setTimeout(rerender, 500); } });
    inp.value = x.t || "";
    box.append(el("div", { class: "row" }, n > 1 ? el("span", { class: "q" }, String(k + 1)) : null, inp,
      polys ? labSymSvg(polys, 22) : null,
      el("button", { class: "small", onclick: ev => { ev.preventDefault(); BIN.napPick = BIN.napPick === k ? -1 : k; rerender(); } }, tr("Symbol…"))));
    if (lit[k] !== undefined && lit[k] > 0 && lit[k] < 3)
      box.append(el("p", { class: "err" }, tr("litery niższe niż 3 mm – skróć napis albo podziel go na 2 linie")));
    if (BIN.napPick === k && typeof labPicker === "function")
      box.append(labPicker(x.s, s => { zap(k).s = s; BIN.napPick = -1; save(); rerender(); }));
  }
  if (pisze) requestAnimationFrame(() => {  // przerysowanie nie zabiera kursora z pola napisu
    const f = document.querySelector(`.bin-nap[data-k="${pisze[0]}"]`);
    if (f) { f.focus(); f.setSelectionRange(pisze[1], pisze[2]); }
  });
  return box;
}

function binDeleteSel() {
  const set = state.binSets && binSet();
  if (!set || BIN.sel < 0 || BIN.sel >= set.items.length) return;
  if (typeof histBreak === "function") histBreak();
  set.items.splice(BIN.sel, 1);
  BIN.sel = -1;
  save();
  if (BIN.box) renderBins(BIN.box);
  if (typeof toast === "function") toast(tr("Usunięto pojemnik"));
}
document.addEventListener("keydown", e => {
  if (typeof state === "undefined" || state.tab !== "bins" || BIN.sel < 0 || !BIN.box || !BIN.box.isConnected) return;
  const tag = (e.target && e.target.tagName) || "";
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag) || (e.target && e.target.isContentEditable)) return;  // pisanie w polu
  if (e.key === "Delete") { e.preventDefault(); binDeleteSel(); }
  else if (e.key === "Escape") { BIN.sel = -1; renderBins(BIN.box); }
});

function renderBins(box) {
  BIN.box = box;
  if (location.protocol === "file:" || !SERVER.ok) {
    box.replaceChildren(serverNote(tr("Pojemniki liczy serwer konfiguratora – uruchom program przez uruchom.bat / run.sh.")));
    return;
  }
  if (SERVER.pojemniki === undefined) {
    box.replaceChildren(el("p", { class: "err" }, tr("Serwer działa ze starszą wersją programu – zamknij jego okno i uruchom konfigurator ponownie.")));
    return;
  }
  if (SERVER.pojemniki && (SERVER.pojemnikiWer || 1) < BIN_SERVER_VER) {
    box.replaceChildren(el("p", { class: "err" }, tr("Serwer działa ze starszym generatorem pojemników (płyty i lekkie dno wyszłyby źle) – zamknij jego okno i uruchom konfigurator ponownie.")));
    return;
  }
  if (SERVER.pojemniki === false) {
    box.replaceChildren(el("p", { class: "err" }, tr("Brak biblioteki manifold3d – zainstaluj ją: pip install manifold3d")),
      el("p", { class: "hint" }, tr("Aktualizacja z programu albo ponowne uruchomienie instalatora doinstaluje ją sama.")));
    return;
  }
  const sets = binSets(), set = binSet(), t = set.t, [gc, gr] = binGridSize(t);
  if (BIN.sel >= set.items.length) BIN.sel = -1;
  const rerender = () => renderBins(box);
  const setT = (k, v) => { t[k] = v; set.t = binTargetFix(t); BIN.sel = -1; save(); rerender(); };
  const inst = binInstances(), instMap = new Map(inst.map(i => [i.key, i]));
  const cur = instMap.get(set.key), manual = set.key.startsWith("m:"), orphan = !cur && !manual;
  const count = k => { const s = sets.find(x => x.key === k); return s ? s.items.length : 0; };

  // wybór: szuflady i skrzynki z projektu (każda osobno), układy własne, układy szuflad usuniętych z projektu
  const opts = [...inst.map(i => [i.key, i.label + " – " + tr("{n} poj.", { n: count(i.key) })]),
    ...sets.filter(s => !instMap.has(s.key) && (s.key.startsWith("m:") || s.items.length)).map(s => [s.key, binSetLabel(s, instMap) + " – " + tr("{n} poj.", { n: s.items.length })]),
    ["+", tr("+ własny układ (szuflada spoza projektu)")]];
  // kopiowanie tylko z układów o tej samej siatce płyty (prośba użytkownika: „tylko pasujące warianty”)
  const others = sets.filter(s => s !== set && s.items.length && binGridSize(s.t).join() === binGridSize(t).join());
  const head = el("div", { class: "bin-target" },
    inst.length ? null : el("p", { class: "welcome" }, tr("Żadna szuflada ani skrzynka w projekcie nie ma jeszcze wkładu gridfinity. Ustaw „Wkład” w szufladzie albo „wkład gridfinity” w skrzynce (edytor zestawu) – każda z nich dostanie tu własny układ pojemników. Poniżej możesz też zaprojektować układ dla szuflady spoza projektu.")),
    el("label", { class: "bin-choose" }, el("b", {}, tr("Szuflada / skrzynka")),
      sel(set.key, opts, v => { state.binCur = v === "+" ? binNewManual(set.t) : v; BIN.sel = -1; save(); rerender(); })),
    manual ? el("div", { class: "row" },
      sel(t.typ, [["d", tr("szuflada")], ["s", tr("skrzynka")]], v => setT("typ", v)),
      sel(t.fam, ["S", "M", "L", "XL"].map(f => [f, f]), v => setT("fam", v)),
      sel(t.d, [3, 4, 5, 6, 7].map(d => [d, String(d)]), v => setT("d", +v)),
      sel(t.h, (t.fam === "XL" ? [1] : [1, 2, 4]).map(h => [h, h + "F"]), v => setT("h", +v)),
      binPlates(t).length > 1 && set.plate !== "gen" ? sel(t.plyta, binPlates(t), v => setT("plyta", v)) : null) : null,
    el("div", { class: "hint" }, tr("Płyta {c} × {r} kratek · pojemniki do {h} jedn. wysokości (z rantem)", { c: gc, r: gr, h: binMaxH(t, true) })),
    cur ? chk(!set.off, tr("na listę części i do widoku 3D (× {n} – ilość zestawu)", { n: cur.qty }), v => { set.off = !v; save(); rerender(); }) : null,
    manual ? el("label", { class: "bin-row" }, el("span", {}, tr("ilość na liście części")), num(+set.qty || 0, v => { set.qty = v; save(); rerender(); }, 0, 999)) : null,
    manual ? el("label", { class: "bin-choose" }, tr("płyta pod pojemniki (też na liście części)"),
      sel(set.plate || "none", [["none", tr("bez płyty")], ["ussa", tr("płyta USSA z biblioteki")], ["gen", tr("płyta generowana (standard gridfinity)")]],
        v => { set.plate = v; BIN.sel = -1; save(); rerender(); })) : null,
    manual && set.plate === "gen" ? (() => {
      const [sx, sy] = binPlateSize(t), parts = binPlateParts(set), bed = state.job.bed || [256, 256];
      return el("div", {},
        chk(!!set.plateMag, tr("dno z otworami na magnesy 6 × 2 mm (płyta 3 mm wyższa)"), v => { set.plateMag = v; save(); rerender(); }),
        el("div", { class: "hint" }, tr("Płyta {sx} × {sy} mm (jak płyta USSA), {c} × {r} kratek; {n} części – stół {w} × {d} mm z „Przygotuj wydruk”.",
          { sx, sy, c: gc, r: gr, n: parts.length, w: bed[0], d: bed[1] })),
        el("button", { class: "small", onclick: () => { const name = binSafe(binName(binPlateParts(set, true)[0])); binPost("/api/pojemnik/zip", { name, bins: parts.map(p => ({ p, qty: 1 })) }, name + ".zip"); } }, tr("Pobierz płytę (ZIP)")));
    })() : null,
    orphan ? el("p", { class: "err" }, tr("Tej szuflady nie ma już w projekcie – układ nie trafia na listę części.")) : null,
    el("div", { class: "row" },
      others.length ? el("label", { class: "bin-choose" }, tr("skopiuj pojemniki z:"), sel("", [["", "–"], ...others.map(s => [s.key, binSetLabel(s, instMap)])], v => {
        const src = sets.find(s => s.key === v);
        if (!src) { rerender(); return; }
        const ok = src.items.filter(it => binInside(it, t));
        if (typeof histBreak === "function") histBreak();
        set.items = JSON.parse(JSON.stringify(ok)); BIN.sel = -1; save();
        if (typeof toast === "function") toast(tr("Skopiowano pojemniki: {n}", { n: ok.length }));
        if (ok.length < src.items.length) alert(tr("{n} pojemników nie mieści się w tej siatce – pominięte.", { n: src.items.length - ok.length }));
        rerender();
      })) : null,
      manual || orphan ? el("button", { class: "small", onclick: () => {
        if (typeof histBreak === "function") histBreak();
        sets.splice(sets.indexOf(set), 1); state.binCur = null; BIN.sel = -1; save(); rerender();
        if (typeof toast === "function") toast(tr("Usunięto układ pojemników"));
      } }, tr("Usuń układ")) : null));

  // szybkie wypełnienie wolnych kratek pojemnikami jednego rozmiaru (od lewego przedniego rogu, wiersz po wierszu)
  const fill = (w, d) => {
    if (typeof histBreak === "function") histBreak();
    let n = 0;
    for (let y = 0; y < gr; y++) for (let x = 0; x < gc; x++) if (binFree(set, x, y, w, d)) { binAdd(set, x, y, w, d); n++; }
    save(); rerender();
    if (n && typeof toast === "function") toast(tr("Dodano pojemniki: {n}", { n }));
  };
  const tools = el("div", { class: "row" },
    el("span", { class: "hint" }, tr("Wypełnij wolne kratki:")),
    [[1, 1], [2, 1], [1, 2], [2, 2]].map(([w, d]) => el("button", { class: "small", onclick: () => fill(w, d) }, `${w}×${d}`)),
    // usunięcie zaznaczonego pojemnika (też klawisz Delete – obsługa przy binDeleteSel; prośba użytkownika 2026-11-02)
    el("button", { class: "small", disabled: BIN.sel < 0, title: tr("Usuń zaznaczony pojemnik (klawisz Delete)"), onclick: () => binDeleteSel() }, tr("Usuń")),
    el("button", { class: "small", disabled: !set.items.length, onclick: () => {
      if (typeof histBreak === "function") histBreak();
      set.items = []; BIN.sel = -1; save(); rerender();
      if (typeof toast === "function") toast(tr("Usunięto wszystkie pojemniki z układu"));
    } }, tr("Wyczyść")));

  const left = el("div", { class: "bin-left" }, head, binGridEl(set, rerender), tools, binForm(set, rerender));
  const view = el("div", { class: "bin-view" }, binView(), el("div", { id: "binInfo", class: "bin-info" }),
    el("div", { class: "row", style: "margin-top:8px" },
      el("button", { class: "primary", disabled: !set.items.some(it => binInside(it, t)) && !binHasPlate(set), onclick: binDownload3mf }, tr("Pobierz 3MF")),
      el("button", { disabled: !set.items.some(it => binInside(it, t)), onclick: binDownloadAll }, tr("Pliki STL (ZIP)"))),
    el("p", { class: "hint" }, tr("3MF: pojemniki tego układu ułożone na płytach drukarki {printer} – jak w „Przygotuj wydruk” (odstęp, projekt slicera, kolory części){plate}.",
      { printer: PRINTERS[state.job.printer] ? printerLabel(PRINTERS[state.job.printer]) : tr("własny stół…"),
        plate: set.key.startsWith("m:") && set.plate && set.plate !== "none" ? tr(", razem z płytą układu") : "" }) + " " +
      tr("ZIP zawiera każdy rodzaj pojemnika raz i listę ilości. Pojemniki trafiają też na listę części, do szacunku i na płyty 3MF w „Przygotuj wydruk”, a w widoku 3D stoją w wysuniętej szufladzie. Wymiary wg standardu gridfinity – pasują też do innych płyt i pojemników gridfinity.")));
  if (!BIN.R) view.prepend(el("p", { class: "err" }, tr("Ta przeglądarka nie obsługuje WebGL 2 – wizualizacja 3D jest niedostępna.")));
  box.replaceChildren(el("div", { class: "bin-wrap" }, left, view));
  requestAnimationFrame(binRefresh);
}
