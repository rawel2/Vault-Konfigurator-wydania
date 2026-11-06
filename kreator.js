"use strict";
// Kreator wieży (od 2026-11-03, praca nad spójnością interfejsu – prośba użytkownika „podpowiedzi, wizardy”; wzorem
// konfiguratora USSA: „Choose your first layer… each confirmed layer becomes the foundation for the next” i paska kroków
// Vault-Workbench): szablon → rozmiar → warstwy od spodu → góra i dodatki → podsumowanie. Pracuje na kopii zestawu
// (KR.st), po prawej podgląd na żywo (renderPreview z index.html) i szacunek (addStack + withEstimates). Na końcu zestaw
// trafia do projektu – jako nowy albo zamiast nietkniętego „Zestaw 1”. Funkcje z index.html są używane dopiero przy otwarciu.

const KR = { st: null, step: 0, tpl: "", box: null };
const krSteps = () => [tr("Szablon"), tr("Rozmiar"), tr("Warstwy"), tr("Góra i dodatki"), tr("Podsumowanie")];

// warstwy szablonu od spodu: [typ, układ, wysokość, fronty (szuflady) | wnętrze (skrzynki L/XL)]
const krTemplates = () => [
  { id: "empty", name: tr("Pusta wieża"), desc: tr("Jedna warstwa szuflad – resztę dodasz sam."), width: "S", depth: 3,
    layers: [["D", "S", 1]], roof: "grid", mods: {} },
  { id: "desk", name: tr("Biurko"), desc: tr("Niska wieża M z szufladami i płaskim blatem."), width: "M", depth: 4,
    layers: [["D", "M", 2, [1, 1]], ["D", "M", 1]], roof: "table", mods: {} },
  { id: "workshop", name: tr("Warsztat na kółkach"), desc: tr("Wysoka wieża L na kołach, z kręgosłupem, rączką i dachem z kratkami."), width: "L", depth: 5,
    layers: [["D", "L", 4, [2, 1, 1]], ["D", "L2", 1], ["D", "L", 2, [1, 1]], ["D", "SS", 1]], roof: "grid", topHandle: true,
    mods: { base: true, wheels: true, feet: true, backbone: "ded", handlePull: true } },
  { id: "toolbox", name: tr("Skrzynka narzędziowa"), desc: tr("Szuflady na dole, na górze skrzynka z wiekiem i przegródkami, uchwyt stały."), width: "L", depth: 4,
    layers: [["D", "L", 2, [1, 1]], ["S", "L", 2, "dividers"]], roof: "grid", mods: { base: true, backbone: "ded", handleStatic: true } },
  { id: "under", name: tr("Pod blat"), desc: tr("Szuflady przykręcane pod blat biurka (dach Under Table Mount)."), width: "M", depth: 4,
    layers: [["D", "M", 1], ["D", "M", 1]], roof: "under", mods: {} },
];

function krFromTemplate(t) {
  // numer domyślnej nazwy: zestaw zastąpi nietknięty jedyny „Zestaw 1” albo dojdzie jako kolejny; szablon – jego nazwa
  const st = newStack(state.stacks.length + (krPristine(cur()) && state.stacks.length === 1 ? 0 : 1));
  if (t.id !== "empty") st.name = t.name;
  st.depth = t.depth; st.roof = t.roof; st.topHandle = !!t.topHandle;
  Object.assign(st.mods, t.mods);
  st.layers = t.layers.map(([type, layout, h, x]) => {
    const l = newLayer(type, layout, h);
    if (type === "D" && Array.isArray(x)) l.cols.forEach(c => c.pattern = x.slice());
    if (type === "S" && typeof x === "string") l.cols.forEach(c => c.sInt = x);
    return l;
  });
  normalizeStack(st);
  return st;
}

// szerokość wieży: warstwy innej szerokości dostają pełny moduł nowej szerokości (bez zmiany typu i wysokości)
function krSetWidth(W) {
  KR.st.layers.forEach((l, i) => {
    if (LAYOUT_WIDTH[l.layout] !== W) { l.layout = W; l.cols = FAMILIES[W].map(() => newCol(l.height)); }
  });
  if (KR.st.roof === "heavy" && W !== "L" && W !== "XL") KR.st.roof = "grid";
  normalizeStack(KR.st);
}

// czy zestaw jest nietknięty (domyślny „Zestaw n” z jedną warstwą S 1F) – wtedy kreator może go zastąpić
function krPristine(st) {
  if (!st || st.layers.length !== 1 || st.qty !== 1) return false;
  const l = st.layers[0], m = st.mods;
  return l.type === "D" && l.layout === "S" && l.height === 1 && insOf(l.cols[0], 0) === "none" && !l.cols[0].ins && st.depth === 3 && st.roof === "grid"
    && !st.topHandle && !m.base && m.backbone === "none" && !m.handleStatic && !m.handlePull && !m.wall;
}

function openWizard() {
  KR.st = krFromTemplate(krTemplates()[0]); KR.tpl = "empty"; KR.step = 0;
  if (KR.box) KR.box.remove();
  KR.box = el("div", { class: "wiz-overlay", onclick: e => { if (e.target === KR.box) closeWizard(); } });
  document.body.append(KR.box);
  krRender();
}
function closeWizard() { if (KR.box) { KR.box.remove(); KR.box = null; } }
document.addEventListener("keydown", e => { if (e.key === "Escape" && KR.box) closeWizard(); });

function krRender() {
  if (!KR.box) return;
  const st = KR.st, W = baseWidth(st), go = s => { KR.step = s; krRender(); };
  const STEPS = krSteps();
  const steps = el("ol", { class: "wiz-steps" }, STEPS.map((s, i) => el("li", { class: i === KR.step ? "on" : i < KR.step ? "done" : "" },
    el("button", { onclick: () => go(i) }, el("span", { class: "n" }, String(i + 1)), " " + s))));
  const body = el("div", { class: "wiz-body" });
  const chg = () => { normalizeStack(st); krRender(); };

  if (KR.step === 0) {
    body.append(el("h3", {}, tr("Od czego zaczynasz?")),
      el("p", { class: "hint" }, tr("Wybierz gotowy pomysł i zmień go w kolejnych krokach – albo zacznij od pustej wieży.")),
      el("div", { class: "wiz-cards" }, krTemplates().map(t => {
        const prev = renderPreview(krFromTemplate(t));
        prev.querySelectorAll(".viz-open").forEach(b => b.remove());
        return el("button", { class: "wiz-card" + (KR.tpl === t.id ? " on" : ""), onclick: () => { KR.st = krFromTemplate(t); KR.tpl = t.id; go(1); } },
          el("b", {}, t.name), el("span", { class: "hint" }, t.desc), el("span", { class: "wiz-mini" }, prev));
      })));
  } else if (KR.step === 1) {
    body.append(el("h3", {}, tr("Szerokość wieży")),
      el("div", { class: "wiz-cards wide" }, ["S", "M", "L", "XL"].map(w => el("button", { class: "wiz-card" + (W === w ? " on" : ""), onclick: () => { krSetWidth(w); krRender(); } },
        el("b", {}, w), el("span", { class: "hint" }, Math.round(WIDTH_MM[w]) + " mm"),
        el("span", { class: "hint" }, { S: tr("wąska – pojedyncze szuflady"), M: tr("średnia"), L: tr("szeroka – też 2× S obok siebie"), XL: tr("najszersza – tylko warstwy 1F") }[w])))),
      el("h3", {}, tr("Głębokość")),
      el("div", { class: "row" }, sel(st.depth, [3, 4, 5, 6, 7].map(d => [d, `${d} (${d * 42} mm)`]), v => { st.depth = +v; chg(); }),
        el("span", { class: "hint" }, tr("Głębokość wszystkich modułów wieży w kratkach gridfinity po 42 mm. Moduł jest o 20 mm dłuższy (np. 4 → 188 mm)."))),
      el("h3", {}, tr("Nazwa i ilość")),
      el("div", { class: "row" }, el("input", { type: "text", value: st.name, onchange: e => { st.name = e.target.value || st.name; } }),
        el("label", {}, lab(tr("Ilość:"), tr("Ile takich samych wież budujesz – lista części mnoży wszystko przez tę liczbę.")), " ",
          num(st.qty, v => { st.qty = Math.max(1, v); krRender(); }, 1))));
  } else if (KR.step === 2) {
    body.append(el("h3", {}, tr("Warstwy od spodu")),
      el("p", { class: "hint" }, tr("Każda warstwa stoi na poprzedniej. Szerokość wieży: {W} – wyżej tylko układy tej szerokości.", { W })));
    const list = el("div", { class: "wiz-layers" });
    st.layers.forEach((l, i) => {
      const layouts = allowedLayouts(l.type, i ? W : null).filter(x => LAYOUT_WIDTH[x] === W);
      const pats = l.type === "D" ? allowedPatterns("D", l.height) : [];
      list.append(el("div", { class: "wiz-layer" },
        el("span", { class: "idx" }, String(i + 1)),
        sel(l.type, [["D", tr("Szuflady")], ["S", tr("Skrzynki (Sustainers)")]], v => { l.type = v; chg(); }),
        sel(l.layout, layouts.map(x => [x, layoutLabel(x)]), v => { l.layout = v; l.cols = FAMILIES[v].map(() => newCol(l.height)); chg(); }),
        sel(l.height, allowedHeights(l.layout).map(h => [h, h + "F"]), v => { l.height = +v; l.cols.forEach(c => c.pattern = [l.height]); chg(); }),
        pats.length > 1 ? sel(l.cols[0].pattern.join(","), pats.map(p => [p.join(","), patternLabel(p)]), v => { l.cols.forEach(c => c.pattern = v.split(",").map(Number)); chg(); }) : null,
        el("span", { class: "tools" },
          el("button", { class: "small", title: tr("w górę"), disabled: i === st.layers.length - 1, onclick: () => { [st.layers[i], st.layers[i + 1]] = [st.layers[i + 1], st.layers[i]]; chg(); } }, "▲"),
          el("button", { class: "small", title: tr("w dół"), disabled: i === 0, onclick: () => { [st.layers[i], st.layers[i - 1]] = [st.layers[i - 1], st.layers[i]]; chg(); } }, "▼"),
          el("button", { class: "small", title: tr("usuń"), disabled: st.layers.length === 1, onclick: () => { st.layers.splice(i, 1); chg(); } }, "✕"))));
    });
    const add = (type, h) => { st.layers.push(newLayer(type, W === "XL" ? "XL" : W, W === "XL" ? 1 : h)); chg(); };
    body.append(list, el("div", { class: "row wiz-add" }, el("span", { class: "hint" }, tr("Dodaj na górze:")),
      [1, 2, 4].filter(h => W !== "XL" || h === 1).map(h => el("button", { class: "small", onclick: () => add("D", h) }, tr("szuflady {h}F", { h }))),
      [1, 2, 4].filter(h => W !== "XL" || h === 1).map(h => el("button", { class: "small", onclick: () => add("S", h) }, tr("skrzynka {h}F", { h })))),
      el("p", { class: "hint" }, tr("Wkłady gridfinity, przegródki skrzynek i podział frontów każdej kolumny ustawisz później w edytorze zestawu.")));
  } else if (KR.step === 3) {
    const top = st.layers[st.layers.length - 1], md = st.mods, setm = k => v => { md[k] = v; chg(); }, sust = hasSust(st), bbOk = backOn(st);
    body.append(el("h3", {}, tr("Góra")));
    if (top.type === "D") {
      const roofs = Object.entries(ROOFS).filter(([k]) => k !== "heavy" || W === "L" || W === "XL").map(([k, t]) => [k, tr(t)]);
      body.append(el("div", { class: "row" }, lab(tr("Dach:"), tr("Grid – kratki gridfinity na wierzchu, Table – płaski blat, Bowl – misa na drobiazgi, Under Table Mount – mocowanie pod blatem, Heavyweight – wzmocniony, z rączką (tylko L i XL).")),
        sel(st.roof, roofs, v => { st.roof = v; chg(); }),
        chk(st.roof === "grid" && st.topHandle, tr("uchwyt górny (Top Handle)"), v => { st.topHandle = v; chg(); }, st.roof !== "grid")));
    } else body.append(el("p", { class: "hint" }, tr("Górna warstwa to skrzynka – jej wieko zamyka wieżę, dach szuflad nie jest potrzebny.")));
    // wkłady gridfinity we wszystkich szufladach / skrzynkach (pod pojemniki z zakładki „Pojemniki gridfinity”)
    const dCols = st.layers.filter(l => l.type === "D").flatMap(l => l.cols), sCols = st.layers.filter(l => l.type === "S").flatMap(l => l.cols);
    if (dCols.length || sCols.length) body.append(el("h3", {}, tr("Wnętrze")),
      el("div", { class: "row" },
        dCols.length ? chk(dCols.every(c => c.pattern.every((_, k) => insGrid(insOf(c, k)))), tr("wkład gridfinity we wszystkich szufladach"), v => { dCols.forEach(c => { c.insert = v ? "grid" : "none"; delete c.ins; }); chg(); }) : null,
        sCols.length ? chk(sCols.every(c => c.grid), tr("wkład gridfinity we wszystkich skrzynkach"), v => { sCols.forEach(c => c.grid = v); chg(); }) : null,
        help(tr("Płyta gridfinity na dnie pudełka – na niej stoją pojemniki gridfinity (zakładka „Pojemniki gridfinity”)."))));
    body.append(el("h3", {}, tr("Podstawa")),
      el("div", { class: "row" }, el("span", {}, chk(md.base, tr("podstawa (Base)"), setm("base")), help(tr("Podstawa pod wieżę z prętem M16 – do niej montuje się koła i stopkę."))),
        chk(md.base && md.wheels, tr("koła i stopka"), v => { md.wheels = md.feet = v; chg(); }, !md.base),
        el("span", { title: md.base && !md.wheels && !md.feet ? "" : tr("Kółka meblowe stoją tam, gdzie koła i stopka – zaznacz podstawę i odznacz koła i stopkę.") },
          chk(castersOn(md), tr("kółka meblowe (Casters Mode)"), setm("casters"), !md.base || md.wheels || md.feet))),
      el("h3", {}, tr("Tył wieży")),
      el("div", { class: "row" }, lab(tr("Kręgosłup:"), tr("Listwa z tyłu każdej warstwy, która usztywnia wieżę. Przykręca się do niej pegboard i uchwyt wysuwany. Dedykowany – na szerokość wieży, uniwersalny – dwa klocki przy bokach.")),
        sel(md.backbone, [["none", tr("brak")], ["ded", tr("dedykowany {W}", { W })], ["uni", tr("uniwersalny")]], setm("backbone"))),
      // skrzynka w wieży: kręgosłup tylko pod pierwszą skrzynką, bez uchwytu wysuwanego i ściennego (pomiar 2026-11-06, index.html)
      sust && md.backbone !== "none" ? el("p", { class: "hint" }, bbLayers(st)
        ? tr("Kręgosłup tylko na warstwach szuflad pod pierwszą skrzynką – zawiasy skrzynki wystają za moduł, a wieko odchyla się do tyłu razem z górą wieży.")
        : tr("Kręgosłup nie mieści się przy skrzynce na spodzie wieży – zawiasy skrzynki wystają za moduł; jest pomijany.")) : null,
      el("div", { class: "row" }, el("span", { title: bbOk ? "" : tr("Uchwyt stały przykręca się do kręgosłupa – wybierz kręgosłup.") },
          chk(md.handleStatic && bbOk, tr("uchwyt stały"), setm("handleStatic"), !bbOk)),
        el("span", { title: sust ? tr("Pręty uchwytu wysuwanego idą przez całą wysokość wieży – przy skrzynce przeszkadzają zawiasom i wieku; tylko w wieży bez skrzynek.") : "" },
          chk(md.handlePull && md.backbone !== "none" && !sust, tr("uchwyt wysuwany"), setm("handlePull"), md.backbone === "none" || sust)),
        el("span", { title: sust ? tr("Uchwyt ścienny tylko w wieży bez skrzynek – zawiasy skrzynki wchodzą w płytę uchwytu, a wieko nie otworzy się przy ścianie.")
            : md.backbone === "none" ? "" : tr("Uchwyt ścienny przykręca się do tyłu modułów w miejscu kręgosłupa – wybierz kręgosłup „brak”.") },
          chk(wallOn(st), tr("uchwyty ścienne"), setm("wall"), md.backbone !== "none" || sust)),
        help(tr("Uchwyt stały – na tyle wieży; wysuwany – rączka na prętach M16 przez kręgosłup (jak w walizce); ścienne – do zawieszenia warstw na ścianie."))));
  } else {
    // podsumowanie: lista części samego tego zestawu (bez pojemników, etykiet i dodatkowych plików projektu)
    const b = new Bom();
    addStack(b, st);
    const parts = sortedParts(b), tot = withEstimates(parts), pieces = parts.reduce((n, e) => n + e.qty, 0);
    const kinds = st.layers.map(l => `${layoutLabel(l.layout)} ${l.height}F ${l.type === "D" ? tr("szuflady") : tr("skrzynka")}`);
    body.append(el("h3", {}, tr("Podsumowanie")),
      el("p", {}, el("b", {}, st.name), ` · ×${st.qty} · ${baseWidth(st)}${st.depth} · ${layersText(st.layers.length)}`),
      el("div", { class: "hint" }, tr("Warstwy od spodu")),
      el("ol", { class: "wiz-sum" }, kinds.map(k => el("li", {}, k))),
      el("p", {}, tr("{files} różnych plików · {pieces} wydruków (plików do wrzucenia na stół) · {hw} pozycji niedrukowanych", { files: parts.length, pieces, hw: b.hw.size })),
      PRINT ? el("p", {}, el("b", {}, tr("≈ {time} druku · ≈ {mass} filamentu", { time: fmtTime(tot.sec), mass: fmtG(tot.g) }))) : null,
      el("p", { class: "hint" }, tr("Po utworzeniu zestaw możesz dalej zmieniać w edytorze: wkłady i pojemniki gridfinity w szufladach, przegródki skrzynek, pegboard. Cofnij (Ctrl+Z) wycofa utworzenie.")));
  }

  const replace = krPristine(cur()) && state.stacks.length === 1;
  const foot = el("div", { class: "wiz-foot" },
    el("button", { onclick: closeWizard }, tr("Anuluj")),
    el("span", { style: "flex:1" }),
    KR.step > 0 ? el("button", { onclick: () => go(KR.step - 1) }, "‹ " + tr("Wstecz")) : null,
    KR.step < STEPS.length - 1 ? el("button", { class: "primary", onclick: () => go(KR.step + 1) }, tr("Dalej") + " ›")
      : el("button", { class: "primary", onclick: () => krFinish(replace) }, replace ? tr("Utwórz (zamiast „{name}”)", { name: cur().name }) : tr("Utwórz zestaw")));
  const prev = renderPreview(st);
  prev.querySelectorAll(".viz-open").forEach(b => b.remove());
  KR.box.replaceChildren(el("div", { class: "wiz", role: "dialog", "aria-modal": "true", "aria-label": tr("Kreator wieży") },
    el("div", { class: "wiz-head" }, el("h2", {}, tr("Kreator wieży")), el("button", { class: "small", title: tr("Zamknij"), onclick: closeWizard }, "✕")),
    steps,
    el("div", { class: "wiz-main" }, body, el("div", { class: "wiz-side" }, el("div", { class: "hint" }, tr("Podgląd")), prev,
      el("div", { class: "hint" }, `${baseWidth(st)}${st.depth} · ${layersText(st.layers.length)} · ${Math.round(WIDTH_MM[baseWidth(st)])} × ${st.depth * 42 + 20} mm`))),
    foot));
  // miniatury szablonów: skala tak, by cała wieża mieściła się w polu karty
  requestAnimationFrame(() => KR.box && KR.box.querySelectorAll(".wiz-mini").forEach(m => {
    const p = m.firstElementChild;
    if (p && p.offsetHeight) p.style.transform = `scale(${Math.min(0.8, (m.clientHeight - 2) / p.offsetHeight, (m.clientWidth - 4) / p.offsetWidth)})`;
  }));
}

function krFinish(replace) {
  const st = KR.st;
  normalizeStack(st);
  histBreak();
  if (replace) state.stacks[state.current] = st;
  else { state.stacks.push(st); state.current = state.stacks.length - 1; }
  state.welcomeOff = true;
  closeWizard();
  update();
  toast(tr("Utworzono „{name}”", { name: st.name }));
}
