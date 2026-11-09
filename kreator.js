"use strict";
// Kreator wieży (od 2026-11-03, praca nad spójnością interfejsu – prośba użytkownika „podpowiedzi, wizardy”; wzorem
// konfiguratora USSA: „Choose your first layer… each confirmed layer becomes the foundation for the next” i paska kroków
// Vault-Workbench): szablon → rozmiar → warstwy od spodu → góra i dodatki → podsumowanie. Pracuje na kopii zestawu
// (KR.st), po prawej podgląd na żywo (renderPreview z index.html) i szacunek (addStack + withEstimates). Na końcu zestaw
// trafia do projektu – jako nowy albo zamiast nietkniętego „Zestaw 1”. Funkcje z index.html są używane dopiero przy otwarciu.

// key, keyPrint – kluczyk szuflad wybrany w kreatorze (ustawienie całego projektu – zapisywane dopiero przy „Utwórz”)
// made – id zestawu utworzonego w kroku „Podsumowanie”; dalej przewodnik prowadzi przez kolory, dodatki, drukarkę, wydruk
// i składanie (prośba użytkownika 2026-11-07: „pełna ścieżka”) – te kroki zmieniają już prawdziwy projekt
const KR = { st: null, step: 0, tpl: "", box: null, key: "normal", keyPrint: true, made: null, colorPick: "", labMade: 0 };
const KR_BUILD = 5;  // kroki 0–4 – budowa wieży, 5–9 – po utworzeniu zestawu
const krSteps = () => [tr("Szablon"), tr("Rozmiar"), tr("Warstwy"), tr("Góra i dodatki"), tr("Podsumowanie"),
  tr("Kolory"), tr("Dodatki"), tr("Drukarka"), tr("Wydruk"), tr("Składanie")];

// warstwy szablonu od spodu: [typ, układ, wysokość, fronty (szuflady) | wnętrze (skrzynki L/XL), wkład szuflad (grid |
// glowice – tylko S) albo płyta skrzynek (true)]
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
  // szablony z wkładami (2026-11-07, prośba użytkownika): pojemniki gridfinity i wkład na głowice Bambu Lab
  { id: "gridfinity", name: tr("Biurko z gridfinity"), desc: tr("Wieża M z płytą gridfinity w każdej szufladzie – pojemniki ułożysz w zakładce „Pojemniki gridfinity”."), width: "M", depth: 4,
    layers: [["D", "M", 2, [1, 1], "grid"], ["D", "M", 1, null, "grid"], ["D", "M", 1, null, "grid"]], roof: "grid", mods: {} },
  { id: "printer", name: tr("Przy drukarce Bambu Lab"), desc: tr("Wieża S: na dole wkład na głowice i skarpety, wyżej szuflady z gridfinity na dysze i narzędzia."), width: "S", depth: 4,
    layers: [["D", "S", 1, null, "glowice"], ["D", "S", 1, null, "grid"], ["D", "S", 2, [1, 1], "grid"]], roof: "grid", mods: { base: true } },
  { id: "under", name: tr("Pod blat"), desc: tr("Szuflady przykręcane pod blat biurka (dach Under Table Mount)."), width: "M", depth: 4,
    layers: [["D", "M", 1], ["D", "M", 1]], roof: "under", mods: {} },
];

function krFromTemplate(t) {
  // numer domyślnej nazwy: zestaw zastąpi nietknięty jedyny „Zestaw 1” albo dojdzie jako kolejny; szablon – jego nazwa
  const repl = krPristine(cur()) && state.stacks.length === 1;
  const st = newStack(freeStackNo(state.stacks.length + (repl ? 0 : 1), repl ? cur() : null));
  if (t.id !== "empty") st.name = t.name;
  st.depth = t.depth; st.roof = t.roof; st.topHandle = !!t.topHandle;
  Object.assign(st.mods, t.mods);
  st.layers = t.layers.map(([type, layout, h, x, ins]) => {
    const l = newLayer(type, layout, h);
    if (type === "D" && Array.isArray(x)) l.cols.forEach(c => c.pattern = x.slice());
    if (type === "S" && typeof x === "string") l.cols.forEach(c => c.sInt = x);
    if (type === "D" && ins) l.cols.forEach((c, ci) => { if (ins !== "glowice" || FAMILIES[layout][ci] === "S") c.insert = ins; });
    if (type === "S" && ins) l.cols.forEach(c => c.grid = true);
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
  KR.key = state.key === "hidden" ? "hidden" : "normal"; KR.keyPrint = state.keyPrint !== false;
  KR.made = null; KR.colorPick = ""; KR.labMade = 0;
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
  // przed utworzeniem zestawu kroki po „Podsumowaniu” są zablokowane, po utworzeniu – kroki budowy (zmiany w edytorze)
  const stepOff = i => KR.made ? i < KR_BUILD : i >= KR_BUILD;
  const steps = el("ol", { class: "wiz-steps" }, STEPS.map((s, i) => el("li", { class: i === KR.step ? "on" : i < KR.step ? "done" : "" },
    el("button", { onclick: () => go(i), disabled: stepOff(i) }, el("span", { class: "n" }, String(i + 1)), " " + s))));
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
    // szuflady z wkładem na głowice zostają przy nim (pole „wkład na głowice” niżej)
    const glowCol = c => c.pattern.some((_, k) => insOf(c, k) === "glowice");
    const dCols = st.layers.filter(l => l.type === "D").flatMap(l => l.cols).filter(c => !glowCol(c)), sCols = st.layers.filter(l => l.type === "S").flatMap(l => l.cols);
    // najniższa szuflada S (wkład na głowice – tylko pudełko S): warstwa od spodu, w kolumnie ostatni front
    const sLow = (() => { for (const l of st.layers) if (l.type === "D") { const ci = FAMILIES[l.layout].indexOf("S"); if (ci >= 0) return l.cols[ci]; } return null; })();
    if (dCols.length || sCols.length || sLow) body.append(el("h3", {}, tr("Wnętrze")),
      el("div", { class: "row" },
        dCols.length ? chk(dCols.every(c => c.pattern.every((_, k) => insGrid(insOf(c, k)))), tr("wkład gridfinity we wszystkich szufladach"), v => { dCols.forEach(c => { c.insert = v ? "grid" : "none"; delete c.ins; }); chg(); }) : null,
        sLow ? chk(glowCol(sLow), tr("wkład na głowice Bambu Lab w najniższej szufladzie S"), v => { sLow.insert = v ? "glowice" : "none"; delete sLow.ins; chg(); }) : null,
        sCols.length ? chk(sCols.every(c => c.grid), tr("wkład gridfinity we wszystkich skrzynkach"), v => { sCols.forEach(c => c.grid = v); chg(); }) : null,
        help(tr("Płyta gridfinity na dnie pudełka – na niej stoją pojemniki gridfinity (zakładka „Pojemniki gridfinity”). Wkład na głowice wypełnia całe pudełko szuflady S – gniazda ustawisz w edytorze zestawu (✎ przy „Wkład”)."))));
    // kluczyk (pokrętło) szuflad – prośba użytkownika 2026-11-07: „zapytaj w kreatorze o rodzaj pokręteł”
    if (st.layers.some(l => l.type === "D")) body.append(el("h3", {}, tr("Szuflady")),
      el("div", { class: "row" }, lab(tr("Kluczyk:"), tr("Zwykły – kluczyk z płetwą i nakładką; ukryty – płaski, równy z frontem, z wyjmowanym kluczem.")),
        sel(KR.key, [["normal", tr("zwykły + nakładka")], ["hidden", tr("ukryty (Hidden Key)")]], v => { KR.key = v; chg(); }),
        KR.key === "hidden" ? chk(KR.keyPrint, tr("drukuj klucz (jeden na projekt)"), v => { KR.keyPrint = v; chg(); }) : null),
      el("p", { class: "hint" }, tr("Kluczyk jest wspólny dla wszystkich szuflad projektu – zmienisz go też w Ustawieniach (Części i szacunek).")));
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
  } else if (KR.step === 4) {
    // podsumowanie: lista części samego tego zestawu (bez pojemników, etykiet i dodatkowych plików projektu)
    const b = new Bom(), was = state.key;
    state.key = KR.key;  // kluczyk z kreatora (zapisywany dopiero przy „Utwórz”)
    try { addStack(b, st); } finally { state.key = was; }
    const parts = sortedParts(b), tot = withEstimates(parts), pieces = parts.reduce((n, e) => n + e.qty, 0);
    const kinds = st.layers.map(l => `${layoutLabel(l.layout)} ${l.height}F ${l.type === "D" ? tr("szuflady") : tr("skrzynka")}`);
    body.append(el("h3", {}, tr("Podsumowanie")),
      el("p", {}, el("b", {}, st.name), ` · ×${st.qty} · ${baseWidth(st)}${st.depth} · ${layersText(st.layers.length)}`),
      el("div", { class: "hint" }, tr("Warstwy od spodu")),
      el("ol", { class: "wiz-sum" }, kinds.map(k => el("li", {}, k))),
      el("p", {}, tr("{files} różnych plików · {pieces} wydruków (plików do wrzucenia na stół) · {hw} pozycji niedrukowanych", { files: parts.length, pieces, hw: b.hw.size })),
      PRINT ? el("p", {}, el("b", {}, tr("≈ {time} druku · ≈ {mass} filamentu", { time: fmtTime(tot.sec), mass: fmtG(tot.g) }))) : null,
      el("p", { class: "hint" }, tr("Po utworzeniu zestaw możesz dalej zmieniać w edytorze: wkłady i pojemniki gridfinity w szufladach, przegródki skrzynek, pegboard. Cofnij (Ctrl+Z) wycofa utworzenie.")),
      el("p", { class: "hint" }, tr("„Utwórz i dalej” prowadzi dalej: kolory, etykiety i dodatki, drukarka, przygotowanie wydruku i składanie.")));
  } else krAfter(body);

  const replace = !KR.made && krPristine(cur()) && state.stacks.length === 1;
  const foot = el("div", { class: "wiz-foot" },
    el("button", { onclick: closeWizard }, KR.made ? tr("Zamknij") : tr("Anuluj")),
    el("span", { style: "flex:1" }),
    KR.step > 0 && !stepOff(KR.step - 1) ? el("button", { onclick: () => go(KR.step - 1) }, "‹ " + tr("Wstecz")) : null,
    KR.step === KR_BUILD - 1 && !KR.made
      ? [el("button", { onclick: () => krFinish(replace, false) }, replace ? tr("Utwórz (zamiast „{name}”)", { name: cur().name }) : tr("Utwórz zestaw")),
        el("button", { class: "primary", onclick: () => krFinish(replace, true) }, tr("Utwórz i dalej") + " ›")]
      : KR.step < STEPS.length - 1 ? el("button", { class: "primary", onclick: () => go(KR.step + 1) }, tr("Dalej") + " ›")
      : el("button", { class: "primary", onclick: () => { closeWizard(); state.tab = "asm"; update(); } }, tr("Zakończ i otwórz „Składanie”")));
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

function krFinish(replace, cont) {
  const st = KR.st;
  normalizeStack(st);
  histBreak();
  if (replace) state.stacks[state.current] = st;
  else { state.stacks.push(st); state.current = state.stacks.length - 1; }
  // wkład na głowice z kreatora: gniazda sprawdzone na S4 (6 standardowych + 5 indukcyjnych + 2 skarpety), w S3 – 6 standardowych
  if (typeof glowInstances === "function") for (const i of glowInstances()) if (i.key.startsWith(`i:${st.id}:`) && !(state.glowWkl || {})[i.key]) {
    const q = glowLayout(i.key), std = ["0.2", "0.4", "0.4", "0.6", "0.8", "HF.4"].map(t => ({ r: "std", t }));
    Object.assign(q, i.d >= 4 ? { glowice: std.concat(["0.2", "0.4", "0.4", "0.6", "0.8"].map(t => ({ r: "ind", t }))), skarpety: 2 } : { glowice: std, skarpety: 0 });
  }
  state.key = KR.key; state.keyPrint = KR.keyPrint;  // kluczyk z kroku „Góra i dodatki” – dla całego projektu
  state.welcomeOff = true;
  if (cont) { KR.made = st.id; KR.step = KR_BUILD; update(); krRender(); }
  else { closeWizard(); update(); }
  toast(tr("Utworzono „{name}”", { name: st.name }));
}

// krok „Wydruk”: postęp zadania na serwerze (pollJob)
function krRefresh() { if (KR.box && KR.made && KR.step === 8) krRender(); }

// kroki po utworzeniu zestawu – na prawdziwym projekcie (zmiany od razu w edytorze i zakładkach)
function krAfter(body) {
  // body.append wstawia null jako tekst „null” – puste pola pomijane
  const add = (...kids) => body.append(...kids.flat().filter(k => k != null && k !== false));
  const st = state.stacks.find(s => s.id === KR.made) || cur();
  if (state.stacks.indexOf(st) !== state.current) { state.current = state.stacks.indexOf(st); save(); }
  const rr = () => { save(); render(); krRender(); };
  // zakres wydruku i list: ten zestaw albo cały projekt (przełącznik nad zakładkami)
  const scopeRow = () => state.stacks.length < 2 ? null : el("div", { class: "row" }, el("span", {}, tr("Zakładki pokazują:")),
    sel(scopeAll() ? "all" : "set", [["set", st.name], ["all", tr("Cały projekt (zestawy: {n})", { n: state.stacks.length })]], v => { state.scope = v; rr(); }));
  const goTab = t => { closeWizard(); state.tab = t; update(); window.scrollTo({ top: 0, behavior: "smooth" }); };
  if (KR.step === 5) {
    // kolory: gotowe palety z okna 3D (same filamenty PLA Basic) przepisane na grupy wydruku – albo bez kolorów
    const pal = [["none", tr("bez kolorów – jeden filament")], ["ussa", tr("jasnoszary (jak w instrukcji)")], ["black", tr("czarny + pomarańcz")],
      ["white", tr("biały")], ["graphite", tr("grafit")], ["forest", tr("leśny")], ["navy", tr("niebieskoszary + granat")],
      ["warm", tr("beż + kakao")], ["turquoise", tr("biały + turkus")], ["red", tr("czerwień + grafit")]];
    const pick = k => {
      histBreak();
      if (k === "none") state.colors = {};
      else {
        state.viz = Object.assign(state.viz || {}, VIZ_PALETTES[k], { palette: k });
        state.colors = vizColorsFor(Object.assign({}, VIZ_PALETTES.ussa, state.viz));
      }
      KR.colorPick = k; rr();
    };
    const sw = k => k === "none" ? [] : ["housing", "front", "box", "lock", "bins"].map(r => el("span", { class: "wiz-sw", style: `background:${VIZ_PALETTES[k][r]}` }));
    add(el("h3", {}, tr("Kolory części")),
      el("p", { class: "hint" }, tr("Części w różnych kolorach trafiają na osobne płyty, a kolor jest w nazwie płyty. Projekt Bambu Studio ma je jako kolejne filamenty, w innych slicerach każdy kolor to osobny projekt. Bez wybranych kolorów wszystko jak dotąd.")),
      el("div", { class: "wiz-pal" }, pal.map(([k, t]) => el("button", { class: "wiz-palbtn" + (KR.colorPick === k ? " on" : ""), onclick: () => pick(k) },
        el("span", { class: "wiz-sws" }, ...sw(k)), el("span", {}, t)))),
      el("p", { class: "hint" }, tr("Obudowa, fronty, pudełka, drobne części, pojemniki. Każdą grupę zmienisz później w „Przygotuj wydruk” → „Kolory części”; te same kolory pokazuje okno 3D.")));
  } else if (KR.step === 6) {
    // dodatki: etykiety (z projektu albo puste), logo, a pojemniki i przegródki – odnośniki do zakładek
    const fronts = typeof labFronts === "function" ? labFronts().filter(f => stackOfKey(f.src) === st.id).length : 0;
    const mine = k => stackOfKey(k) === st.id;
    const bins = typeof binInstances === "function" ? binInstances().filter(i => mine(i.key)).length : 0;
    const gds = typeof gdInstances === "function" ? gdInstances().filter(i => mine(i.key)).length : 0;
    const glows = typeof glowInstances === "function" ? glowInstances().filter(i => mine(i.key)).length : 0;
    const L = typeof logoState === "function" ? logoState() : null;
    add(el("h3", {}, tr("Etykiety")),
      el("p", { class: "hint" }, tr("Fronty w tym zestawie: {n}. Etykieta to wsuwana tabliczka we wnęce frontu – pusta albo z napisem i symbolem.", { n: fronts })),
      el("div", { class: "row" },
        el("button", { onclick: () => { const n0 = state.labels ? state.labels.length : 0; labFromProject(); KR.labMade = (state.labels || []).length - n0; krRender(); } },
          tr("Etykiety z projektu")),
        KR.labMade ? el("span", { class: "hint" }, tr("Dodano etykiety z projektu: {n}", { n: KR.labMade })) : null,
        help(tr("Po jednej etykiecie na każdy front szuflady i skrzynki w projekcie, z opisem miejsca. Kolejne kliknięcie dopisuje tylko nowe fronty."))),
      // napisy etykiet frontów tego zestawu od razu tutaj (zgłoszenie użytkownika 2026-11-07: po „Etykiety z projektu” krok
      // „Wydruk” ostrzegał „0 z 3” – napisów nie było gdzie wpisać); zapis przy pisaniu, przerysowanie po wyjściu z pola
      ...(() => {
        const mineL = (state.labels || []).filter(l => l.src && stackOfKey(l.src) === st.id);
        if (!mineL.length) return [];
        const filled = mineL.filter(l => String(l.tekst || "").trim() || l.symbol).length;
        return [el("div", { class: "wiz-labs" }, mineL.map(l => {
          const inp = el("input", { type: "text", maxlength: 60, placeholder: tr("napis"), title: tr("np. M3 × 12 – Enter albo | dzieli na linie"),
            oninput: e => { l.tekst = e.target.value; save(); }, onchange: () => rr() });
          inp.value = l.tekst || "";
          return el("label", { class: "wiz-lab" }, el("span", { class: "hint" }, String(l.gdzie || "").split(" · ").slice(1).join(" · ") || l.gdzie || ""), inp);
        })),
          el("p", { class: "hint" }, tr("Z napisem: {a} z {n}. Front bez napisu dostaje pustą etykietę USSA albo – gdy puste są wyłączone – żadnej.", { a: filled, n: mineL.length }))];
      })(),
      el("div", { class: "row" }, chk(state.blankLabels !== false, tr("puste etykiety (Label) na liście części"), v => { state.blankLabels = v; rr(); })),
      el("p", { class: "hint" }, tr("Symbol, styl napisu (wypukły, wklęsły, wpuszczony w drugim kolorze) i podgląd – w zakładce „Etykiety”.")),
      L ? el("h3", {}, tr("Logo na frontach")) : null,
      L ? el("div", { class: "row" }, chk(!!L.on, tr("logo na każdym froncie"), v => { L.on = v; rr(); }),
        el("button", { class: "small", onclick: () => goTab("labels") }, tr("Ustaw w zakładce „Etykiety”"))) : null,
      el("h3", {}, tr("Wnętrze szuflad")),
      el("p", {}, bins || gds || glows
        ? tr("Szuflady i skrzynki z płytą gridfinity: {b} · z przegródkami Grid Dividers: {g} · z wkładem na głowice: {h}.", { b: bins, g: gds, h: glows })
        : tr("Żadna szuflada tego zestawu nie ma wkładu – ustawisz go w edytorze zestawu (pole „Wkład”).")),
      el("div", { class: "row" },
        bins ? el("button", { class: "small", onclick: () => goTab("bins") }, tr("Pojemniki gridfinity") + " ›") : null,
        gds ? el("button", { class: "small", onclick: () => goTab("gd") }, tr("Przegródki") + " ›") : null),
      bins || gds ? el("p", { class: "hint" }, tr("Edytory pojemników i przegródek są w zakładkach – przycisk zamyka przewodnik. Dalej poprowadzą przyciski „Następny krok” na dole zakładek.")) : null);
  } else if (KR.step === 7) {
    const j = state.job, setj = k => v => { j[k] = v; rr(); };
    if (!PRINTERS[j.printer] && j.printer !== "custom") j.printer = "h2s";
    const pr = PRINTERS[j.printer];
    add(el("h3", {}, tr("Drukarka")),
      el("div", { class: "row" }, tr("Drukarka:") + " ",
        sel(j.printer, [...Object.entries(PRINTERS).map(([k, v]) => [k, printerLabel(v)]), ["custom", tr("własny stół…")]], setj("printer"))),
      j.printer === "custom" ? el("p", { class: "hint" }, tr("Wymiary własnego stołu ustawisz w zakładce „Przygotuj wydruk”.")) : null,
      pr ? el("p", { class: "hint" }, tr("Stół {w} × {d} mm, wysokość do {h} mm.", { w: pr.bed[0], d: pr.bed[1], h: pr.h })) : null,
      el("div", { class: "row" }, chk(j.make3mf, tr("utwórz płyty 3MF z rozmieszczonymi częściami"), setj("make3mf")),
        chk(j.copy, tr("skopiuj pliki STL do folderu do_druku"), setj("copy"))),
      pr && pr.bambu && j.make3mf ? el("div", { class: "row" },
        chk(j.project, tr("jeden projekt {slicer} ze wszystkimi płytami (zamiast osobnych plików 3MF)", { slicer: pr.bambu.slicer || "Bambu Studio" }), setj("project"))) : null,
      scopeRow(),
      el("p", { class: "hint" }, tr("Pozostałe opcje (odstęp między częściami, nazwa folderu, czyszczenie wyników) – w zakładce „Przygotuj wydruk”.")));
  } else if (KR.step === 8) {
    const parts = sortedParts(buildBom()), tot = withEstimates(parts), j = state.job;
    const ok = parts.filter(e => !e.missing && jobQty(e) > 0), pieces = ok.reduce((n, e) => n + jobQty(e), 0);
    const all = SERVER.status || {}, stt = all.kind === "skan" ? {} : all, busy = !!all.running;
    const colors = new Set(parts.filter(e => !e.missing).map(e => partColor(e.file) || "")).size;
    add(el("h3", {}, tr("Przygotowanie wydruku")),
      el("p", {}, tr("{files} różnych plików · {pieces} wydruków (plików do wrzucenia na stół) · {hw} pozycji niedrukowanych", { files: parts.length, pieces, hw: buildBom().hw.size })),
      PRINT ? el("p", {}, el("b", {}, tr("≈ {time} druku · ≈ {mass} filamentu", { time: fmtTime(tot.sec), mass: fmtG(tot.g) }))) : null,
      colors > 1 ? el("p", { class: "hint" }, tr("Kolory: {n} – każdy na osobnych płytach.", { n: colors })) : null,
      scopeRow(),
      // ostrzeżenie o etykietach z wyjściem: wróć i wpisz napisy albo drukuj puste dla frontów bez napisu
      typeof labMismatch === "function" && labMismatch() ? el("div", { class: "err" }, el("p", {}, "⚠ " + labMismatch()),
        el("div", { class: "row" }, el("button", { class: "small", onclick: () => { KR.step = 6; krRender(); } }, "‹ " + tr("Wróć do „Dodatki”")),
          el("button", { class: "small", onclick: () => { state.blankLabels = true; rr(); } }, tr("drukuj puste etykiety dla frontów bez napisu")))) : null);
    if (!SERVER.ok || WEB) add(el("p", { class: "err" }, tr("Konfigurator nie jest uruchomiony przez serwer, więc przeglądarka nie ma dostępu do plików.")),
      el("button", { onclick: () => goTab("job") }, tr("Przygotuj wydruk") + " ›"));
    else {
      add(el("div", { class: "row" }, el("button", { class: "primary", disabled: !ok.length || busy || !(j.copy || j.make3mf) || SERVER.stale, onclick: async () => {
        try { await api("/api/druk", jobPayload(parts)); SERVER.myJob = true; SERVER.status = { running: true, step: "start" }; krRender(); pollJob(); }
        catch (e) { alert(e.message); }
      } }, busy ? tr("Trwa przygotowanie…") : tr("Przygotuj do druku ({n} szt.)", { n: pieces }))));
      if (busy) {
        const pg = typeof stt.progress === "number" ? Math.max(0, Math.min(1, stt.progress)) : null;
        add(el("p", {}, "⏳ ", stt.step || "", pg !== null ? ` · ${Math.round(pg * 100)} %` : ""),
          pg !== null ? el("progress", { class: "job", max: 1, value: pg }) : el("progress", { class: "job" }));
      }
      if (stt.error) add(el("p", { class: "err" }, tr("Błąd:") + " " + stt.error));
      if (!busy && stt.result) {
        const r = stt.result;
        add(el("h3", {}, tr("Gotowe")),
          el("p", {}, tr("Folder: {dir}", { dir: r.folder }), el("br"), tr("Skopiowano plików: {copied} · płyt 3MF: {plates} · czas: {sec} s", { copied: r.copied, plates: r.plates.length, sec: r.seconds })),
          r.warnings.length ? el("p", { class: "err" }, tr("Uwagi z przygotowania: {n} – lista w zakładce „Przygotuj wydruk”.", { n: r.warnings.length })) : null,
          el("div", { class: "row" }, SERVER.otworz ? el("button", { onclick: () => api("/api/otworz", {}).catch(e => alert(e.message)) }, tr("Otwórz folder")) : null,
            el("button", { onclick: () => { location.href = "/api/pobierz"; } }, tr("Pobierz ZIP"))));
      }
    }
  } else if (KR.step === 9) {
    const inst = typeof binInstances === "function" ? new Map(binInstances().map(x => [x.key, x.t])) : new Map();
    const n = typeof asmSteps === "function" ? asmSteps(st, inst).length : 0;
    const b = new Bom();
    addStack(b, st);
    add(el("h3", {}, tr("Składanie")),
      el("p", {}, tr("Kroków składania w zestawie „{name}”: {n} – od spodu wieży, każdy z częściami, śrubami i stronami instrukcji USSA.", { name: st.name, n })),
      el("p", {}, tr("Do kupienia (zakładka „Niedrukowane”): {n} pozycji – śruby, pręty, magnesy.", { n: b.hw.size })),
      el("div", { class: "row" }, el("button", { onclick: () => goTab("hw") }, tr("Niedrukowane") + " ›"), el("button", { onclick: () => goTab("asm") }, tr("Składanie") + " ›")),
      el("p", { class: "hint" }, tr("Zrobione kroki odhaczysz w zakładce „Składanie”, a wydrukowane części – w „Do druku” (licznik zapisuje się z projektem).")));
  }
}
