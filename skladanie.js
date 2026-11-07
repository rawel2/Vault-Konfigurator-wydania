// Zakładka „Składanie” (od 2026-11-03, prośba użytkownika – pomysł po przeglądzie Vault-Workbench): kroki składania
// każdego zestawu od spodu – podstawa, warstwy (moduł szuflad, każda szuflada, każda skrzynka), dach, tył (kręgosłup,
// pegboard, uchwyt ścienny) i uchwyty – z częściami i śrubami na jedną wieżę i odnośnikami do stron instrukcji USSA.
// Części liczą te same funkcje co lista części (addBase, addDrawerModule, addDrawer, addSustainer, addRoof, addLayerMods,
// addHandleStatic, addHandlePull z index.html) z ilością 1, więc kroki zgadzają się z listą części. Etykieta z napisem
// przypisana do frontu (labForFront) zastępuje pustą, pojemniki – liczba z układu tej szuflady, front z logo (logo.js) –
// ten sam co na liście części, wkład na głowice w szufladzie S – też.
// Zrobione kroki: state.asmDone { "<id zestawu>|<krok>": true } – zapisywane z projektem.
// Wczytywany po etykiety.js (labForFront, labPlain, labFileOf) i pojemniki.js (binKey, binInstances).

// etykieta frontu w kroku: z napisem zamiast pustej USSA, bez niej, gdy puste etykiety są wyłączone
function asmLabel(b, key, rodzaj) {
  const plain = findAll(labPlain(rodzaj))[0];
  const q = labForFront(key, rodzaj);
  if (q && q !== "none") {
    if (plain) b.parts.delete(plain);
    b.addGen("Etykiety z napisem", tr("etykieta z napisem „{t}”", { t: String(q.tekst || "").replace(/\n|\|/g, " / ") || q.symbol }), labFileOf(q), 1, q);
  } else if (state.blankLabels === false && plain) b.parts.delete(plain);
}

// pojemniki gridfinity z układu tej szuflady albo skrzynki (tylko mieszczące się w siatce – jak lista części)
function asmBins(key, inst) {
  const s = Array.isArray(state.binSets) && state.binSets.find(s => s.key === key);
  if (!s || s.off || !s.items.length) return [];
  const t = inst.get(key), n = t ? s.items.filter(it => binInside(it, binTargetFix(t))).length : 0;
  return n ? [tr("pojemniki gridfinity: {n} – układ w zakładce „Pojemniki gridfinity”", { n })] : [];
}

// wkład na głowice na całe pudełko S (pojemniki.js – glowParams) – jak na liście części
function asmGlow(b, key, fam, d, ins) {
  if (ins !== "glowice" || fam !== "S" || typeof glowParams !== "function") return;
  const p = glowParams(key, d);
  if (p.glowice.length || p.skarpety) b.addGen("Wkłady", tr("wkład na głowice Bambu Lab"), binFileOf(p), 1, p);
}

function asmSteps(st, inst) {
  normalizeStack(st);
  const d = st.depth, out = [];
  const step = (id, title, fill, extra = []) => {
    const b = new Bom();
    fill(b);
    if (b.parts.size || b.hw.size || extra.length) out.push({ id, title, b, extra });
  };
  step("base", tr("Podstawa"), b => addBase(b, st, 1));
  st.layers.forEach((l, li) => {
    const fams = FAMILIES[l.layout], nm = li === 0 ? tr("Warstwa 1 (spód)") : tr("Warstwa {n}", { n: li + 1 });
    const lay = { SS: `2× S${d}`, SM: `S${d} + M${d}`, L2: `L${d}²`, XL2: `XL${d}²` }[l.layout] || l.layout + d;
    if (l.type === "D") step("m" + l.id, nm + " · " + tr("moduł szuflad {lay} {h}F", { lay, h: l.height }), b => addDrawerModule(b, 1, l, d));
    l.cols.forEach((c, ci) => {
      const fam = fams[ci], side = l.cols.length > 1 ? (ci === 0 ? tr("lewa") : tr("prawa")) : "";
      if (l.type === "D") c.pattern.forEach((h, k) => {
        const key = binKey(st, l, ci, k);
        const what = tr("szuflada {fam}{d} {h}F", { fam, d, h }) + (c.pattern.length > 1 ? ", " + tr("szuflada {k} od góry", { k: k + 1 }) : "");
        step(key, nm + " · " + [what, side].filter(Boolean).join(", "),
          b => { addDrawer(b, 1, fam, d, h, c.pattern.length > 1, c, k); asmLabel(b, key, "d"); if (typeof logoSwap === "function") logoSwap(b); asmGlow(b, key, fam, d, insOf(c, k)); }, asmBins(key, inst));
      });
      else {
        const key = binKey(st, l, ci, 0);
        step(key, nm + " · " + [tr("skrzynka {fam}{d} {h}F", { fam, d, h: l.height }), side].filter(Boolean).join(", "),
          b => { addSustainer(b, 1, fam, d, l.height, c); asmLabel(b, key, l.height === 1 ? "s" : "d"); if (typeof logoSwap === "function") logoSwap(b); }, asmBins(key, inst));
      }
    });
  });
  step("roof", tr("Dach"), b => addRoof(b, st, 1));
  step("back", tr("Tył wieży: kręgosłup, pegboard, uchwyt ścienny"), b => st.layers.forEach(l => addLayerMods(b, st, l, 1)));
  step("handles", tr("Uchwyty"), b => { addHandleStatic(b, st, 1); addHandlePull(b, st, 1); });
  return out;
}

function asmPart(e) {
  const name = e.missing ? e.file.slice(1) : e.file.split("/").pop();
  // najechanie na nazwę – miniatura części (jak w „Do druku”)
  const link = e.missing || WEB ? el("span", {}, name) : e.gen ? (THUMB.gen.set(e.file, e.gen), el("span", { class: "asm-file", "data-thumb": e.file }, name))
    : el("a", { class: "asm-file", href: fileUrl(e.file), target: "_blank", "data-thumb": e.file }, name);
  return el("li", { class: e.missing ? "missing" : "" }, el("span", { class: "q" }, "×" + e.qty), " ",
    el("span", {}, [...e.labels].join(", ")), " ", link,
    [...e.notes].map(n => el("span", { class: "note" }, " – " + n)), e.gen ? null : docLinks(partRefs(e.file)));
}

function renderAsm(box) {
  state.asmDone = state.asmDone || {};
  if (state.binVer !== 2 && typeof binMigrate === "function" && Array.isArray(state.binSets)) binMigrate();
  const inst = new Map(binInstances().map(x => [x.key, x.t]));
  const every = state.stacks.map(st => ({ st, steps: asmSteps(st, inst) }));
  const idsAll = every.flatMap(({ st, steps }) => steps.map(s => st.id + "|" + s.id));
  // znaczniki usuniętych kroków (zmieniony projekt) nie są potrzebne – liczone z całego projektu
  for (const k of Object.keys(state.asmDone)) if (!idsAll.includes(k)) delete state.asmDone[k];
  // zakres zakładek: kroki wybranego zestawu albo wszystkich
  const all = every.filter(({ st }) => scopeStacks().includes(st));
  const ids = all.flatMap(({ st, steps }) => steps.map(s => st.id + "|" + s.id));
  const done = ids.filter(k => state.asmDone[k]).length;
  const head = el("div", { class: "row" }, el("h3", { style: "margin:0" }, tr("Składanie")),
    el("progress", { max: ids.length || 1, value: done }), el("span", {}, tr("Zrobione kroki: {done} z {n}", { done, n: ids.length })),
    done ? el("button", { class: "small", onclick: () => { histBreak(); for (const k of ids) delete state.asmDone[k]; save(); renderResult(); toast(tr("Wyczyszczono zaznaczone kroki")); } }, tr("Wyczyść zaznaczenia")) : null);
  const stacks = all.map(({ st, steps }) => el("section", { class: "asm-stack" },
    el("h4", {}, st.name + (st.qty > 1 ? " – " + tr("kroki dla jednej wieży, powtórz {n}×", { n: st.qty }) : "")),
    el("ol", { class: "asm" }, steps.map(s => {
      const k = st.id + "|" + s.id, on = !!state.asmDone[k];
      return el("li", { class: "asm-step" + (on ? " done" : "") },
        el("label", { class: "asm-title" }, el("input", { type: "checkbox", checked: on, onchange: e => {
          if (e.target.checked) state.asmDone[k] = true; else delete state.asmDone[k];
          save(); renderResult();
        } }), " ", s.title),
        el("ul", { class: "asm-parts" }, [...s.b.parts.values()].map(asmPart),
          [...s.b.hw.values()].map(h => el("li", { class: "hw" }, el("span", { class: "q" }, "×" + h.qty), " ", h.name,
            h.notes.size ? el("span", { class: "used" }, " – " + [...h.notes].join(", ")) : null, docLinks([...(h.refs || []), ["01", 3]]))),
          s.extra.map(t => el("li", { class: "hint" }, t))));
    }))));
  box.replaceChildren(head,
    el("p", { class: "hint" }, tr("Kroki od spodu wieży: części i elementy niedrukowane na jedną wieżę, przy częściach strony instrukcji USSA (gdy PDF-y są w bibliotece). Zaznaczone kroki zapisują się z projektem.")),
    ...stacks, nextSteps("print", "hw"));
}
