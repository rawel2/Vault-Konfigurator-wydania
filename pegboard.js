// Akcesoria pegboardu USSA (2026-11-17, prośba użytkownika „Tak, dodaj” po nowej paczce USSA „commercial”): osobna paczka
// 261020_PEGBOARD_USSA.rar rozpakowana do folderu biblioteki daje folder „PEGBOARD/” (254 STL + PEGBOARD LIBRARY.pdf):
//   HOOKS/<20–100>mm/{A–E,H,I}.stl, HOOKS/F.stl, HOOKS/G.stl         – haczyki (A–I wg instrukcji PEGBOARD LIBRARY, s. 1)
//   CONTAINERS/<n>_Depth_<mm>mm/Width_<2–10> inches/{A,B,C_50,C_75,D–G}.stl – pojemniki i płytki (s. 2–3)
//   CONTAINERS/HOOKs for containers/<n>_<mm>…_<1|2>.stl              – haczyki do pojemników (s. 4)
//   37MM x 4 (pegboard holders).stl                                  – uchwyty pegboardu (4 w pliku)
// Wybrane akcesoria idą do „Dodatkowych plików” (state.extras – lista części, szacunek, druk, kolory jak inne pliki);
// na liście części grupa „Akcesoria pegboardu” i opis z rodzaju i rozmiaru (pegLabel). Haczyk G mocuje się śrubą M3.
// Plików USSA nie ma w repo – katalog.js zna je tylko po skanie biblioteki z rozpakowaną paczką; bez nich (inny komputer,
// stara paczka) wybór jest wyłączony – PEG.ok sprawdza serwer (HEAD /biblioteka/…).
const PEG_DIR = "PEGBOARD/";
const PEG = { open: false, ok: null, rodzaj: "hook", ksztalt: "A", dl: 50, gl: 2, szer: 4, war: "C_50", hooks: true, hw: 1, qty: 1, zestaw: "start", zqty: 1 };
// opisy kształtów z instrukcji (kąt ramienia, rysunek s. 1)
// funkcje (nie stałe) – teksty przez tr() w miejscu użycia, w bieżącym języku (jak krTemplates w kreator.js)
const PEG_HOOKS = () => [["A", tr("prosty z zaczepem na końcu")], ["B", tr("prosty")], ["C", tr("uniesiony 10°")], ["D", tr("uniesiony 10°, z podporą")],
  ["E", tr("uniesiony 25°, z podporą")], ["H", tr("długi z podporą, wygięty")], ["I", tr("długi z podporą")], ["F", tr("krótki 3°")], ["G", tr("krótki 10°, na śrubę M3")]];
const PEG_CONT = () => [["A", tr("taca")], ["B", tr("otwarty z przodu")], ["C_50", tr("pojemnik 50 mm")], ["C_75", tr("pojemnik 75 mm")],
  ["D", tr("płytka z podłużnymi otworami")], ["E", tr("płytka z otworami Ø 7")], ["F", tr("płytka pełna")], ["G", tr("płytka z otworami Ø 13")]];
const PEG_DEPTHS = [[2, 50], [3, 75], [4, 100], [5, 125]];
const PEG_WIDTHS = [2, 4, 6, 8, 10];  // cale (2″ = 50,8 mm)

const pegFiles = () => FILES.filter(f => f.startsWith(PEG_DIR) && /\.stl$/i.test(f));
const pegHookFile = (k, dl) => k === "F" || k === "G" ? `${PEG_DIR}HOOKS/${k}.stl` : `${PEG_DIR}HOOKS/${dl}mm/${k}.stl`;
const pegHookLengths = k => k === "F" || k === "G" ? [] : [20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100].filter(d => FILES.includes(pegHookFile(k, d)));
const pegContFile = (gl, szer, w) => { const [n, mm] = PEG_DEPTHS.find(([n]) => n === gl) || PEG_DEPTHS[0]; return `${PEG_DIR}CONTAINERS/${n}_Depth_${mm}mm/Width_${szer} inches/${w}.stl`; };
// haczyki do pojemników: nazwy plików niekonsekwentne (4_100_1, 5_125_2) – szukane po głębokości i numerze
const pegContHook = (gl, v) => pegFiles().find(f => new RegExp(`^pegboard/containers/hooks for containers/${gl}_\\d+(mm)?_${v}\\.stl$`).test(norm(f)));

// Gotowe zestawy (2026-11-17, prośba użytkownika: „trudno samemu tak wybierać – kreator albo zestawy”): propozycje pod typowe
// zastosowania; po dodaniu zwykłe pozycje „Dodatkowych plików” – ilości i rozmiary poprawia się na liście. Pozycja:
// ["hook", kształt, długość, ilość] albo ["cont", głębokość (2–5), szerokość ″, wariant, ilość, haczyki do pojemnika (0/1)].
// Płytki D–G kładzie się na pojemniku tej samej głębokości i szerokości (szczeliny na tych samych haczykach) – bez haczyków.
const PEG_SETS = () => [
  ["start", tr("Warsztat – na początek"), tr("Mieszanka haczyków i kilka pojemników na drobiazgi – dobry punkt wyjścia."),
    [["hook", "B", 50, 4], ["hook", "A", 80, 2], ["hook", "C", 40, 2], ["cont", 3, 4, "C_50", 2, 1], ["cont", 3, 6, "B", 1, 1]]],
  ["narzedzia", tr("Śrubokręty i szczypce"), tr("Pojemniki z płytkami z otworami na trzonki, krótkie haczyki na szczypce."),
    [["cont", 3, 6, "C_75", 1, 1], ["cont", 3, 6, "G", 1, 0], ["cont", 3, 4, "C_75", 1, 1], ["cont", 3, 4, "E", 1, 0], ["hook", "B", 40, 4]]],
  ["drobne", tr("Drobne części"), tr("Rząd małych pojemników na śruby, nakrętki i elementy elektroniczne oraz dwie tace."),
    [["cont", 2, 2, "C_50", 4, 1], ["cont", 2, 4, "C_50", 2, 1], ["cont", 2, 6, "A", 2, 1]]],
  ["kable", tr("Kable, przedłużacze, taśmy"), tr("Długie haczyki z podporą na zwoje kabli i rolki taśm."),
    [["hook", "H", 100, 2], ["hook", "I", 80, 2], ["hook", "E", 60, 2], ["hook", "D", 40, 2]]],
  ["klucze", tr("Klucze i bity"), tr("Krótkie haczyki na klucze płaskie i taca z płytką ze szczelinami na bity."),
    [["hook", "F", 0, 6], ["hook", "G", 0, 2], ["cont", 4, 8, "A", 1, 1], ["cont", 4, 8, "D", 1, 0]]],
];
// pliki zestawu [[plik, ilość]] (null – brak pliku w paczce)
function pegSetFiles(z, n = 1) {
  const out = [];
  for (const it of z[3]) {
    if (it[0] === "hook") out.push([pegHookFile(it[1], it[2]), it[3] * n]);
    else {
      out.push([pegContFile(it[1], it[2], it[3]), it[4] * n]);
      if (it[5]) out.push([pegContHook(it[1], 1), it[4] * 2 * n]);
    }
  }
  return out.map(([f, k]) => [f && FILES.includes(f) ? f : null, k]);
}
// wybór gotowego zestawu (panel pegboardu i krok „Dodatki” kreatora); re – przerysowanie miejsca wywołania
function pegSetsBox(re) {
  const sets = PEG_SETS(), z = sets.find(x => x[0] === PEG.zestaw) || sets[0];
  const files = pegSetFiles(z, PEG.zqty), ok = files.every(([f]) => f);
  return el("div", { class: "peg-sets" },
    el("label", { class: "field" }, el("span", {}, tr("zestaw")), sel(z[0], sets.map(x => [x[0], x[1]]), v => { PEG.zestaw = v; re(); })),
    el("p", { class: "hint" }, z[2]),
    el("ul", { class: "peg-set-list" }, ...files.map(([f, k], i) => el("li", {}, k + "× " + (f ? pegLabel(f) : "?")))),
    // wygląd całego zestawu: miniatura każdej części z liczbą sztuk (prośba użytkownika „pokazać wygląd całego zestawu”)
    ok ? pegPreview(files.map(([f]) => f), files.map(([, k]) => k)) : null,
    el("div", { class: "field" }, el("span", {}, tr("ile zestawów")), el("span", { class: "row" }, num(PEG.zqty, v => { PEG.zqty = v; re(); }, 1, 20),
      el("button", { class: "small primary", disabled: !ok, onclick: () => {
        histBreak(); files.forEach(([f, k]) => pegAdd(f, k)); update(); re(); toast(tr("Dodano zestaw „{z}” do dodatkowych plików", { z: z[1] }));
      } }, tr("Dodaj zestaw")))),
    ok ? null : el("p", { class: "hint err" }, tr("Takiego pliku nie ma w paczce pegboardu.")));
}

// opis pliku pegboardu na liście części i w „Dodatkowych plikach” (null – plik spoza paczki pegboardu)
function pegLabel(file) {
  const n = norm(file);
  if (!n.startsWith("pegboard/")) return null;
  let m;
  if ((m = /^pegboard\/hooks\/(\d+)mm\/([a-z])\.stl$/.exec(n))) return tr("haczyk {k} {dl} mm", { k: m[2].toUpperCase(), dl: m[1] });
  if ((m = /^pegboard\/hooks\/([a-z])\.stl$/.exec(n))) return tr("haczyk {k}", { k: m[1].toUpperCase() });
  if ((m = /^pegboard\/containers\/hooks for containers\/(\d)_(\d+)(mm)?_(\d)\.stl$/.exec(n))) return tr("haczyk do pojemnika {mm} mm, wariant {v}", { mm: m[2], v: m[4] });
  if ((m = /^pegboard\/containers\/\d_depth_(\d+)mm\/width_(\d+) inches\/([a-z0-9_]+)\.stl$/.exec(n))) {
    const w = (PEG_CONT().find(([k]) => k.toLowerCase() === m[3]) || [m[3].toUpperCase(), ""]);
    return tr("{opis} ({w}) – głęb. {gl} mm, szer. {sz}″", { w: w[0], opis: w[1], gl: m[1], sz: m[2] });
  }
  if (/37mm x 4/.test(n)) return tr("uchwyty pegboardu 37 mm (4 w pliku)");
  return file.split("/").pop();
}

// czy pliki paczki są w bibliotece na serwerze (katalog.js z repo może je znać, a biblioteka użytkownika – nie mieć)
function pegCheck() {
  if (PEG.ok !== null || !pegFiles().length) return;
  if (typeof WEB !== "undefined" && WEB) { PEG.ok = true; return; }
  if (!SERVER.ok) return;
  PEG.ok = "…";
  fetch("/biblioteka/" + pegFiles()[0].split("/").map(encodeURIComponent).join("/"), { method: "HEAD" })
    .then(r => { PEG.ok = r.ok; }).catch(() => { PEG.ok = false; }).finally(() => renderExtras());
}

function pegAdd(file, qty) {
  if (!file || !FILES.includes(file) || qty < 1) return;
  const ex = state.extras.find(x => x.file === file && inScope(null, x.st));
  if (ex) ex.qty += qty; else state.extras.push({ file, qty, ...scopeTag() });
}

// Panel z prawej („Akcesoria pegboardu”, jak Ustawienia i Pomoc – 2026-11-17, zrzut użytkownika: w lewej kolumnie formularz się
// nie mieścił, a po jej zwinięciu znikał). Otwierany przyciskiem pod „Dodatkowymi plikami” i w edytorze zestawu przy
// pegboardzie; pod formularzem lista dodanych akcesoriów (ilość, usuwanie) – widoczna także przy zwiniętej lewej kolumnie.
const pegPliki = () => state.extras.filter(e => inScope(null, e.st) && norm(e.file).startsWith("pegboard/"));
// przycisk otwierający panel (lewa kolumna, edytor); null – w katalogu nie ma plików pegboardu
function pegButton(small = true) {
  if (!pegFiles().length) return null;
  const n = pegPliki().reduce((s, e) => s + e.qty, 0);
  return el("button", { class: small ? "small" : "", onclick: () => pegOpen(true),
    title: tr("Haczyki, pojemniki i uchwyty z paczki USSA PEGBOARD") }, tr("Akcesoria pegboardu…") + (n ? ` (${n})` : ""));
}
function pegOpen(on) {
  PEG.open = on;
  openPanel(on ? "pegDrawer" : null, on);
  if (on) pegRender();
}
// treść panelu
function pegRender() {
  const box = $("pegBody");
  if (!box || $("pegDrawer").hidden) return;
  pegCheck();
  const re = () => pegRender();
  if (PEG.ok === false) {
    box.replaceChildren(el("p", { class: "err" }, tr("W bibliotece nie ma paczki pegboardu – rozpakuj 261020_PEGBOARD_USSA.rar do folderu biblioteki (powstanie folder PEGBOARD) i zeskanuj bibliotekę ponownie.")));
    return;
  }
  const row = (label, ...kids) => el("label", { class: "field" }, el("span", {}, label), ...kids);
  const kids = [el("h3", {}, tr("Gotowe zestawy")), pegSetsBox(re), el("h3", {}, tr("Pojedynczo")), row(tr("rodzaj"), sel(PEG.rodzaj, [["hook", tr("haczyk")], ["cont", tr("pojemnik albo płytka")], ["holder", tr("uchwyty pegboardu 37 mm")]], v => { PEG.rodzaj = v; re(); }))];
  let files = [];
  if (PEG.rodzaj === "hook") {
    const hooks = PEG_HOOKS().filter(([k]) => k === "F" || k === "G" || pegHookLengths(k).length);
    if (!hooks.some(([k]) => k === PEG.ksztalt)) PEG.ksztalt = hooks[0][0];
    kids.push(row(tr("kształt"), sel(PEG.ksztalt, hooks.map(([k, o]) => [k, k + " – " + o]), v => { PEG.ksztalt = v; re(); })));
    const dls = pegHookLengths(PEG.ksztalt);
    if (dls.length) {
      if (!dls.includes(+PEG.dl)) PEG.dl = dls.includes(50) ? 50 : dls[0];
      kids.push(row(tr("długość"), sel(String(PEG.dl), dls.map(d => [String(d), d + " mm"]), v => { PEG.dl = +v; re(); })));
    }
    files = [[pegHookFile(PEG.ksztalt, PEG.dl), 1]];
  } else if (PEG.rodzaj === "cont") {
    kids.push(row(tr("głębokość"), sel(String(PEG.gl), PEG_DEPTHS.map(([n, mm]) => [String(n), mm + " mm"]), v => { PEG.gl = +v; re(); })),
      row(tr("szerokość"), sel(String(PEG.szer), PEG_WIDTHS.map(w => [String(w), `${w}″ (${(w * 25.4).toLocaleString(locale(), { maximumFractionDigits: 1 })} mm)`]), v => { PEG.szer = +v; re(); })),
      row(tr("wariant"), sel(PEG.war, PEG_CONT().map(([k, o]) => [k, k + " – " + o]), v => { PEG.war = v; re(); })));
    const pojemnik = !/^[D-G]$/.test(PEG.war);  // A, B, C_50, C_75 wiszą na haczykach; D–G to płytki (wkłady)
    if (pojemnik)
      kids.push(el("div", { class: "field" }, chk(PEG.hooks, tr("z 2 haczykami do pojemnika"), v => { PEG.hooks = v; re(); }),
        PEG.hooks ? sel(String(PEG.hw), [["1", tr("wariant 1")], ["2", tr("wariant 2")]], v => { PEG.hw = +v; re(); }) : null));
    files = [[pegContFile(PEG.gl, PEG.szer, PEG.war), 1]];
    if (pojemnik && PEG.hooks) files.push([pegContHook(PEG.gl, PEG.hw), 2]);
  } else files = [[`${PEG_DIR}37MM x 4 (pegboard holders).stl`, 1]];
  const ok = files.every(([f]) => f && FILES.includes(f));
  kids.push(el("div", { class: "field" }, el("span", {}, tr("ilość")), el("span", { class: "row" }, num(PEG.qty, v => { PEG.qty = v; }, 1, 99),
    el("button", { class: "small primary", disabled: !ok, onclick: () => { files.forEach(([f, k]) => pegAdd(f, k * PEG.qty)); update(); toast(tr("Dodano do dodatkowych plików")); } }, tr("Dodaj")))),
    ok ? el("p", { class: "hint" }, files.map(([f, k]) => (k * PEG.qty) + "× " + pegLabel(f)).join(" + ")) : el("p", { class: "hint err" }, tr("Takiego pliku nie ma w paczce pegboardu.")),
    ok ? pegPreview(files.map(([f]) => f)) : null,
    el("p", { class: "hint" }, tr("Rysunki wszystkich wariantów: PEGBOARD LIBRARY.pdf w folderze PEGBOARD biblioteki. Haczyk G mocuje się śrubą M3.")));
  // dodane akcesoria (wybrany zestaw albo cały projekt – jak „Dodatkowe pliki”)
  const lista = pegPliki();
  kids.push(el("h3", {}, tr("Dodane akcesoria")), lista.length ? el("div", {}, ...lista.map(e => el("div", { class: "row peg-item" },
    num(e.qty, v => { e.qty = v; update(); }, 1),
    el("span", { title: e.file, style: "flex:1" }, pegLabel(e.file)),
    el("button", { class: "small", title: tr("usuń"), onclick: () => { histBreak(); state.extras.splice(state.extras.indexOf(e), 1); update(); toast(tr("Usunięto plik z listy")); } }, "✕"))))
    : el("p", { class: "hint" }, tr("Jeszcze nic – wybierz akcesorium i kliknij „Dodaj”.")));
  box.replaceChildren(...kids);
}

// podgląd wybranych plików – miniatury jak w „Do druku” (thumbGet z wizualizacja.js: siatka z serwera, część ułożona jak
// w pliku, kolor grupy z okna 3D) z wymiarami; bez serwera – nic
// ile – liczby sztuk (podgląd zestawu: małe miniatury z „4×” w rogu, podpis w podpowiedzi)
function pegPreview(files, ile = null) {
  if (typeof thumbGet !== "function" || typeof SERVER === "undefined" || !SERVER.ok) return null;
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--panel").trim() || "#ffffff";
  if (ile) {  // te same pliki (haczyki do pojemników) razem
    const m = new Map();
    files.forEach((f, i) => m.set(f, (m.get(f) || 0) + ile[i]));
    files = [...m.keys()]; ile = [...m.values()];
  }
  return el("div", { class: "peg-prev" + (ile ? " small" : "") }, ...files.map((f, i) => {
    const img = el("img", { alt: pegLabel(f), hidden: true }), cap = el("div", { class: "hint" }, tr("wczytywanie kształtu…"));
    const g = GEOM[f], wym = g ? g.slice(2, 5).map(v => v.toLocaleString(locale(), { maximumFractionDigits: 1 })).join(" × ") + " mm" : "";
    thumbGet(f, thumbColor(f), bg).then(r => {
      img.hidden = !r;
      if (r) img.src = r.url;
      cap.textContent = r ? pegLabel(f) + (wym ? " · " + wym : "") : tr("brak podglądu kształtu");
    }, () => { cap.textContent = tr("brak podglądu kształtu"); });
    if (ile) { cap.hidden = true; return el("figure", { title: pegLabel(f) }, el("span", { class: "peg-ile" }, ile[i] + "×"), img, cap); }
    return el("figure", {}, img, cap);
  }));
}
