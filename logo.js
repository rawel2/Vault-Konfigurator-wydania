// Logo na frontach szuflad i skrzynek (2026-11-05, prośba użytkownika: „logo – jak etykieta, ale takie samo na każdej
// przedniej ściance”; decyzje: płaskie w drugim kolorze – wpuszczone albo wypukłe, źródła: ikony, napisy i SVG; miejsce –
// prawy dolny róg na osi etykiety, jedyne wolne na wszystkich 20 frontach; logo dopasowane do proporcji, a wymiary wspólne
// dla projektu – największe, jakie mieści się na każdym froncie projektu). Geometria – logo.py (serwer, POST /api/logo).
// state.logo { on, zrodlo napis|ikona|svg, tekst, symbol, svg, svgName, styl wpuszczony|wypukly|wklesly, gl } – z projektem.
// Kolor logo wpuszczonego = kolor napisów (state.labelTextColor), jak etykiety i pojemniki.
const LOGO_VER = 25;          // pojemniki.WERSJA z frontami z logo
const LOGO_FILE = "@logo/";
const LOGO_FRONT_RX = /^0[12]\. [^/]+\/0\d\. [smlx]+ families\/(facades\/[^/]+|[^/]*facade[^/]*)\.stl$/;  // po norm(); bez Facade Cap
const LOGO_MAKS_SVG = 300000;
const LOGO = { res: new Map(), timer: 0, picker: false, rt: 0, cur: new Map() };  // cur: front USSA → parametry frontu z logo (okno 3D)

function logoState() {
  if (!state.logo || typeof state.logo !== "object") state.logo = {};
  const L = state.logo;
  if (!["napis", "ikona", "svg"].includes(L.zrodlo)) L.zrodlo = "napis";
  if (!["wpuszczony", "wypukly", "wklesly"].includes(L.styl)) L.styl = "wpuszczony";
  if (![0.4, 0.6, 0.8, 1].includes(+L.gl)) L.gl = 0.4;
  return L;
}
const logoOk = () => SERVER.ok && SERVER.pojemniki && (SERVER.pojemnikiWer || 1) >= LOGO_VER;
const logoSrc = L => L.zrodlo === "svg" ? { zrodlo: "svg", svg: L.svg || "" } : L.zrodlo === "ikona" ? { zrodlo: "ikona", symbol: L.symbol || "" }
  : { zrodlo: "napis", tekst: String(L.tekst || ""), symbol: L.symbol || "" };
const logoEmpty = L => L.zrodlo === "svg" ? !L.svg : L.zrodlo === "ikona" ? !L.symbol : !String(L.tekst || "").trim() && !L.symbol;
const logoFronts = files => [...new Set(files)].filter(f => !f.startsWith("@") && !f.startsWith("?") && LOGO_FRONT_RX.test(norm(f))).sort();

// miejsce i nazwy plików z serwera – pamięć według frontów projektu i logo; odpowiedź przerysowuje wynik
function logoPlace(fronts, L) {
  const body = { fronty: fronts, logo: logoSrc(L), styl: L.styl, gl: +L.gl };
  const key = JSON.stringify(body);
  let e = LOGO.res.get(key);
  if (e) return e;
  e = { status: "loading" };
  LOGO.res.set(key, e);
  // fronty z błędami siatki (oryginalna paczka USSA) serwer naprawia w tle – pytanie co 4 s, aż będą gotowe
  api("/api/logo", body).then(r => {
    if (r.naprawa && r.naprawa.length) {
      e.status = "repair"; e.names = r.naprawa;
      setTimeout(() => { if (LOGO.res.get(key) === e) LOGO.res.delete(key); renderResult(); }, 4000);
    } else { e.status = "ok"; e.r = r; }
  }).catch(err => { e.status = "err"; e.err = err.message; })
    .finally(() => { clearTimeout(LOGO.rt); LOGO.rt = setTimeout(renderResult, 60); });
  return e;
}

// front USSA f w liście b zamieniony na front z logo c (ta sama ilość, grupa i uwagi)
function logoReplace(b, f, c) {
  const e = b.parts.get(f);
  if (!e) return;
  b.parts.delete(f);
  b.parts.set(c.file, { ...e, file: c.file, gen: c.q, labels: new Set([...e.labels].map(l => l + " + " + tr("logo"))) });
}

// lista części: każdy front USSA zastąpiony frontem z logo; LOGO.cur – fronty projektu z logo („Składanie”, okno 3D)
function logoAddToBom(b) {
  const L = logoState();
  LOGO.cur = new Map();
  if (!L.on || logoEmpty(L) || !logoOk()) return;
  const fronts = logoFronts([...b.parts.keys()]);
  if (!fronts.length) return;
  const r = logoPlace(fronts, L);
  if (r.status !== "ok" || !r.r.miejsce) return;
  for (const f of fronts) {
    const n = r.r.pliki[f];
    if (!n) continue;
    const q = { typ: "front_logo", front: f, logo: logoSrc(L), ...r.r.miejsce, styl: L.styl, gl: +L.gl };
    const c = { q, file: LOGO_FILE + n + ".stl" };
    BIN_GEN.set(c.file, q);
    LOGO.cur.set(f, c);
    logoReplace(b, f, c);
  }
}
// kroki „Składania”: te same fronty z logo co na liście części projektu
function logoSwap(b) {
  for (const [f, c] of LOGO.cur) logoReplace(b, f, c);
}

// okno 3D: logo na froncie z pliku f (siatka z serwera w układzie pliku frontu – rysowana macierzą frontu)
function logoForFront(f) {
  const c = f && LOGO.cur.get(f);
  return c ? { e: vizStlGetGen(c.file + "#logo", { ...c.q, widok: "logo" }), styl: c.q.styl } : null;
}

function logoPanel() {
  const L = logoState();
  const rerender = () => { save(); renderResult(); };
  const ch = k => v => { L[k] = v; rerender(); };
  const row = (label, ...kids) => el("label", { class: "bin-row" }, el("span", {}, label), ...kids);
  const head = el("h3", { style: "margin-top:18px" }, tr("Logo na frontach"));
  if (!logoOk()) return el("div", {}, head, serverNote(
    tr("Logo na frontach generuje serwer konfiguratora (wersja generatora {v}) – uruchom konfigurator ponownie po aktualizacji.", { v: LOGO_VER }), "err"));
  const on = chk(!!L.on, tr("logo na wszystkich frontach szuflad i skrzynek w projekcie"), ch("on"));
  // źródło
  const src = row(tr("logo"), sel(L.zrodlo, [["napis", tr("napis (i symbol)")], ["ikona", tr("ikona")], ["svg", tr("własny plik SVG")]], ch("zrodlo")));
  const parts = [];
  if (L.zrodlo === "napis") {
    const t = el("input", { type: "text", class: "logo-text", maxlength: 60, placeholder: tr("np. VAULT – | dzieli na linie"),
      oninput: e => { L.tekst = e.target.value; clearTimeout(LOGO.timer); LOGO.timer = setTimeout(rerender, 500); } });
    t.value = L.tekst || "";
    // przerysowanie (po wpisaniu litery, po odpowiedzi serwera) tworzy pole od nowa – kursor i zaznaczenie wracają
    // (zgłoszenie użytkownika 2026-11-05: „po wpisaniu każdej literki wyrzuca z pola wpisywania”; tak samo jak napis etykiety)
    const a = document.activeElement;
    if (a && a.classList && a.classList.contains("logo-text")) {
      const [s0, s1] = [a.selectionStart, a.selectionEnd];
      setTimeout(() => { if (t.isConnected) { t.focus(); t.setSelectionRange(s0, s1); } }, 0);
    }
    parts.push(row(tr("napis"), t));
  }
  if (L.zrodlo !== "svg") {
    parts.push(row(L.zrodlo === "ikona" ? tr("ikona") : tr("symbol"), el("span", { class: "row" },
      L.symbol && labSymPolys(L.symbol) ? labSymSvg(labSymPolys(L.symbol)) : el("span", { class: "hint" }, tr("bez symbolu")),
      el("button", { class: "small", onclick: e => { e.preventDefault(); LOGO.picker = !LOGO.picker; rerender(); } }, LOGO.picker ? tr("Zamknij") : tr("Wybierz…")))));
    if (LOGO.picker) parts.push(labPicker(L.symbol, k => { L.symbol = k; LOGO.picker = false; rerender(); }));
  } else {
    const inp = el("input", { type: "file", accept: ".svg,image/svg+xml", onchange: async e => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > LOGO_MAKS_SVG) { toast(tr("Plik SVG jest za duży (najwyżej {n} KB).", { n: Math.round(LOGO_MAKS_SVG / 1000) }), false); return; }
      histBreak(); L.svg = await f.text(); L.svgName = f.name; rerender();
    } });
    parts.push(row(tr("plik SVG"), el("span", { class: "row" }, inp, L.svgName ? el("span", { class: "hint" }, L.svgName) : null)),
      el("p", { class: "hint" }, tr("Brane są wypełnione kształty (ścieżki, prostokąty, koła…), kolory pomijane – każdy wypełniony kształt to logo. Same linie bez wypełnienia nie dają kształtu.")));
  }
  const styl = row(tr("styl"), sel(L.styl, [["wpuszczony", tr("wpuszczony – drugi filament równo z licem (AMS)")],
    ["wypukly", tr("wypukły – nad licem, zmiana filamentu pauzą")], ["wklesly", tr("wklęsły – wycięty w licu, jeden kolor")]], ch("styl")));
  const gl = row(L.styl === "wypukly" ? tr("wysokość") : tr("głębokość"), sel(String(+L.gl), ["0.4", "0.6", "0.8", "1"].map(h => [h, (+h).toLocaleString(locale()) + " mm"]), v => { L.gl = +v; rerender(); }));
  const kolor = L.styl === "wklesly" ? null : row(tr("kolor logo (= kolor napisów)"), sel(state.labelTextColor || "#000000", COLOR_PALETTE.map(([h, n]) => [h, tr(n)]),
    v => { state.labelTextColor = v; rerender(); }));
  // wynik: wspólne miejsce dla frontów projektu
  let info = null;
  const fronts = logoFronts([...buildBom().parts.values()].map(e => e.gen && e.gen.typ === "front_logo" ? e.gen.front : e.file));
  if (!fronts.length) info = el("p", { class: "hint" }, tr("W projekcie nie ma frontów szuflad ani skrzynek."));
  else if (logoEmpty(L)) info = el("p", { class: "hint" }, tr("Wpisz napis albo wybierz ikonę lub plik SVG."));
  else {
    const r = logoPlace(fronts, L), loc = locale(), mm = x => x.toLocaleString(loc, { maximumFractionDigits: 1 });
    info = r.status === "loading" ? el("p", { class: "hint" }, tr("Liczę miejsce na frontach projektu…"))
      : r.status === "repair" ? el("p", { class: "hint" }, tr("Naprawiam fronty z błędami siatki z Twojej biblioteki ({pliki}) – tylko za pierwszym razem: kilka sekund, szuflada S1F do kilkunastu minut…", { pliki: r.names.join(", ") }))
      : r.status === "err" ? el("p", { class: "err" }, r.err)
      : !r.r.miejsce ? el("p", { class: "err" }, tr("To logo nie mieści się na frontach projektu."))
      : el("p", { class: "hint" }, tr("Logo {w} × {h} mm na każdym z {n} rodzajów frontów – prawy dolny róg: środek {x} mm od prawej krawędzi i {y} mm od dołu. To największy rozmiar, jaki mieści się na wszystkich frontach projektu – bez frontów S może być większe.",
        { w: mm(r.r.miejsce.w), h: mm(r.r.miejsce.h), n: fronts.length, x: mm(r.r.miejsce.x), y: mm(r.r.miejsce.y) }));
  }
  const q0 = fronts.length && !logoEmpty(L) ? (() => { const r = logoPlace(fronts, L); return r.status === "ok" && r.r.miejsce ? { typ: "front_logo", front: fronts[0], logo: logoSrc(L), ...r.r.miejsce, styl: L.styl, gl: +L.gl } : null; })() : null;
  const dl = el("div", { class: "row" }, el("button", { class: "small", disabled: !q0, onclick: () => q0 && binPost("/api/pojemnik/stl", q0, L.styl === "wpuszczony" ? null : "front_logo.stl") },
    tr("STL pierwszego frontu z logo")));
  return el("div", { class: "logo-panel" }, head, el("div", { class: "row" }, on), src, ...parts, styl, gl, kolor, info, dl,
    el("p", { class: "hint" }, tr("Na liście części fronty USSA zastępują fronty z logo (generuje je konfigurator z plików Twojej biblioteki). Front drukuje się licem do góry, więc logo jest w ostatnich warstwach: wypukłe – zmiana filamentu na wysokości lica, wpuszczone – dwa kolory w ostatnich warstwach (projekt Bambu Studio: logo ma własny filament).")));
}
