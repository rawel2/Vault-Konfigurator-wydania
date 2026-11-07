// Zakładka „Etykiety” (od 2026-11-02, prośba użytkownika: „uproszczona wersja, pasująca do profili USSA” – wzorem
// labels.vi-kan.net): etykiety frontów VAULT z wypukłym napisem i symbolem. Bryłę robi serwer (etykiety.py) z etykiety
// USSA z biblioteki: „d” – Label.stl (szuflady, skrzynki 2F/4F), „s” – Label for Sustainers.stl (skrzynki 1F).
// state.labels [{ id, rodzaj, tekst, symbol, h, qty }], state.labelCur – zaznaczona, state.labelsBom – na listę części
// zamiast tylu samo pustych etykiet. Pliki „@etykiety/<nazwa>.stl” z parametrami (gen) jak pojemniki: druk.py generuje je
// przy przygotowaniu wydruku, szacunek – binEstimate (opis z serwera).
// Wczytywany po pojemniki.js (binPost, binSafe, BIN_GEN, BIN_SERVER_VER).

const LAB_FILE = "@etykiety/";
// symbole wybiera się z siatki obrazków (kontury z serwera: GET /api/symbole – napisy.GRUPY_SYMBOLI); tłumaczone są tylko
// nazwy grup (prośba użytkownika 2026-11-03: dużo więcej symboli w logicznych grupach)
const LAB_GROUPS = [["sruby", "Śruby, wkręty i gwoździe"], ["napedy", "Łby i napędy"], ["nakretki", "Nakrętki i podkładki"],
  ["kolki", "Kołki, nity i inne"], ["narzedzia", "Narzędzia"], ["inne", "Druk 3D i inne"],
  // ikony Material Icons (czcionki/ikony.json)
  ["dom", "Dom i sprzątanie"], ["kuchnia", "Kuchnia i jedzenie"], ["warsztat", "Warsztat i budowa"], ["elektronika_ikony", "Elektronika i komputery"],
  ["biuro", "Biuro i szkoła"], ["ogrod", "Ogród, natura i zwierzęta"], ["hobby", "Sport, hobby i zabawki"], ["zdrowie", "Zdrowie i higiena"],
  ["ubrania", "Ubrania i rzeczy osobiste"], ["podroze", "Auto, rower i podróże"], ["znaki", "Znaki i strzałki"], ["przechowywanie", "Przechowywanie i różne"]];
const LAB_KINDS = [["d", "szuflada / skrzynka 2F i 4F (Label)"], ["s", "skrzynka 1F (Label for Sustainers)"]];
// puste etykiety USSA (lista części) – wyrażenia przy użyciu, bo R jest w głównym skrypcie index.html (wczytywanym później)
const labPlain = k => k === "s" ? /^02\. sustainers\/05\. universal\/label for sustainers\.stl$/ : /^01\. drawers\/07\. universal\/label\.stl$/;
const LAB = { view: new Map(), timer: 0, sym: null, symLoading: false, picker: false };
// kontury symboli z serwera (raz), potem przerysowanie zakładki – etykiet albo pojemników (wybór symbolu napisu na półce;
// do 2026-11-03 przerysowywana była tylko zakładka etykiet i wybór w pojemnikach wisiał – zgłoszenie użytkownika);
// błąd zapamiętany (LAB.symErr), żeby przerysowanie nie pytało serwera w kółko
function labSymbols() {
  if (LAB.sym || LAB.symLoading || LAB.symErr || !SERVER.ok) return LAB.sym;
  LAB.symLoading = true;
  api("/api/symbole").then(r => { LAB.sym = r; }).catch(e => { LAB.symErr = e.message || String(e); })
    .finally(() => { LAB.symLoading = false; if (state.tab === "labels" || state.tab === "bins") renderResult(); });
  return null;
}
const labSymKnown = k => !LAB.sym ? /^\w+$/.test(k || "") : LAB.sym.grupy.some(g => g.symbole.some(s => s.k === k));
function labSymSvg(polys, px = 30) {
  const s = el("span", { class: "lab-sym" });
  s.innerHTML = `<svg viewBox="0 0 10 10" width="${px}" height="${px}"><path fill="currentColor" fill-rule="nonzero" transform="matrix(1 0 0 -1 0 10)" d="${
    polys.map(p => "M" + p.map(([x, y]) => x + "," + y).join("L") + "Z").join("")}"/></svg>`;
  return s;
}
const labSymPolys = k => { const g = LAB.sym && LAB.sym.grupy.find(g => g.symbole.some(s => s.k === k)); return g ? g.symbole.find(s => s.k === k).p : null; };

// parametry jak etykiety.parametry w Pythonie – z nich nazwa pliku (musi się zgadzać z etykiety.nazwa)
// styl: wypukły (licem do góry), wklęsły (wycięty w licu, najwyżej 0,6 mm – etykiety.WKLESLY_MAKS; plik licem do stołu)
// albo wpuszczony (jak wklęsły, a wycięcie wypełniają litery – druga część na drugi filament, równo z licem)
const labParams = l => {
  const styl = ["wklesly", "wpuszczony"].includes(l.styl) ? l.styl : "wypukly";
  return { typ: "etykieta", rodzaj: l.rodzaj === "s" ? "s" : "d", tekst: String(l.tekst || "").slice(0, 60),
    symbol: l.symbol && labSymKnown(l.symbol) ? l.symbol : "",
    h: Math.round(Math.max(styl === "wpuszczony" ? 0.4 : 0.2, Math.min(styl === "wypukly" ? 1.2 : 0.6, +l.h || 0.4)) * 100) / 100, styl };
};
function labFnv(s) {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(s)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
const labSlug = s => s.replace(/ł/g, "l").replace(/Ł/g, "L").normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
function labName(q) {
  let n = "etykieta_" + (q.rodzaj === "d" ? "szuflada" : "skrzynka_1F");
  if (labSlug(q.tekst)) n += "_" + labSlug(q.tekst);
  if (q.symbol) n += "_" + q.symbol;
  const [dn, dh] = { wypukly: ["", ""], wklesly: ["_wklesly", "|w"], wpuszczony: ["_wpuszczony", "|p"] }[q.styl];
  return n + dn + "_" + labFnv(`${q.rodzaj}|${q.tekst}|${q.symbol}|${q.h.toFixed(2)}` + dh).slice(0, 6);
}
// kolor liter etykiety wpuszczonej (osobna część – w projekcie Bambu Studio własny filament), jeden dla wszystkich etykiet
const labTextColor = q => q.styl === "wpuszczony" || (q.typ !== "etykieta" && q.typ !== "plyta" && Array.isArray(q.napisy) && q.napisy.length && q.styl_napisu !== "wklesly") ? { text_color: state.labelTextColor || "#000000", text_color_name: colorName(state.labelTextColor || "#000000") } : {};
const labFileOf = q => { const f = LAB_FILE + labName(q) + ".stl"; BIN_GEN.set(f, q); return f; };
const labEmpty = l => !String(l.tekst || "").trim() && !l.symbol;

// etykieta w zakresie zakładek: przypisana do frontu (src) albo dodana w widoku zestawu (st); inne – w „Całym projekcie”
const labIn = l => inScope(l.src || null, l.st);
function labState() {
  if (!Array.isArray(state.labels)) state.labels = [];
  if (state.labelsBom === undefined) state.labelsBom = true;
  if (!state.labels.some(labIn)) state.labels.push(labNew(scopeTag()));
  state.labelCur = Math.max(0, Math.min(state.labels.length - 1, state.labelCur || 0));
  if (!labIn(state.labels[state.labelCur])) state.labelCur = state.labels.findIndex(labIn);
  return state.labels[state.labelCur];
}
function labNew(from) {
  const id = Math.max(0, ...(state.labels || []).map(l => l.id || 0)) + 1;
  return Object.assign({ rodzaj: "d", tekst: "", symbol: "", h: 0.4, styl: "wypukly", qty: 1 }, from || {}, { id });
}

// fronty projektu: każda szuflada (każdy front modułu) i każda skrzynka w każdej warstwie i kolumnie – jak binInstances;
// rodzaj etykiety jak w addSustainer (skrzynka 1F – Label for Sustainers, reszta – Label), ilość = ilość zestawu
function labFronts() {
  const out = [];
  for (const st of state.stacks) st.layers.forEach((l, li) => l.cols.forEach((c, ci) => {
    const fam = FAMILIES[l.layout][ci], side = l.cols.length > 1 ? (ci === 0 ? tr("lewa") : tr("prawa")) : "";
    const where = [st.name, li === 0 ? tr("Warstwa 1 (spód)") : tr("Warstwa {n}", { n: li + 1 })];
    const add = (k, rodzaj, what) => out.push({ src: binKey(st, l, ci, k), rodzaj, qty: st.qty, gdzie: [...where, [what, side].filter(Boolean).join(", ")].join(" · ") });
    if (l.type === "D") c.pattern.forEach((h, k) => add(k, "d", tr("szuflada {fam}{d} {h}F", { fam, d: st.depth, h }) +
      (c.pattern.length > 1 ? ", " + tr("szuflada {k} od góry", { k: k + 1 }) : "")));
    else add(0, l.height === 1 ? "s" : "d", tr("skrzynka {fam}{d} {h}F", { fam, d: st.depth, h: l.height }));
  }));
  return out;
}
// „Etykiety z projektu”: po jednej etykiecie na front (prośba użytkownika 2026-11-03). Istniejące (ten sam front – `src`)
// dostają tylko aktualny rodzaj, ilość i opis, więc kolejne kliknięcie po zmianie projektu dopisuje nowe fronty.
// Nietknięta jedyna pusta etykieta (stan startowy zakładki) znika.
function labFromProject() {
  histBreak();
  labState();
  const own = state.labels.filter(labIn);  // jedyna etykieta zakresu – nietknięta pusta startowa – znika
  if (own.length === 1 && labEmpty(own[0]) && !own[0].src) state.labels.splice(state.labels.indexOf(own[0]), 1);
  const cur = state.labels[state.labelCur] || {};
  let n = 0;
  for (const f of labFronts().filter(f => inScope(f.src))) {  // zakres zakładek: fronty wybranego zestawu
    const e = state.labels.find(l => l.src === f.src);
    if (e) Object.assign(e, { rodzaj: f.rodzaj, qty: f.qty, gdzie: f.gdzie });
    else { state.labels.push(labNew({ symbol: cur.symbol || "", h: cur.h || 0.4, styl: cur.styl || "wypukly", ...f })); n++; }
  }
  state.labelCur = Math.max(0, state.labels.findIndex(l => l.src && labEmpty(l) && labIn(l)));
  save(); renderResult();
  toast(n ? tr("Dodano etykiety z projektu: {n}", { n }) : tr("Wszystkie fronty projektu mają już etykiety"));
}

// puste etykiety wyłączone, a etykiet z napisem (na liście części) nie tyle, ile frontów – prośba użytkownika 2026-11-03:
// ostrzeżenie w „Uwagach do projektu” i w „Przygotuj wydruk”. Zwraca tekst albo null.
function labMismatch() {
  if (state.blankLabels !== false) return null;
  // etykiety w ogóle nieużywane (żadnej z frontem ani z napisem w zakresie) – świadomie bez etykiet, bez ostrzeżenia
  if (!(state.labels || []).some(l => labIn(l) && (l.src || !labEmpty(l)))) return null;
  const need = { d: 0, s: 0 }, have = { d: 0, s: 0 };
  for (const f of labFronts()) if (inScope(f.src)) need[f.rodzaj] += +f.qty || 0;
  if (state.labelsBom !== false) for (const l of state.labels || []) if (!labEmpty(l) && labIn(l)) have[l.rodzaj === "s" ? "s" : "d"] += +l.qty || 0;
  const bad = ["d", "s"].filter(k => need[k] !== have[k]);
  if (!bad.length) return null;
  return tr("Puste etykiety są wyłączone, a liczba etykiet z napisem nie zgadza się z liczbą frontów: {list}.", {
    list: bad.map(k => tr(k === "d" ? "Label (szuflady, skrzynki 2F i 4F) {a} z {b}" : "Label for Sustainers (skrzynki 1F) {a} z {b}",
      { a: have[k], b: need[k] })).join("; ") });
}

// okno 3D: etykieta frontu `key` (binKey) – parametry etykiety z napisem przypisanej do tego frontu („Etykiety z projektu”),
// "none" – pusta wnęka (puste etykiety wyłączone, a żadna etykieta z napisem nie czeka na przydział), null – pusta USSA
// (prośba użytkownika 2026-11-03). Etykiety dodane ręcznie nie mają frontu – w oknie 3D ich nie ma.
function labForFront(key, rodzaj) {
  const on = state.labelsBom !== false && Array.isArray(state.labels);
  const l = on && state.labels.find(l => l.src === key && !labEmpty(l) && +l.qty > 0);
  if (l && (l.rodzaj === "s" ? "s" : "d") === rodzaj) return labParams(l);
  const reczne = on && state.labels.some(l => !l.src && !labEmpty(l) && +l.qty > 0);
  return state.blankLabels === false && !reczne ? "none" : null;
}

// lista części: etykiety z napisem w miejsce tylu samo pustych etykiet USSA (gdy state.labelsBom)
function labAddToBom(b) {
  if (!Array.isArray(state.labels) || state.labelsBom === false) return;
  for (const l of state.labels) {
    const n = +l.qty || 0;
    if (!n || labEmpty(l) || !labIn(l)) continue;
    const q = labParams(l);
    b.addGen("Etykiety z napisem", String(l.tekst || "").replace(/\n|\|/g, " / ") || "(" + l.symbol + ")", labFileOf(q), n, q);
    const plain = findAll(labPlain(q.rodzaj))[0], e = plain && b.parts.get(plain);
    if (e) { e.qty -= Math.min(e.qty, n); if (!e.qty) b.parts.delete(plain); }
  }
}

// podgląd 2D z serwera (obrys wierzchu i napis w kierunku czytania), pamięć według parametrów
function labView(q) {
  const key = JSON.stringify(q);
  let e = LAB.view.get(key);
  if (e) return e;
  e = { status: "loading" };
  LAB.view.set(key, e);
  api("/api/pojemnik/rzut", q).then(r => { e.status = "ok"; e.r = r; }).catch(err => { e.status = "err"; e.err = err.message; })
    // przerysowanie także poza zakładką – „Uwagi do projektu” sprawdzają wysokość liter (labSmallLetters); kilka
    // odpowiedzi naraz – jedno przerysowanie
    .finally(() => { clearTimeout(LAB.rt); LAB.rt = setTimeout(renderResult, 120); });
  return e;
}
// etykiety z napisem na liście części, których litery mają mniej niż 3 mm (rzut z serwera; brakujące pobiera w tle)
function labSmallLetters() {
  if (!SERVER.ok || !SERVER.pojemniki || state.labelsBom === false || !Array.isArray(state.labels)) return [];
  return state.labels.filter(l => {
    if (!String(l.tekst || "").trim() || !(+l.qty > 0)) return false;
    const v = labView(labParams(l));
    return v.status === "ok" && v.r.letter > 0 && v.r.letter < 3;
  });
}
function labSvg(r, w = 520, wklesly = false, styl = null) {
  const [W, H] = r.size, k = w / W, pad = 4;
  const d = polys => polys.map(p => "M" + p.map(([x, y]) => `${(pad + x * k).toFixed(1)},${(pad + (H - y) * k).toFixed(1)}`).join(" L") + " Z").join(" ");
  const css = getComputedStyle(document.documentElement);
  // kolor z projektu idzie do znacznika SVG (innerHTML) – tylko #RGB/#RRGGBB, bo wczytany plik projektu może być obcy
  const lock = state.viz && String(state.viz.lock || "");
  const body = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(lock) ? lock : "#3a3d40";
  // napis widoczny na każdym licu (zgłoszenie użytkownika 2026-11-05 ze zrzutem: wklęsły na czarnym licu – „nic nie widać”,
  // cień był czarny): wklęsły – cień jaśniejszy na ciemnym licu, ciemniejszy na jasnym; wpuszczony – kolor napisu, a gdy
  // prawie taki jak lico – akcent
  const hex = c => { const h = c.replace("#", ""), f = h.length === 3 ? h.replace(/./g, "$&$&") : h; return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)); };
  const jasn = c => { const [r_, g, b_] = hex(c); return 0.299 * r_ + 0.587 * g + 0.114 * b_; };
  const akcent = css.getPropertyValue("--accent").trim() || "#e8662b";
  const tc = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(state.labelTextColor || "") ? state.labelTextColor : "#000000";
  const text = wklesly ? (jasn(body) < 110 ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.55)")
    : styl === "wpuszczony" ? (Math.hypot(...hex(tc).map((v, i) => v - hex(body)[i])) > 60 ? tc : akcent) : akcent;
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${(W * k + 2 * pad).toFixed(0)} ${(H * k + 2 * pad).toFixed(0)}" width="${(W * k + 2 * pad).toFixed(0)}">` +
    `<path d="${d(r.outline)}" fill="${body}" stroke="${css.getPropertyValue("--line").trim() || "#888"}" fill-rule="evenodd"/>` +
    `<path d="${d(r.relief)}" fill="${text}" fill-rule="evenodd"/></svg>`;
  const box = el("div", { class: "lab-svg" });
  box.innerHTML = s;
  return box;
}

function labPicker(cur, pick) {
  const d = labSymbols();
  if (!d) return LAB.symErr ? el("p", { class: "err" }, tr("Nie udało się wczytać symboli: {e}", { e: LAB.symErr }))
    : el("p", { class: "hint" }, tr("Wczytuję symbole…"));
  const btn = (k, kids) => el("button", { class: "lab-pick" + (k === (cur || "") ? " on" : ""), title: k || "", onclick: e => { e.preventDefault(); pick(k); } }, kids);
  return el("div", { class: "lab-picker" }, btn("", el("span", { class: "hint" }, tr("bez symbolu"))),
    ...d.grupy.map(g => el("div", {}, el("div", { class: "lab-grp" }, tr((LAB_GROUPS.find(([k]) => k === g.id) || [g.id, g.id])[1])),
      el("div", { class: "lab-grid" }, g.symbole.map(s => btn(s.k, labSymSvg(s.p, 26)))))));
}
function renderLabels(box) {
  labSymbols();
  // pisanie w polu napisu: przerysowanie (podgląd, lista) nie może zabrać kursora
  const a = document.activeElement, pisze = a && a.classList && a.classList.contains("lab-text") ? [a.selectionStart, a.selectionEnd] : null;
  const cur = labState(), q = labParams(cur);
  const rerender = () => { save(); renderResult(); };
  const ch = k => v => { cur[k] = v; rerender(); };
  if (!SERVER.ok || !SERVER.pojemniki) {
    box.replaceChildren(el("h3", {}, tr("Etykiety z napisem")), serverNote(
      SERVER.ok ? tr("Brak biblioteki manifold3d – zainstaluj ją: pip install manifold3d")
        : tr("Etykiety generuje serwer konfiguratora – uruchom uruchom.bat (Windows) albo run.sh (macOS, Linux)."), "err"));
    return;
  }
  if ((SERVER.pojemnikiWer || 1) < BIN_SERVER_VER) {
    box.replaceChildren(el("h3", {}, tr("Etykiety z napisem")), el("p", { class: "err" },
      tr("Serwer ma starszą wersję generatora – zamknij okno konfiguratora i uruchom go ponownie.")));
    return;
  }
  // lista etykiet
  // zakres zakładek: tylko etykiety wybranego zestawu (indeksy jak w state.labels)
  const inCnt = state.labels.filter(labIn).length, outCnt = state.labels.length - inCnt;
  const list = el("div", { class: "lab-list" }, ...state.labels.map((l, i) => !labIn(l) ? null : el("div", {
    class: "lab-item" + (i === state.labelCur ? " on" : ""), onclick: () => { state.labelCur = i; rerender(); } },
    el("span", { class: "q" }, "×" + (+l.qty || 0)),
    el("span", { class: "lab-txt" }, String(l.tekst || "").replace(/\n|\|/g, " / ") || (l.symbol ? "(" + l.symbol + ")" : tr("(pusta)")),
      l.gdzie ? el("span", { class: "hint lab-where" }, l.gdzie) : null),
    el("span", { class: "hint" }, l.rodzaj === "s" ? "1F" : ""))));
  // etykiety z projektu, a puste etykiety USSA dalej na liście części – fronty bez napisu dostaną pustą etykietę
  const fromProj = state.labels.some(l => l.src);
  const blankNote = fromProj && state.blankLabels !== false ? el("div", { class: "lab-note" },
    el("span", {}, tr("Puste etykiety USSA są nadal na liście części – fronty, którym nie wpiszesz napisu, dostaną pustą etykietę.")),
    el("button", { class: "small", onclick: () => { state.blankLabels = false; update(); toast(tr("Wyłączono puste etykiety na liście części")); } },
      tr("Nie drukuj pustych"))) : null;
  const tools = el("div", { class: "row" },
    el("button", { class: "small", title: tr("Po jednej etykiecie na każdy front szuflady i skrzynki w projekcie, z opisem miejsca. Kolejne kliknięcie dopisuje tylko nowe fronty."),
      onclick: labFromProject }, tr("Etykiety z projektu")),
    el("button", { class: "small", onclick: () => { state.labels.push(labNew({ rodzaj: cur.rodzaj, symbol: cur.symbol, h: cur.h, styl: cur.styl, ...scopeTag() })); state.labelCur = state.labels.length - 1; rerender(); } }, tr("+ Nowa")),
    el("button", { class: "small", onclick: () => { state.labels.splice(state.labelCur + 1, 0, labNew(cur)); state.labelCur++; rerender(); } }, tr("Duplikuj")),
    el("button", { class: "small", disabled: inCnt < 2, onclick: () => {
      histBreak(); state.labels.splice(state.labelCur, 1); state.labelCur = Math.max(0, state.labelCur - 1); rerender(); toast(tr("Usunięto etykietę"));
    } }, tr("Usuń")),
    outCnt ? el("span", { class: "hint" }, tr("Etykiety innych zestawów i całego projektu: {n} – widać je w zakresie „Cały projekt”.", { n: outCnt })) : null);
  // edycja zaznaczonej
  const txt = el("textarea", { class: "lab-text", rows: 3, maxlength: 60, placeholder: tr("np. M3 × 12 – Enter albo | dzieli na linie"),
    oninput: e => { cur.tekst = e.target.value; clearTimeout(LAB.timer); LAB.timer = setTimeout(rerender, 400); } });
  txt.value = cur.tekst || "";
  const row = (label, ...kids) => el("label", { class: "bin-row" }, el("span", {}, label), ...kids);
  const form = el("div", { class: "bin-form" },
    cur.gdzie ? el("p", { class: "hint" }, tr("Miejsce: {g}", { g: cur.gdzie })) : null,
    row(tr("etykieta"), sel(cur.rodzaj, LAB_KINDS.map(([k, t]) => [k, tr(t)]), ch("rodzaj"))),
    el("div", {}, el("div", {}, tr("napis")), txt),
    // symbol: obrazek wybranego i przycisk siatki wyboru (grupy z nagłówkami)
    row(tr("symbol"), el("span", { class: "row" }, q.symbol && labSymPolys(q.symbol) ? labSymSvg(labSymPolys(q.symbol)) : el("span", { class: "hint" }, tr("bez symbolu")),
      el("button", { class: "small", onclick: e => { e.preventDefault(); LAB.picker = !LAB.picker; rerender(); } }, LAB.picker ? tr("Zamknij") : tr("Wybierz…")))),
    LAB.picker ? labPicker(q.symbol, k => { cur.symbol = k; LAB.picker = false; rerender(); }) : null,
    row(tr("styl napisu"), sel(q.styl, [["wypukly", tr("wypukły – druk licem do góry")], ["wklesly", tr("wklęsły – druk licem do stołu")],
      ["wpuszczony", tr("wpuszczony – drugi filament, druk licem do stołu")]], ch("styl"))),
    q.styl === "wpuszczony" ? row(tr("kolor napisu (wszystkie wpuszczone)"), sel(state.labelTextColor || "#000000", filOpts(state.labelTextColor || "#000000"),
      v => { state.labelTextColor = v; rerender(); })) : null,
    row(q.styl === "wypukly" ? tr("wysokość napisu") : q.styl === "wklesly" ? tr("głębokość napisu") : tr("grubość napisu"),
      sel(String(q.h), (q.styl === "wypukly" ? ["0.4", "0.6", "0.8"] : ["0.4", "0.6"])
        .map(h => [h, (+h).toLocaleString(locale()) + " mm"]), v => { cur.h = +v; rerender(); })),
    row(tr("ilość"), num(+cur.qty || 0, ch("qty"), 0, 999)));
  // podgląd
  const v = labView(q);
  const prev = el("div", { class: "lab-prev" },
    v.status === "ok" ? labSvg(v.r, 520, q.styl === "wklesly", q.styl) : v.status === "err" ? el("p", { class: "err" }, v.err) : el("p", { class: "hint" }, tr("Generuję podgląd…")),
    v.status === "ok" && q.styl === "wpuszczony" ? el("p", { class: "hint" }, tr("Widok jak we froncie. Wysokość liter: {h} mm. Dwie części: lico z wyciętym napisem i litery ({z} mm) równo z licem, licem do stołu. W 3MF etykieta to jeden obiekt z dwóch części; w projekcie Bambu Studio litery mają własny filament w kolorze napisu. Pliki STL – dwa na etykietę.",
      { h: v.r.letter.toLocaleString(locale()), z: q.h.toLocaleString(locale()) })) :
    v.status === "ok" ? el("p", { class: "hint" }, q.styl === "wklesly"
      ? tr("Widok jak we froncie. Wysokość liter: {h} mm. Napis wycięty na {z} mm w licu; plik leży licem do stołu – gładkie lico i ostre krawędzie liter (jeden kolor).",
        { h: v.r.letter.toLocaleString(locale()), z: q.h.toLocaleString(locale()) })
      : tr("Widok jak we froncie. Wysokość liter: {h} mm. Napis {z} mm nad etykietą – w slicerze zmień filament na warstwie od {t} mm (drugi kolor napisu).",
        { h: v.r.letter.toLocaleString(locale()), z: q.h.toLocaleString(locale()), t: v.r.top.toLocaleString(locale(), { minimumFractionDigits: 1 }) })) : null,
    ...(v.status === "ok" ? v.r.warnings.map(w => el("p", { class: "err" }, tr(w))) : []));
  // pobieranie i lista części
  const wszystkie = state.labels.filter(l => !labEmpty(l) && +l.qty > 0);
  const ready = wszystkie;
  const items = () => ready.map(l => { const q = labParams(l), f = labFileOf(q), est = estimate(f), color = partColor(f);
    return { file: f, qty: +l.qty, label: l.tekst || l.symbol, sec: est ? est.sec : 0, g: est ? est.g : 0, gen: q,
      ...(color ? { color, color_name: colorName(color) } : {}), ...labTextColor(q) }; });
  const j = state.job, pr = PRINTERS[j.printer];
  const dl = el("div", { class: "row", style: "margin-top:8px" },
    el("button", { class: "primary", disabled: !ready.length, onclick: () => binPost("/api/pojemnik/3mf",
      { name: tr("etykiety"), items: items(), opts: { printer: j.printer, bed: j.bed, gap: j.gap, project: !!(j.project && pr && pr.bambu) } }) }, tr("Pobierz 3MF")),
    // ZIP – wszystkie, także wpuszczone (lico i napis jako osobne pliki)
    el("button", { disabled: !wszystkie.length, onclick: () => binPost("/api/pojemnik/zip",
      { name: tr("etykiety"), bins: wszystkie.map(l => ({ p: labParams(l), qty: +l.qty })) }, tr("etykiety") + ".zip") }, tr("Pliki STL (ZIP)")),
    el("button", { disabled: labEmpty(cur), onclick: () => binPost("/api/pojemnik/stl", q, q.styl === "wpuszczony" ? null : labName(q) + ".stl") }, tr("STL tej etykiety")));
  box.replaceChildren(el("div", { class: "bin-wrap" },
    el("div", { class: "bin-left" }, el("h3", {}, tr("Etykiety z napisem")), list, tools, blankNote, form),
    el("div", { class: "bin-view" }, prev, dl,
      el("div", { class: "row lab-wrap" }, chk(state.labelsBom !== false, tr("na listę części – zamiast tylu samo pustych etykiet"), v => { state.labelsBom = v; rerender(); })),
      q.styl !== "wypukly" ? null : el("p", { class: "hint" }, tr("Etykieta to plik USSA z Twojej biblioteki (Label albo Label for Sustainers) z wypukłym napisem i symbolem. 3MF: wszystkie etykiety ułożone na płytach drukarki z „Przygotuj wydruk”. Drukuj licem do góry; drugi kolor – zmiana filamentu na wysokości wierzchu etykiety.")))),
    typeof logoPanel === "function" ? logoPanel() : null);  // logo na frontach (logo.js)
  if (pisze) { txt.focus(); txt.setSelectionRange(pisze[0], pisze[1]); }
}
