"use strict";
// ---------- Przegródki szuflad Grid Dividers (od 2026-11-05, prośba użytkownika: „konfigurator do grid dividers”) ----------
// Pliki USSA: 01. DRAWERS/07. Universal/Grid Dividers/<wysokość>/<n>.stl (n = 5…32 – długość n × 10,5 mm), części brzegowe
// (Straight / Rounded Edge Piece) i piny (pin_tight / pin_loose). Instrukcja: 01. INSTRUCTIONS/*.jpg w tym folderze.
// Pomiar plików (przekroje, skrypty gd_*.py w scratchpadzie sesji 2026-11-05):
// - dno pudełka szuflady: otwory Ø 4 mm co 10,5 mm; kolumn S 12, M 20, L 26, XL 34; rzędów 4 × głębokość; skrajny otwór od
//   wewnętrznej ścianki bocznej: S 5,19, M 7,71, L 14,0, XL 9,52 mm; od przedniej (wycięcie na krzywkę zamka) 11,05, od tylnej
//   7,65 mm. Płyta gridfinity zasłania otwory – w szufladzie albo wkład gridfinity, albo przegródki.
// - przegródka: ścianka 6 mm z zaokrąglonym wierzchem na stopie 25,4 mm (wyokrąglenia do dna); na obu końcach szczelina na
//   język części brzegowej (ok. 9,7 mm w głąb); w spodzie 2 gniazda pinów 1,5 odstępu (15,75 mm) od końców – końce wypadają
//   w połowie między otworami.
// - część brzegowa: 8 mm tego samego profilu + język 12,2 mm (z wsunięciem wydłuża przegródkę o ok. 10,5 mm, ze szczeliną
//   do ścianki – kilka mm luzu); Rounded – to samo z zaokrąglonym końcem (wolny koniec przegródki).
// - pin: trzpień Ø 4 z kołnierzem, w gniazdo przegródki i otwór dna.
// Reguła (zgodna z nazwami USSA 10-S, 18-M, 26-L, 32-XL i x3…x7 = 10…26 oraz z przykładem z instrukcji „6 bez części
// brzegowej albo 5 + część brzegowa”): koniec przy ściance – szczelnie (decyzja użytkownika): koniec przegródki w połowie
// między otworami, najbliżej ścianki, ale co najmniej GD_SEAL mm od niej, i część brzegowa; koniec przy innej przegródce –
// pół odstępu od jej osi; wolny koniec – pół odstępu za ostatnim otworem (opcjonalnie zakończenie zaokrąglone).
const GD_PITCH = 10.5, GD_SEAL = 8.5, GD_FOOT = 12.7, GD_MIN = 5, GD_MAX = 32;
const GD_COLS = { S: 12, M: 20, L: 26, XL: 34 };
const GD_SIDE = { S: 5.19, M: 7.71, L: 14.0, XL: 9.52 };
const GD_FRONT = 11.05, GD_BACK = 7.65;
// wysokości: 20 mm (każda szuflada) i pełna wysokość szuflad 1F (34,5) i 2F (82,5); 4F – najwyżej 82,5
const GD_FOLDER = { 20: ["20mm tall", "20mm"], 34.5: ["34\\.5mm tall[^/]*", "1f"], 82.5: ["82\\.5mm tall[^/]*", "2f"] };
const gdHeights = h => h === 1 ? [20, 34.5] : [20, 34.5, 82.5];
const GD_DIR = "^01\\. drawers/07\\. universal/grid dividers/";
const gdRx = (hgt, n) => new RegExp(GD_DIR + GD_FOLDER[hgt][0] + "/" + n + "(-(s|m|l|xl))?(, x\\d)?\\.stl$");
const gdEdgeRx = (hgt, kind) => new RegExp(GD_DIR + GD_FOLDER[hgt][0] + "/" + kind + " edge piece " + GD_FOLDER[hgt][1] + "\\.stl$");
const gdPinRx = pin => new RegExp(GD_DIR + "grid divider pin_" + (pin === "loose" ? "loose" : "tight") + "\\.stl$");
const GD = { drag: null, sel: -1, selA: -1, selP: -1, box: null, mode: "line", rad: 3, postD: 12, postH: 0 };

// ---------- łuki (własny projekt – luki.py, wersja generatora 26; prośba użytkownika 2026-11-05: „zakręty” z reklamy) ----------
// Łuk { u, v – środek w otworze, r – promień w odstępach (2–12), kat 90|180, a0 – kąt początku 0/90/180/270 (przeciwnie do
// wskazówek zegara, u w prawo, v do tyłu) }. Końce łuku leżą w otworach (E), dalej pół odstępu prosto i język – tam kończy
// się dochodząca przegródka USSA (jej koniec w połowie między otworami, jak przy wolnym końcu).
const GD_ARC_VER = 26, GD_TONGUE = 17.45;
const gdArcGen = (A, hgt) => ({ typ: "luk", kat: A.kat, r: A.r, h: hgt });
const gdExtName = q => q.ext && q.ext.some(Boolean) ? "_" + q.ext.map(x => x || "0").join("-") : "";
const gdArcFile = q => { const f = "@przegrodki/przegrodka_luk_" + q.kat + "_r" + q.r + "_" + q.h + "mm" + gdExtName(q) + ".stl"; if (typeof BIN_GEN !== "undefined") BIN_GEN.set(f, q); return f; };
const gdArcOk = () => typeof SERVER !== "undefined" && !!SERVER.pojemniki && (SERVER.pojemnikiWer || 1) >= GD_ARC_VER;
const gdCos = a => Math.round(Math.cos(a * Math.PI / 180)), gdSin = a => Math.round(Math.sin(a * Math.PI / 180));
// końce: punkt E na okręgu i kierunek d na zewnątrz łuku (styczna)
function gdArcEnds(A) {
  const a1 = A.a0 + A.kat;
  return [{ E: [A.u + A.r * gdCos(A.a0), A.v + A.r * gdSin(A.a0)], d: [gdSin(A.a0), -gdCos(A.a0)] },
    { E: [A.u + A.r * gdCos(a1), A.v + A.r * gdSin(a1)], d: [-gdSin(a1), gdCos(a1)] }];
}
// otwory pod łukiem (piny): punkty siatki na okręgu w zakresie kątów – jak luki.punkty_pinow
function gdArcPins(A) {
  const out = [];
  for (let i = -A.r; i <= A.r; i++) for (let j = -A.r; j <= A.r; j++) if (i * i + j * j === A.r * A.r) {
    const a = ((Math.atan2(j, i) * 180 / Math.PI - A.a0) % 360 + 360) % 360;
    if (a <= A.kat + 1e-9 || a > 359.999) out.push([A.u + i, A.v + j]);
  }
  return out;
}
// ---------- krótkie przegródki 1–4 odstępy (luki.py typ "krotka", 2026-11-05 – USSA ma przegródki od 5) ----------
// koniec przy ściance – przedłużona do ścianki (0,5 mm luzu, bez części brzegowej) „w<mm>”; przy krzyżaku albo łuku –
// szczelina na ich język „s”; przy przegródce albo wolny – płaski „p”. Gniazda pinów w otworach, ≥ 13 mm od szczeliny.
const GD_SHORT_X = 13;
// części brzegowe na wymiar (luki.py typ "brzeg", 2026-11-05 – część USSA ma blok 8 mm, przy ściance M zostawało ~5 mm
// odsłoniętego języka): blok od ścianki (0,5 mm luzu) do końca przegródki; state.gdEdge "ussa" – pliki USSA
const gdEdgeFit = () => state.gdEdge !== "ussa";
const gdEdgeLen = (g, L, r, e) => Math.round((Math.abs(g.wall[L.o][e] - (e ? r.end : r.start)) * GD_PITCH - 0.5) * 10) / 10;
const gdEdgeFile = q => { const f = "@przegrodki/przegrodka_brzeg_" + q.L.toFixed(1) + "_" + q.h + "mm.stl"; if (typeof BIN_GEN !== "undefined") BIN_GEN.set(f, q); return f; };
function gdShortGen(g, L, r, hgt) {
  const code = (t, e) => t === "wall" ? "w" + Math.max(0, Math.abs(g.wall[L.o][e] - (e ? r.end : r.start)) * GD_PITCH - 0.5).toFixed(1)
    : t === "cross" || t === "arc" ? "s" : "p";
  return { typ: "krotka", n: r.n, h: hgt, k0: code(r.ends[0], 0), k1: code(r.ends[1], 1) };
}
// gniazda (mm od początku przegródki) – jak luki.piny_krotkiej
function gdShortPins(q) {
  const out = [];
  for (let k = 0; k < q.n; k++) {
    const x = (k + 0.5) * GD_PITCH;
    if (q.k0 === "s" && x < GD_SHORT_X || q.k1 === "s" && q.n * GD_PITCH - x < GD_SHORT_X) continue;
    out.push(x);
  }
  return out;
}
const gdShortExt = k => k.startsWith("w") ? +k.slice(1) : 0;
// Piny (2026-11-05, wydruk użytkownika: piny USSA nie wchodzą w gniazda łuków; pomysł użytkownika „lepiej poprawić piny” –
// gniazda zostają jak w USSA, więc ten sam pin pasuje też do oryginalnych przegródek): state.gdPin "gen" (domyślnie) – pin
// generowany (luki.py, typ "pin") z trzpieniem i kołnierzem po stronie przegródki cieńszymi o state.gdPinLuz (0,1–0,4 mm),
// koniec w dnie jak USSA tight/loose (state.gdPinDol "t"/"l"); "tight"/"loose" – pliki USSA. Stary serwer – USSA tight.
const GD_PIN_LUZ = [0.1, 0.2, 0.3, 0.4];
const gdPinGen = () => {
  if ((state.gdPin || "gen") !== "gen" || !gdArcOk()) return null;
  const luz = GD_PIN_LUZ.includes(+state.gdPinLuz) ? +state.gdPinLuz : 0.2;
  return { typ: "pin", luz, dol: state.gdPinDol === "l" ? "l" : "t" };
};
const gdPinFile = q => { const f = "@przegrodki/pin_" + (q.krotki ? "slupka" : "przegrodki") + "_luz" + q.luz.toFixed(1) + "_" + (q.dol === "l" ? "loose" : "tight") + ".stl"; if (typeof BIN_GEN !== "undefined") BIN_GEN.set(f, q); return f; };
const gdShortFile = q => { const f = "@przegrodki/przegrodka_krotka_" + q.n + "_" + q.h + "mm_" + q.k0 + "_" + q.k1 + ".stl"; if (typeof BIN_GEN !== "undefined") BIN_GEN.set(f, q); return f; };

// ---------- krzyżaki „+” (luki.py typ "krzyz", 2026-11-05 – prośba użytkownika: przecinające się proste; stopy dwóch „T”
// najeżdżały na siebie). Krzyżak stoi w otworze C (pin), cztery przegródki kończą się pół odstępu od niego (jak przy łuku).
// s.cross [[u, v]]; linie dzielone w C (każde ramię to osobna linia kończąca się w C)
const gdCrossFile = q => { const f = "@przegrodki/przegrodka_" + GD_JOINT[q.ramiona || "x"] + "_" + q.h + "mm" + gdExtName(q) + ".stl"; if (typeof BIN_GEN !== "undefined") BIN_GEN.set(f, q); return f; };
const gdPt = (L, p) => L.o === "h" ? [p, L.a] : [L.a, p];
const gdIsX = (s, C) => (s.cross || []).some(x => x[0] === C[0] && x[1] === C[1]);
// ramiona w otworze C: [poziome, pionowe] linie kończące się w C
function gdArms(lines, C) {
  return [lines.filter(L => L.o === "h" && L.a === C[1] && (L.s === C[0] || L.e === C[0])),
    lines.filter(L => L.o === "v" && L.a === C[0] && (L.s === C[1] || L.e === C[1]))];
}
// Łączniki w otworach (2026-11-05, prośby użytkownika: krzyżak, potem „trójnik i kątownik”): każde miejsce, w którym
// przegródka kończy się na innej (T), dwie się krzyżują (+) albo spotykają w narożniku (L), dostaje łącznik z ramionami
// tylko tam, gdzie dochodzą przegródki. gdNormalize: przecięcia i „T” dzielą przegródkę przechodzącą, dwie współliniowe
// stykające się bez prostopadłej łączą się z powrotem, s.cross = otwory z ramionami w obu kierunkach.
function gdNormalize(s) {
  const lines = s.lines;
  for (let guard = 0; guard < 500; guard++) {
    let hit = null;
    for (const L of lines) {
      // koniec linii na osi prostopadłej, wewnątrz niej (T)
      for (const p of [L.s, L.e]) {
        const M = lines.find(X => X.o !== L.o && X.a === p && X.s < L.a && L.a < X.e);
        if (M) { hit = [M, L.a]; break; }
      }
      if (hit) break;
      // przecięcie wnętrz (+) – dzielone obie
      const M = lines.find(X => X.o !== L.o && L.s < X.a && X.a < L.e && X.s < L.a && L.a < X.e);
      if (M) { lines.splice(lines.indexOf(L), 1, { ...L, e: M.a }, { ...L, s: M.a }); hit = [M, L.a]; break; }
    }
    if (!hit) break;
    const [M, c] = hit;
    lines.splice(lines.indexOf(M), 1, { ...M, e: c }, { ...M, s: c });
  }
  // otwory, w których kończą się linie: łącznik albo połączenie współliniowych
  const pts = new Map();
  for (const L of lines) for (const p of [L.s, L.e]) { const C = gdPt(L, p); pts.set(C.join(","), C); }
  s.cross = [];
  for (const C of pts.values()) {
    const [h, v] = gdArms(lines, C);
    if (h.length && v.length) { s.cross.push(C); continue; }
    for (const arms of [h, v]) if (arms.length === 2) {
      const [a, b] = arms;
      lines.splice(lines.indexOf(a), 1); lines.splice(lines.indexOf(b), 1);
      lines.push({ ...a, s: Math.min(a.s, b.s), e: Math.max(a.e, b.e) });
    }
  }
}
// rodzaj łącznika w otworze C i obrót wzorca z luki.py (x: ramiona 0/90/180/270°, t: 0/90/180, l: 0/90)
function gdJoint(lines, C) {
  const [h, v] = gdArms(lines, C), dirs = [];
  if (h.some(L => L.s === C[0])) dirs.push(0);
  if (v.some(L => L.s === C[1])) dirs.push(90);
  if (h.some(L => L.e === C[0])) dirs.push(180);
  if (v.some(L => L.e === C[1])) dirs.push(270);
  if (dirs.length >= 4) return { k: "x", a0: 0, dirs };
  if (dirs.length === 3) return { k: "t", a0: ([0, 90, 180, 270].find(d => !dirs.includes(d)) + 90) % 360, dirs };
  const [a, b] = dirs;
  return { k: "l", a0: (b - a) === 90 ? a : b, dirs };  // 0 i 270 – narożnik od 270°
}
const GD_JOINT = { x: "krzyz", t: "trojnik", l: "katownik" };
const GD_CANON = { x: [0, 90, 180, 270], t: [0, 90, 180], l: [0, 90] };
// przedłużenia ramion łącznika w C (kolejność ramion wzorca) z odcinków doklejonych – res: wynik gdResolve
function gdJointExt(res, C, J) {
  const by = {};
  for (const r of res) if (r.absorb && r.absorb.C && r.absorb.C[0] === C[0] && r.absorb.C[1] === C[1]) by[r.absorb.dir] = r.absorb.ext;
  const ext = GD_CANON[J.k].map(c => by[(c + J.a0) % 360] || "");
  return ext.some(Boolean) ? ext : null;
}
function gdArcExt(res, ai) {
  const ext = ["", ""];
  for (const r of res) if (r.absorb && r.absorb.arc === ai) ext[r.absorb.end] = r.absorb.ext;
  return ext.some(Boolean) ? ext : null;
}
// gniazda w przedłużeniu "<n><k>": otwory 1…n od końca ramienia (przy szczelinie ≥ 13 mm od niej) – jak luki._koniec
const gdExtPins = (x, m = 0) => { if (!x) return m ? Array.from({ length: m }, (_, i) => i + 1) : []; const n = +x[0] + m, k = x.slice(1), out = []; for (let j = 1; j <= n; j++) if (!(k === "s" && 5.25 + (n - j) * GD_PITCH < 13)) out.push(j); return out; };
// ramię łącznika w odstępach (luki.RAMIE = 15,75 mm): koniec dochodzącej przegródki i pin w otworze na ramieniu
const GD_ARM = 1.5;

// ---------- słupki w dnie szuflady (luki.py typ "slupek", 2026-11-06 – prośba użytkownika ze zdjęciem reklamy USSA; w plikach
// USSA ich nie ma; „co najmniej 4 piny albo 5”, „dwie, może trzy średnice i wysokości dopasowane do F”) ----------
// s.posts [{ u, v, p: 4|5, d, h }]: 4 piny – (u, v) to lewy przedni z 4 otworów, słupek na środku kratki; 5 pinów – (u, v) to
// otwór pod słupkiem, piny też w 4 sąsiednich („+”). Podstawa 20 / 30 mm, 12 mm wysokości (gniazda jak w przegródkach),
// trzon Ø 8 / 12 / 16 z kopułką, wysokość 20 mm albo pełna 1F / 2F / 4F (34,5 / 82,5 / 178,5 – nie wyższy niż szuflada).
// Po podglądzie i szkicach (2026-11-06): najniższy 34,5 mm, szyjka Ø 5 przez 10 mm od czubka i łuk styczny do podstawy (d – stopa
// łuku), 1 pin – okrągła podstawa 3 mm (promień d/2 + 2, zwykły pin), 4 i 5 pinów – podstawa 7 mm i krótkie piny (`krotki`).
const GD_POST_VER = 28, GD_POST_D = [8, 12, 16];
const gdPostOk = () => typeof SERVER !== "undefined" && !!SERVER.pojemniki && (SERVER.pojemnikiWer || 1) >= GD_POST_VER;
const gdPostP = P => [1, 4, 5].includes(P.p) ? P.p : 4;
const gdPostHalf = P => gdPostP(P) === 5 ? 15 : gdPostP(P) === 1 ? (GD_POST_D.includes(P.d) ? P.d : 12) / 2 + 2 : 10;  // pół podstawy [mm]
const gdPostHeights = h => h >= 4 ? [34.5, 82.5, 178.5] : h >= 2 ? [34.5, 82.5] : [34.5];
const gdPostC = P => gdPostP(P) === 4 ? [P.u + 0.5, P.v + 0.5] : [P.u, P.v];
const gdPostPins = P => gdPostP(P) === 5 ? [[P.u, P.v], [P.u + 1, P.v], [P.u - 1, P.v], [P.u, P.v + 1], [P.u, P.v - 1]]
  : gdPostP(P) === 1 ? [[P.u, P.v]] : [[P.u, P.v], [P.u + 1, P.v], [P.u, P.v + 1], [P.u + 1, P.v + 1]];
const gdPostGen = (P, fh) => {
  const hs = gdPostHeights(fh);
  return { typ: "slupek", piny: gdPostP(P), d: GD_POST_D.includes(P.d) ? P.d : 12, h: hs.includes(P.h) ? P.h : hs[hs.length - 1] };
};
const gdPostMode = m => m === "p1" || m === "p4" || m === "p5";
const gdPostLabel = (p, v) => p === 5 ? tr("słupek z 5 pinami, Ø {d} mm, {h} mm", v) : p === 1 ? tr("słupek z 1 pinem, Ø {d} mm, {h} mm", v) : tr("słupek z 4 pinami, Ø {d} mm, {h} mm", v);
const gdPostFile = q => { const f = "@przegrodki/slupek_" + q.piny + "p_d" + q.d + "_" + q.h + "mm.stl"; if (typeof BIN_GEN !== "undefined") BIN_GEN.set(f, q); return f; };
// błąd słupka k: piny poza siatką, podstawa na ściance, na innym słupku, na stopie przegródki (25,4 mm), łączniku albo łuku
function gdPostErr(g, s, res, k) {
  const P = s.posts[k], [cu, cv] = gdPostC(P), B = gdPostHalf(P) / GD_PITCH, F = 12.68 / GD_PITCH, m = 0.3 / GD_PITCH;
  if (gdPostPins(P).some(([u, v]) => u < 0 || v < 0 || u >= g.C || v >= g.R)) return tr("piny słupka poza siatką otworów");
  if (cu - B - m < g.wall.h[0] || cu + B + m > g.wall.h[1] || cv - B - m < g.wall.v[0] || cv + B + m > g.wall.v[1]) return tr("podstawa słupka wchodzi na ściankę");
  for (const [j, Q] of s.posts.entries()) {
    if (j >= k) break;  // nachodzące – błąd ma później dodany (wcześniejszy zostaje na liście części, jak przy przegródkach)
    const [qu, qv] = gdPostC(Q), Bq = gdPostHalf(Q) / GD_PITCH;
    if (Math.abs(cu - qu) < B + Bq - 1e-6 && Math.abs(cv - qv) < B + Bq - 1e-6) return tr("nachodzi na inny słupek");
  }
  for (const [li, L] of s.lines.entries()) {
    const r = res[li], w = g.wall[L.o];
    const lo = r.ends[0] === "wall" ? w[0] : r.start, hi = r.ends[1] === "wall" ? w[1] : r.end;
    const [along, across] = L.o === "h" ? [cu, cv] : [cv, cu];
    if (Math.abs(across - L.a) < F + B && along + B > lo && along - B < hi) return tr("stoi na przegródce – stopa przegródki ma 25,4 mm");
  }
  const near = (u, v, r) => Math.abs(u - cu) < r + B && Math.abs(v - cv) < r + B;
  for (const C of s.cross || []) if (near(C[0], C[1], GD_ARM + F)) return tr("stoi na łączniku przegródek");
  for (const A of s.arcs || []) {
    for (let a = A.a0; a <= A.a0 + A.kat + 1e-9; a += 3) {
      const t = a * Math.PI / 180;
      if (near(A.u + A.r * Math.cos(t), A.v + A.r * Math.sin(t), F)) return tr("stoi na łuku przegródki");
    }
    for (const { E, d } of gdArcEnds(A)) for (let t = 0; t <= GD_TONGUE / GD_PITCH; t += 0.25)
      if (near(E[0] + d[0] * t, E[1] + d[1] * t, F)) return tr("stoi na łuku przegródki");
  }
  return "";
}
// stopa łuku w pudełku (≥ 12,7 mm od ścianek), język na końcach nie za ścianką
function gdArcErr(g, A) {
  const fu = GD_FOOT / GD_PITCH, ins = (u, v, m) => u - g.wall.h[0] >= m && g.wall.h[1] - u >= m && v - g.wall.v[0] >= m && g.wall.v[1] - v >= m;
  for (let a = A.a0; a <= A.a0 + A.kat + 1e-9; a += 3) {
    const t = a * Math.PI / 180;
    if (!ins(A.u + A.r * Math.cos(t), A.v + A.r * Math.sin(t), fu)) return tr("łuk wychodzi poza pudełko – stopa wchodzi na ściankę");
  }
  for (const { E, d } of gdArcEnds(A))
    if (!ins(E[0] + d[0] * GD_TONGUE / GD_PITCH, E[1] + d[1] * GD_TONGUE / GD_PITCH, 0)) return tr("koniec łuku za blisko ścianki – nie ma miejsca na język");
  return "";
}

// siatka otworów pudełka i ścianki w jednostkach odstępu (0 = pierwszy otwór): h – wzdłuż szerokości, v – od przodu do tyłu
function gdGeo(fam, d) {
  const C = GD_COLS[fam] || 12, R = 4 * d, s = (GD_SIDE[fam] || 5.19) / GD_PITCH;
  return { C, R, wall: { h: [-s, C - 1 + s], v: [-GD_FRONT / GD_PITCH, R - 1 + GD_BACK / GD_PITCH] } };
}
// koniec przy ściance (szczelnie): połowa między otworami najbliżej ścianki, ale co najmniej GD_SEAL mm od niej
function gdSealEnd(wall, dir) {
  let h = dir < 0 ? Math.ceil(wall - 0.5) + 0.5 : Math.floor(wall + 0.5) - 0.5;
  while (Math.abs(wall - h) * GD_PITCH < GD_SEAL) h -= dir;
  return h;
}
const gdLen = (g, o) => o === "h" ? g.C : g.R;

// wynik układu: dla każdej linii { start, end, n, ends: ["wall"|"joint"|"free", …], err }
function gdResolve(g, lines, arcs = [], cross = []) {
  const cover = (m, a) => m.s <= a && a <= m.e;
  const ends = arcs.flatMap(gdArcEnds), xs = new Set(cross.map(C => C.join(",")));
  return lines.map((L, li) => {
    const N = gdLen(g, L.o), wall = g.wall[L.o], r = { ends: [], err: "" };
    const endAt = (p, side) => {  // side −1 – początek, +1 – koniec
      if (p < 0 || p >= N) return ["wall", gdSealEnd(wall[side < 0 ? 0 : 1], side)];
      // łącznik – półtora odstępu od niego (ramię 15,75 mm: stopy prostopadłych przegródek nie nachodzą na siebie;
      // 2026-11-05, wydruk użytkownika – przy pół odstępu druga przegródka kątownika nie wchodziła)
      if (xs.has(gdPt(L, p).join(","))) return ["cross", p - side * GD_ARM];
      // koniec łuku: linia kończy się w otworze za końcem łuku (E + d) albo w samym końcu (E) – przegródka do połowy odstępu
      for (const { E, d } of ends) {
        const k = L.o === "h" ? 0 : 1, o = 1 - k;
        if (d[o] !== 0 || E[o] !== L.a || d[k] !== -side) continue;
        if (p === E[k] + d[k]) return ["arc", p + side * 0.5, ends.indexOf(ends.find(x => x.E === E))];
        if (p === E[k]) return ["arc", p - side * 0.5, ends.indexOf(ends.find(x => x.E === E))];
      }
      // prostopadła przegródka z osią w tym otworze, przechodząca przez oś tej linii; gdy obie kończą się w tym samym
      // otworze (narożnik) – wcześniejsza na liście przechodzi, późniejsza się na niej kończy
      const j = lines.findIndex((M, mi) => mi !== li && M.o !== L.o && M.a === p && cover(M, L.a) &&
        !((M.s === L.a || M.e === L.a) && mi > li));
      if (j >= 0) return ["joint", p - side * 0.5];
      return ["free", p + side * 0.5];
    };
    const [t0, a, i0] = endAt(L.s, -1), [t1, b, i1] = endAt(L.e, 1);
    r.ends = [t0, t1]; r.start = a; r.end = b; r.n = Math.round(b - a);
    if (r.n < 1) r.err = r.ends.includes("cross") ? tr("za blisko łącznika – jego ramię ma półtora odstępu (między łącznikami najmniej 4 otwory)")
      : tr("za krótka – najkrótsza przegródka ma {n} odstępów", { n: 1 });
    else if (r.n < GD_MIN) {  // krótsza niż w plikach USSA – generuje konfigurator (luki.py)
      r.short = true;
      if (!gdShortPins(gdShortGen(g, L, r, 20)).length) {
        // nie da się wydrukować osobno (dwie szczeliny albo szczelina na 1 odstępie) – doklejona do łącznika albo łuku jako
        // przedłużone ramię (2026-11-05, zrzut użytkownika: „2” między łukiem a trójnikiem); koniec ramienia jak drugi koniec
        // odcinka: szczelina (język sąsiada), płasko albo do ścianki
        const male = [0, 1].filter(e => r.ends[e] === "cross" || r.ends[e] === "arc");
        const e = male.find(x => r.ends[x] === "cross") ?? male[0];
        if (e === undefined) r.err = tr("za krótka na złącze z łukiem albo krzyżakiem – najmniej 2 odstępy (z obu stron 3)");
        else {
          const o = 1 - e, t = r.ends[o];
          const k = t === "cross" || t === "arc" ? "s" : t === "wall" ? "w" + Math.max(0, Math.abs(g.wall[L.o][o] - (o ? r.end : r.start)) * GD_PITCH - 0.5).toFixed(1) : "p";
          r.absorb = { e, ext: r.n + k, ...(r.ends[e] === "cross" ? { C: gdPt(L, e ? L.e : L.s), dir: L.o === "h" ? (e ? 180 : 0) : (e ? 270 : 90) } : { arc: (e ? i1 : i0) >> 1, end: (e ? i1 : i0) & 1 }) };
          // kierunek od łącznika do odcinka: odcinek po stronie e łącznika → ramię w przeciwną stronę niż koniec e
          if (r.absorb.C) r.absorb.dir = L.o === "h" ? (e ? 180 : 0) : (e ? 270 : 90);
        }
      }
    }
    else if (r.n > GD_MAX) r.err = tr("za długa – najdłuższa przegródka ma {n} odstępów", { n: GD_MAX });
    // krzyżowanie (nie na końcu żadnej z nich) – edytor dzieli nowe linie, ale stare układy mogą mieć skrzyżowania
    if (!r.err && lines.some((M, mi) => mi !== li && M.o !== L.o && L.s < M.a && M.a < L.e && M.s < L.a && L.a < M.e))
      r.err = tr("krzyżuje się z inną przegródką");
    // stopa 25,4 mm: równoległe przegródki najmniej 3 otwory od siebie, oś najmniej 12,7 mm od ścianki
    if (!r.err && lines.some((M, mi) => mi !== li && M.o === L.o && M.a !== L.a && Math.abs(M.a - L.a) < 3 && M.s <= L.e && L.s <= M.e))
      r.err = tr("za blisko równoległej przegródki – stopy nachodzą (odstęp najmniej 3 otwory)");
    // na tej samej osi: stykają się na skrzyżowaniu – dobrze; nachodzą – błąd (edytor łączy je przy dodawaniu)
    if (!r.err && lines.some((M, mi) => mi !== li && M.o === L.o && M.a === L.a && M.s < L.e && L.s < M.e))
      r.err = tr("nachodzi na inną przegródkę");
    const w2 = g.wall[L.o === "h" ? "v" : "h"];
    if (!r.err && Math.min(L.a - w2[0], w2[1] - L.a) * GD_PITCH < GD_FOOT) r.err = tr("za blisko ścianki – stopa przegródki na nią wchodzi");
    return r;
  });
}

// ---------- szuflady z przegródkami w projekcie ----------
function gdInstances() {
  const out = [];
  for (const st of state.stacks) st.layers.forEach((l, li) => l.cols.forEach((c, ci) => {
    if (l.type !== "D") return;
    const fam = FAMILIES[l.layout][ci], side = l.cols.length > 1 ? (ci === 0 ? tr("lewa") : tr("prawa")) : "";
    const where = [st.name, li === 0 ? tr("Warstwa 1 (spód)") : tr("Warstwa {n}", { n: li + 1 })];
    c.pattern.forEach((h, k) => insOf(c, k) === "dividers" && out.push({ key: binKey(st, l, ci, k), fam, d: st.depth, h, qty: st.qty,
      label: [...where, [tr("szuflada {fam}{d} {h}F", { fam, d: st.depth, h }), side, c.pattern.length > 1 ? tr("szuflada {k} od góry", { k: k + 1 }) : ""]
        .filter(Boolean).join(", ")].join(" · ") }));
  }));
  return out;
}
function gdLayout(key, i) {
  if (!state.gd || typeof state.gd !== "object" || Array.isArray(state.gd)) state.gd = {};
  let s = state.gd[key];
  if (!s) s = state.gd[key] = { hgt: 20, lines: [], arcs: [], posts: [] };
  if (!Array.isArray(s.lines)) s.lines = [];
  if (!Array.isArray(s.arcs)) s.arcs = [];
  if (!Array.isArray(s.posts)) s.posts = [];
  gdNormalize(s);
  if (i && !gdHeights(i.h).includes(s.hgt)) s.hgt = gdHeights(i.h).slice(-1)[0];
  return s;
}
// przycisk przy szufladzie w edytorze zestawu (jak „Pojemniki: ✎ n”)
function gdButton(st, l, ci, k) {
  const key = binKey(st, l, ci, k), n = gdCount(key);
  return el("button", { class: "small", title: tr("Zaprojektuj przegródki Grid Dividers dla tej szuflady ({n} szt.)", { n }), onclick: () => {
    state.gdCur = key; state.tab = "gd"; GD.sel = -1; update();
    const r = document.getElementById("result");
    if (r) r.scrollIntoView({ behavior: "smooth", block: "start" });
  } }, "✎ " + n);
}
const gdCount = key => { const s = state.gd && state.gd[key]; return s ? (Array.isArray(s.lines) ? s.lines.length : 0) + (Array.isArray(s.arcs) ? s.arcs.length : 0) + (Array.isArray(s.posts) ? s.posts.length : 0) : 0; };
function gdCopyLayouts(from, to) {
  if (!state.gd || typeof state.gd !== "object") return;
  for (const [k, s] of Object.entries(state.gd)) if (k.startsWith(from) && gdCount(k))
    state.gd[to + k.slice(from.length)] = JSON.parse(JSON.stringify(s));
}

// części jednego układu: [{ rx, label, n }] (przegródki po długości, części brzegowe, zakończenia, piny)
function gdParts(i, s) {
  const g = gdGeo(i.fam, i.d), res = gdResolve(g, s.lines, s.arcs || [], s.cross || []), out = new Map(), hs = s.hgt.toLocaleString(typeof locale === "function" ? locale() : undefined);
  const add = (k, rx, label, n = 1, gen = null) => { const e = out.get(k) || { rx, label, n: 0, ...(gen ? { gen, file: gen.typ === "slupek" ? gdPostFile(gen) : gen.typ === "krzyz" ? gdCrossFile(gen) : gen.typ === "krotka" ? gdShortFile(gen) : gen.typ === "brzeg" ? gdEdgeFile(gen) : gen.typ === "pin" ? gdPinFile(gen) : gdArcFile(gen) } : {}) }; e.n += n; out.set(k, e); };
  let ok = 0, arcPins = 0;
  for (const [ai, A] of (s.arcs || []).entries()) {
    if (gdArcErr(g, A)) continue;
    const q = gdArcGen(A, s.hgt), ext = gdArcExt(res, ai);
    if (ext) { q.ext = ext; arcPins += ext.reduce((n, x) => n + gdExtPins(x).length, 0); }
    add(gdArcFile(q), null, tr("łuk przegródki {kat}°, promień {r} mm ({h} mm)", { kat: A.kat, r: (A.r * GD_PITCH).toLocaleString(typeof locale === "function" ? locale() : undefined), h: hs }), 1, q);
    arcPins += gdArcPins(A).length;
  }
  let shortPins = 0;
  for (const [li, r] of res.entries()) {
    if (r.err || r.absorb) continue;  // doklejona – część łącznika albo łuku
    if (r.short) {  // krótka – generowana, końce w niej (bez części brzegowych i zakończeń); piny: 1–2
      const q = gdShortGen(g, s.lines[li], r, s.hgt), f = gdShortFile(q);
      add(f, null, tr("krótka przegródka {n} ({h} mm)", { n: r.n, h: hs }), 1, q);
      shortPins += Math.min(2, gdShortPins(q).length);
      continue;
    }
    ok++;
    add("d" + r.n, gdRx(s.hgt, r.n), tr("przegródka Grid Dividers {n} ({h} mm)", { n: r.n, h: hs }));
    for (const [ei, e] of r.ends.entries()) {
      if (e === "wall" && gdEdgeFit()) {
        const q = { typ: "brzeg", L: gdEdgeLen(g, s.lines[li], r, ei), h: s.hgt };
        add(gdEdgeFile(q), null, tr("część brzegowa na wymiar {l} mm ({h} mm)", { l: q.L.toLocaleString(typeof locale === "function" ? locale() : undefined), h: hs }), 1, q);
      } else if (e === "wall") add("edge", gdEdgeRx(s.hgt, "straight"), tr("część brzegowa przegródki ({h} mm)", { h: hs }));
      if (e === "free" && state.gdCap) add("cap", gdEdgeRx(s.hgt, "rounded"), tr("zakończenie zaokrąglone przegródki ({h} mm)", { h: hs }));
    }
  }
  const nx = (s.cross || []).length;  // pin w środku łącznika; piny w otworach ramion – extPins
  const JL = { x: () => tr("krzyżak przegródek ({h} mm)", { h: hs }), t: () => tr("trójnik przegródek ({h} mm)", { h: hs }), l: () => tr("kątownik przegródek ({h} mm)", { h: hs }) };
  let extPins = 0;
  for (const C of s.cross || []) {
    const J = gdJoint(s.lines, C), q = { typ: "krzyz", ramiona: J.k, h: s.hgt }, ext = gdJointExt(res, C, J);
    if (ext) q.ext = ext;
    extPins += GD_CANON[J.k].reduce((n, c, i) => n + gdExtPins(ext && ext[i], 1).length, 0);
    add(gdCrossFile(q), null, JL[J.k]() + (ext ? " " + tr("z przedłużeniem") : ""), 1, q);
  }
  let postPins = 0, postShort = 0;  // słupek 1 pin – zwykły pin przegródki, 4 i 5 pinów – krótkie piny słupka
  for (const [k, P] of (s.posts || []).entries()) {
    if (gdPostErr(g, s, res, k)) continue;
    const q = gdPostGen(P, i.h), v = { d: q.d, h: q.h.toLocaleString(typeof locale === "function" ? locale() : undefined) };
    add(gdPostFile(q), null, gdPostLabel(q.piny, v), 1, q);
    if (q.piny === 1) postPins += 1; else postShort += q.piny;
  }
  if (postShort) {
    const pg = gdPinGen(), q = { typ: "pin", luz: pg ? pg.luz : 0.2, dol: pg ? pg.dol : state.gdPin === "loose" ? "l" : "t", krotki: true };
    add(gdPinFile(q), null, tr("krótki pin słupka z luzem {l} mm", { l: q.luz.toLocaleString(typeof locale === "function" ? locale() : undefined) }), postShort, q);
  }
  if (ok || arcPins || nx || shortPins || postPins) {
    const n = 2 * ok + arcPins + nx + shortPins + extPins + postPins, pg = gdPinGen();
    if (pg) add(gdPinFile(pg), null, tr("pin przegródki z luzem {l} mm", { l: pg.luz.toLocaleString(typeof locale === "function" ? locale() : undefined) }), n, pg);
    else add("pin", gdPinRx(state.gdPin === "loose" ? "loose" : "tight"), tr("pin przegródki"), n);
  }
  return [...out.values()];
}
function gdAddToBom(b) {
  if (!state.gd || typeof state.gd !== "object") return;
  for (const i of gdInstances()) {
    if (!inScope(i.key)) continue;
    const s = state.gd[i.key];
    if (!gdCount(i.key)) continue;
    for (const p of gdParts(i, gdLayout(i.key, i)))
      if (p.gen) b.addGen("Przegródki Grid Dividers", p.label, p.file, p.n * i.qty, p.gen);
      else b.add("Przegródki Grid Dividers", p.label, p.rx, p.n * i.qty, { raw: true });
  }
}
// uwagi do projektu: błędne przegródki (poza listą części)
function gdIssues() {
  const out = [];
  if (!state.gd || typeof state.gd !== "object") return out;
  for (const i of gdInstances()) {
    const s = state.gd[i.key];
    if (!gdCount(i.key)) continue;
    const g = gdGeo(i.fam, i.d), lay = gdLayout(i.key, i);
    const rs = gdResolve(g, lay.lines, lay.arcs, lay.cross);
    const bad = rs.filter(r => r.err).length + lay.arcs.filter(A => gdArcErr(g, A)).length + lay.posts.filter((P, k) => gdPostErr(g, lay, rs, k)).length;
    if (bad) out.push({ msg: tr("Przegródki Grid Dividers z błędem: {n} – nie trafiają na listę części ({where}).", { n: bad, where: i.label }),
      go: () => { state.tab = "gd"; state.gdCur = i.key; GD.sel = -1; update(); } });
  }
  return out;
}

// układ do okna 3D (wizualizacja.js): przegródki { kind "div", o, a, u0, u1 } i części brzegowe / zakończenia { kind "edge" |
// "cap", o, a, side (−1 początek, +1 koniec), at – ścianka albo koniec przegródki } w jednostkach odstępu siatki
function gdVizLayout(key, fam, d, h) {
  if (!gdCount(key)) return null;
  const s = gdLayout(key);
  const hgt = gdHeights(h).includes(s.hgt) ? s.hgt : gdHeights(h).slice(-1)[0];
  const g = gdGeo(fam, d), res = gdResolve(g, s.lines, s.arcs, s.cross), parts = [];
  // ramka (mm względem środka): kierunek bez ramienia – słupek 12,68, z ramieniem – język 17,44, przedłużone – do końca
  // i stopa ±12,68 w poprzek
  const extLen = x => (GD_ARM * GD_PITCH) + (+x[0]) * GD_PITCH + (x.slice(1).startsWith("w") ? +x.slice(2) : 0);
  if (gdArcOk()) for (const [u, v] of s.cross) {
    const J = gdJoint(s.lines, [u, v]), q = { typ: "krzyz", ramiona: J.k, h: hgt }, ext = gdJointExt(res, [u, v], J);
    if (ext) q.ext = ext;
    const box = { 0: 12.68, 90: 12.68, 180: 12.68, 270: 12.68 };  // bez ramienia – okrągły słupek (stopa r 12,68)
    GD_CANON[J.k].forEach((c, i) => {
      const d = (c + J.a0) % 360, x = ext && ext[i];
      box[d] = x ? extLen(x) : GD_ARM * GD_PITCH + 12.19;  // ramię 15,75 + język 12,2
      if (x) { box[(d + 90) % 360] = Math.max(box[(d + 90) % 360], 12.68); box[(d + 270) % 360] = Math.max(box[(d + 270) % 360], 12.68); }
    });
    parts.push({ kind: "cross", u, v, a0: J.a0, box, gen: q, file: gdCrossFile(q) });
  }
  if (gdArcOk()) for (const [ai, A] of s.arcs.entries()) if (!gdArcErr(g, A)) {
    const q = gdArcGen(A, hgt), ext = gdArcExt(res, ai);
    if (ext) q.ext = ext;
    parts.push({ kind: "arc", u: A.u, v: A.v, r: A.r, kat: A.kat, a0: A.a0, ext: ext || ["", ""], gen: q, file: gdArcFile(q) });
  }
  // słupki: środek (jednostki siatki), pół boku podstawy [mm], parametry bryły
  s.posts.forEach((P, k) => {
    if (gdPostErr(g, s, res, k)) return;
    const q = gdPostGen(P, h);
    parts.push({ kind: "post", c: gdPostC(P), half: gdPostHalf(P), gen: q, file: gdPostFile(q) });
  });
  s.lines.forEach((L, li) => {
    const r = res[li];
    if (r.err || r.absorb) return;
    if (r.short) {
      if (!gdArcOk()) return;
      const q = gdShortGen(g, L, r, hgt);
      parts.push({ kind: "short", o: L.o, a: L.a, u0: r.start, u1: r.end, e0: gdShortExt(q.k0), e1: gdShortExt(q.k1), gen: q, file: gdShortFile(q) });
      return;
    }
    parts.push({ kind: "div", o: L.o, a: L.a, u0: r.start, u1: r.end, rx: gdRx(hgt, r.n) });
    r.ends.forEach((t, e) => {
      const side = e ? 1 : -1;
      if (t === "wall" && gdEdgeFit() && gdArcOk()) {
        const q = { typ: "brzeg", L: gdEdgeLen(g, L, r, e), h: hgt };
        parts.push({ kind: "edge", o: L.o, a: L.a, side, at: g.wall[L.o][e], len: q.L + 12.2, gap: 0.5, gen: q, file: gdEdgeFile(q) });
      } else if (t === "wall") parts.push({ kind: "edge", o: L.o, a: L.a, side, at: g.wall[L.o][e], rx: gdEdgeRx(hgt, "straight") });
      if (t === "free" && state.gdCap) parts.push({ kind: "cap", o: L.o, a: L.a, side, at: e ? r.end : r.start, rx: gdEdgeRx(hgt, "rounded") });
    });
  });
  return { hgt, parts };
}

// ---------- edycja układu ----------
// nowa linia: łączona z linią na tej samej osi, która ją dotyka albo nachodzi; dzielona w miejscach, gdzie przecina
// istniejące przegródki (kończy się na nich)
function gdAddLine(s, L) {
  if (!Array.isArray(s.cross)) s.cross = [];
  const lines = s.lines;
  for (let k = lines.length - 1; k >= 0; k--) {
    const M = lines[k];
    if (M.o !== L.o || M.a !== L.a || M.s > L.e || L.s > M.e) continue;
    if ((M.e === L.s || M.s === L.e) && gdIsX(s, gdPt(L, M.e === L.s ? L.s : L.e))) continue;  // stykają się w krzyżaku
    L = { ...L, s: Math.min(L.s, M.s), e: Math.max(L.e, M.e) }; lines.splice(k, 1);
  }
  // skrzyżowania: przecina prostopadłą (wnętrze obu) albo przechodzi przez otwór, w którym z obu stron kończą się
  // prostopadłe – krzyżak „+”, obie przegródki dzielone w tym otworze
  const cuts = [];
  for (const M of [...lines]) if (M.o !== L.o && L.s < M.a && M.a < L.e && M.s < L.a && L.a < M.e) {
    lines.splice(lines.indexOf(M), 1, { ...M, e: L.a }, { ...M, s: L.a });
    cuts.push(M.a);
  }
  for (let p = L.s + 1; p < L.e; p++) {
    const C = gdPt(L, p), [h, v] = gdArms(lines, C);
    if (cuts.includes(p)) continue;
    if (gdIsX(s, C) || (L.o === "h" ? v : h).length) cuts.push(p);  // łącznik albo kończące się tu prostopadłe – podział
  }
  cuts.sort((x, y) => x - y);
  let a = L.s;
  for (const c of [...cuts, L.e]) { if (c > a) lines.push({ o: L.o, a: L.a, s: a, e: c }); a = c; }
  gdNormalize(s);
}
function gdPreset(s, g, what) {
  histBreak();
  if (what === "clear") { s.lines = []; s.arcs = []; s.cross = []; s.posts = []; }
  if (what === "h2") gdAddLine(s, { o: "h", a: Math.round((g.R - 1) / 2), s: -1, e: g.C });
  if (what === "v2") gdAddLine(s, { o: "v", a: Math.round((g.C - 1) / 2), s: -1, e: g.R });
  GD.sel = GD.selA = GD.selP = -1; save(); renderResult();
}

function renderGd(box) {
  GD.box = box;
  // zakres zakładek: szuflady wybranego zestawu (kopiowanie układu – z całego projektu)
  const instAll = gdInstances(), inst = instAll.filter(i => inScope(i.key));
  if (!inst.length) {
    box.replaceChildren(el("div", { class: "card" }, el("h3", {}, tr("Przegródki szuflad (Grid Dividers)")),
      el("p", {}, scopeAll() ? tr("Żadna szuflada nie ma wkładu „przegródki Grid Dividers”. Ustaw go w edytorze zestawu: Wkład → przegródki Grid Dividers.")
        : tr("Żadna szuflada w zestawie „{name}” nie ma wkładu „przegródki Grid Dividers”. Ustaw go w edytorze zestawu: Wkład → przegródki Grid Dividers.", { name: cur().name })),
      el("p", { class: "hint" }, tr("Przegródki wsuwa się w otwory w dnie pudełka szuflady (co 10,5 mm) – zamiast płyty gridfinity."))));
    return;
  }
  if (!inst.some(i => i.key === state.gdCur)) state.gdCur = inst[0].key;
  const i = inst.find(x => x.key === state.gdCur), s = gdLayout(i.key, i), g = gdGeo(i.fam, i.d), res = gdResolve(g, s.lines, s.arcs, s.cross);
  if (GD.sel >= s.lines.length) GD.sel = -1;
  if (GD.selA >= s.arcs.length) GD.selA = -1;
  if (GD.selP >= s.posts.length) GD.selP = -1;
  const postHs = gdPostHeights(i.h);
  if (!postHs.includes(GD.postH)) GD.postH = postHs[postHs.length - 1];  // domyślnie pełna wysokość szuflady
  const count = gdCount;
  const set = (k, v) => { histBreak(); s[k] = v; save(); renderResult(); };
  const setG = (k, v) => { state[k] = v; save(); renderResult(); };
  const same = instAll.filter(x => x.key !== i.key && x.fam === i.fam && x.d === i.d && count(x.key));

  const head = el("div", { class: "bin-choose" }, el("label", {}, tr("Szuflada:"),
    sel(i.key, inst.map(x => [x.key, x.label + " – " + tr("{n} przegr.", { n: count(x.key) })]), v => { state.gdCur = v; GD.sel = -1; save(); renderResult(); })));
  const opts = el("div", { class: "row" },
    lab(tr("Wysokość:"), tr("20 mm – niskie przegródki do każdej szuflady; 34,5 mm – pełna wysokość szuflady 1F; 82,5 mm – pełna wysokość szuflady 2F.")),
    sel(s.hgt, gdHeights(i.h).map(v => [v, v.toLocaleString(locale()) + " mm"]), v => set("hgt", +v)),
    lab(tr("Piny:"), tr("Piny wciska się w otwory dna i w spód przegródki. Własne – kształt jak USSA, ale po stronie przegródki cieńsze o wybrany luz (pasują też do przegródek USSA; piny USSA mają tam Ø 4,0 – tyle co gniazdo). Ciasne i luźne USSA różnią się tylko końcem w dnie.")),
    sel(state.gdPin || "gen", [["gen", tr("własne z luzem")], ["tight", tr("ciasne (tight)")], ["loose", tr("luźne (loose)")]], v => setG("gdPin", v)),
    ...((state.gdPin || "gen") === "gen" ? [
      sel(GD_PIN_LUZ.includes(+state.gdPinLuz) ? String(+state.gdPinLuz) : "0.2", GD_PIN_LUZ.map(x => [String(x), tr("luz {l} mm", { l: x.toLocaleString(locale()) })]), v => setG("gdPinLuz", +v)),
      sel(state.gdPinDol === "l" ? "l" : "t", [["t", tr("w dnie ciasno")], ["l", tr("w dnie luźno")]], v => setG("gdPinDol", v))] : []),
    chk(!!state.gdCap, tr("wolne końce z zaokrąglonym zakończeniem"), v => setG("gdCap", v)),
    lab(tr("Części brzegowe:"), tr("Na wymiar – generuje konfigurator: blok od końca przegródki do ścianki, bez szczeliny. USSA – Straight Edge Piece z blokiem 8 mm (przy ściankach S/M zostaje odsłonięty język).")),
    sel(state.gdEdge === "ussa" ? "ussa" : "fit", [["fit", tr("na wymiar")], ["ussa", "USSA (Straight Edge Piece)"]], v => setG("gdEdge", v)));
  const tools = el("div", { class: "row" },
    el("button", { class: "small", onclick: () => gdPreset(s, g, "h2") }, tr("Na pół w poprzek")),
    el("button", { class: "small", onclick: () => gdPreset(s, g, "v2") }, tr("Na pół wzdłuż")),
    el("button", { class: "small", disabled: GD.sel < 0 && GD.selA < 0 && GD.selP < 0, onclick: () => gdDelete(s) }, tr("Usuń")),
    el("button", { class: "small", disabled: !count(i.key), onclick: () => { gdPreset(s, g, "clear"); toast(tr("Wyczyszczono przegródki szuflady")); } }, tr("Wyczyść")),
    same.length ? sel("", [["", tr("skopiuj z…")], ...same.map(x => [x.key, x.label])], v => {
      if (!v) return; histBreak(); s.lines = JSON.parse(JSON.stringify(state.gd[v].lines || [])); s.arcs = JSON.parse(JSON.stringify(state.gd[v].arcs || [])); s.cross = JSON.parse(JSON.stringify(state.gd[v].cross || []));
      s.posts = JSON.parse(JSON.stringify(state.gd[v].posts || []));
      GD.sel = GD.selA = GD.selP = -1; save(); renderResult();
    }) : null);
  // rysowanie: przegródka albo łuk 90° / 180° o promieniu r odstępów (środek – otwór, kierunek – przeciągnięciem)
  const draw = el("div", { class: "row" }, lab(tr("Rysuj:"), tr("Łuk: kliknij otwór w środku łuku i przeciągnij w stronę, w którą ma się wyginać. Końce łuku leżą w otworach – dociągnij do nich przegródki.")),
    sel(GD.mode, [["line", tr("przegródkę")], ["a90", tr("łuk 90°")], ["a180", tr("łuk 180° (zawrót)")], ["p1", tr("słupek (1 pin)")], ["p4", tr("słupek (4 piny)")], ["p5", tr("słupek (5 pinów)")]], v => { GD.mode = v; renderResult(); }),
    (GD.mode === "a90" || GD.mode === "a180") || GD.selA >= 0 ? [lab(tr("Promień:"), tr("Promień łuku w odstępach siatki (10,5 mm), mierzony do osi przegródki.")),
      sel(GD.selA >= 0 ? s.arcs[GD.selA].r : GD.rad, Array.from({ length: 9 }, (_, k) => [k + 2, `${k + 2} (${((k + 2) * GD_PITCH).toLocaleString(locale())} mm)`]),
        v => { if (GD.selA >= 0) gdArcSet(s, { r: +v }); else { GD.rad = +v; renderResult(); } })] : null,
    GD.selA >= 0 ? [el("button", { class: "small", title: tr("Obróć zaznaczony łuk o 90° (klawisz R)"), onclick: () => gdArcSet(s, { a0: (s.arcs[GD.selA].a0 + 90) % 360 }) }, "↻ " + tr("Obróć")),
      el("span", { class: "hint" }, tr("Zaznaczony łuk: przeciągnij, żeby przesunąć, albo strzałki – o jeden otwór."))] : null,
    // słupek: średnica i wysokość nowego albo zaznaczonego (wysokości do wysokości szuflady)
    gdPostMode(GD.mode) || GD.selP >= 0 ? (() => {
      const P = GD.selP >= 0 ? s.posts[GD.selP] : null, ps = (k, v) => { if (P) { histBreak(); P[k] = v; save(); } else GD[k === "d" ? "postD" : "postH"] = v; renderResult(); };
      return [lab(tr("Słupek:"), tr("Słupek z pinami w otworach dna: 1 pin – nad otworem, okrągła podstawa 3 mm; 4 piny – na środku kratki między otworami (podstawa 20 mm); 5 pinów – nad otworem (podstawa 30 mm). Średnica – stopa łuku przy podstawie, u góry szyjka Ø 5 mm. Kliknij w siatkę, żeby go postawić; kliknij słupek, żeby go zaznaczyć.")),
        sel(P ? P.d : GD.postD, GD_POST_D.map(x => [x, "Ø " + x + " mm"]), v => ps("d", +v)),
        sel(P ? (postHs.includes(P.h) ? P.h : postHs[postHs.length - 1]) : GD.postH, postHs.map(x => [x, x.toLocaleString(locale()) + " mm (" + ({ 34.5: "1F", 82.5: "2F", 178.5: "4F" })[x] + ")"]), v => ps("h", +v))];
    })() : null);
  const postWarn = (s.posts.length || gdPostMode(GD.mode)) && !gdPostOk()
    ? serverNote(tr("Słupki generuje serwer konfiguratora (wersja generatora {v}) – uruchom konfigurator ponownie po aktualizacji.", { v: GD_POST_VER }), "err") : null;
  const arcWarn = (s.arcs.length || s.lines.length || GD.mode !== "line") && !gdArcOk()
    ? serverNote(tr("Łuki, łączniki, krótkie przegródki i części brzegowe na wymiar generuje serwer konfiguratora (biblioteka manifold3d, wersja generatora 26) – uruchom konfigurator ponownie po aktualizacji."), "err") : null;

  // lista części tej szuflady
  const parts = gdParts(i, s);
  const list = el("ul", { class: "gd-parts" }, parts.map(p => {
    const f = p.gen ? p.file : findAll(p.rx)[0];
    return el("li", {}, `${p.n}× ${p.label}`, f ? null : el("span", { class: "err" }, " – " + tr("brak pliku w bibliotece")));
  }));
  const errs = [...res.map((r, k) => r.err ? el("li", { class: "err" }, tr("Przegródka {k}: {err}", { k: k + 1, err: r.err })) : null),
    ...s.arcs.map((A, k) => { const e = gdArcErr(g, A); return e ? el("li", { class: "err" }, tr("Łuk {k}: {err}", { k: k + 1, err: e })) : null; }),
    ...s.posts.map((P, k) => { const e = gdPostErr(g, s, res, k); return e ? el("li", { class: "err" }, tr("Słupek {k}: {err}", { k: k + 1, err: e })) : null; })].filter(Boolean);

  // null (brak ostrzeżenia) wstawiałby tekst „null” – filtr (zrzut użytkownika 2026-11-05)
  box.replaceChildren(...[el("h3", {}, tr("Przegródki szuflad (Grid Dividers)")), head, opts,
    el("p", { class: "hint" }, tr("Przeciągnij wzdłuż rzędu albo kolumny otworów, żeby wstawić przegródkę; poza ostatni otwór – do ścianki. Kliknij przegródkę, żeby ją zaznaczyć (Delete – usuń, Esc – odznacz). Połączenia przegródek (T, narożnik, skrzyżowanie) dostają łączniki: trójnik, kątownik, krzyżak.")),
    tools, draw, arcWarn === null ? postWarn : arcWarn, el("div", { class: "gd-wrap" }, gdEditor(i, s, g, res),
      el("div", { class: "gd-side" }, el("b", {}, tr("Części dla tej szuflady (× {n}):", { n: i.qty })),
        parts.length ? list : el("p", { class: "hint" }, tr("Brak przegródek.")), errs.length ? el("ul", {}, errs) : null,
        el("p", { class: "hint" }, tr("Długości jak w plikach USSA: liczba w nazwie to liczba odstępów 10,5 mm. Przy ściance – przegródka i część brzegowa (szczelnie), przy innej przegródce – sama przegródka."))))].filter(Boolean));
}

// zaznaczony łuk: przesunięcie o (du, dv) otworów (środek w siatce), obrót, promień
function gdMoveArc(s, g, du, dv) {
  const A = s.arcs[GD.selA];
  if (!A) return;
  const u = Math.max(0, Math.min(g.C - 1, A.u + du)), v = Math.max(0, Math.min(g.R - 1, A.v + dv));
  if (u === A.u && v === A.v) { renderResult(); return; }
  histBreak(); A.u = u; A.v = v; save(); renderResult();
}
function gdArcSet(s, ch) {
  const A = s.arcs[GD.selA];
  if (!A) return;
  histBreak(); Object.assign(A, ch); save(); renderResult();
}
function gdDelete(s) {
  if (GD.sel < 0 && GD.selA < 0 && GD.selP < 0) return;
  histBreak();
  const post = GD.selP >= 0;
  if (post) s.posts.splice(GD.selP, 1);
  else if (GD.sel >= 0) { s.lines.splice(GD.sel, 1); gdNormalize(s); } else s.arcs.splice(GD.selA, 1);
  GD.sel = GD.selA = GD.selP = -1; save(); renderResult(); toast(post ? tr("Usunięto słupek") : tr("Usunięto przegródkę"));
}

// siatka otworów: przód na dole (jak w zakładce pojemników), skala dopasowana do szerokości
function gdEditor(i, s, g, res) {
  const W = (g.wall.h[1] - g.wall.h[0]) * GD_PITCH, H = (g.wall.v[1] - g.wall.v[0]) * GD_PITCH;
  const k = Math.max(1.1, Math.min(3, 560 / W, 520 / H));
  const X = u => (u - g.wall.h[0]) * GD_PITCH * k, Y = v => (g.wall.v[1] - v) * GD_PITCH * k;
  const box = el("div", { class: "gd-grid", style: `width:${(W * k).toFixed(0)}px;height:${(H * k).toFixed(0)}px` });
  // stopy (25,4 mm) i ścianki (6 mm) przegródek, części brzegowe i piny
  const bar = (L, a, b, half, cls, title) => {
    const [u0, u1] = [Math.min(a, b), Math.max(a, b)];
    const st = L.o === "h"
      ? `left:${X(u0).toFixed(1)}px;width:${((u1 - u0) * GD_PITCH * k).toFixed(1)}px;top:${(Y(L.a) - half * k).toFixed(1)}px;height:${(2 * half * k).toFixed(1)}px`
      : `top:${Y(u1).toFixed(1)}px;height:${((u1 - u0) * GD_PITCH * k).toFixed(1)}px;left:${(X(L.a) - half * k).toFixed(1)}px;width:${(2 * half * k).toFixed(1)}px`;
    return el("div", { class: "gd-bar " + cls, style: st, ...(title ? { title } : {}) });
  };
  const pins = new Set();
  s.lines.forEach((L, li) => {
    const r = res[li], cls = (r.err ? " bad" : "") + (li === GD.sel ? " sel" : "");
    box.append(bar(L, r.start, r.end, GD_FOOT, "foot" + cls));
    const wall = g.wall[L.o];
    r.ends.forEach((t, e) => {
      const p = e ? r.end : r.start, w = wall[e];
      if (t === "wall") box.append(r.short ? bar(L, p, w + (e ? -0.05 : 0.05), 3, "wall short" + cls) : bar(L, p, w, 3, "edge" + cls, tr("część brzegowa")));
      if (t === "free" && state.gdCap && !r.short) box.append(bar(L, p, p + (e ? 1 : -1), 3, "edge cap" + cls, tr("zakończenie zaokrąglone")));
    });
    const b = bar(L, r.start, r.end, 3, "wall" + (r.short ? " short" : "") + cls, r.err || (r.absorb ? tr("część łącznika albo łuku (przedłużone ramię)") : r.short ? tr("krótka przegródka {n} – generuje konfigurator", { n: r.n }) : tr("przegródka {n}", { n: r.n })));
    b.dataset.line = li;
    b.append(el("span", {}, String(r.n)));
    box.append(b);
    const pp = r.err || r.absorb ? [] : r.short ? (q => { const x = gdShortPins(q); return x.length > 1 ? [x[0], x[x.length - 1]] : x; })(gdShortGen(g, L, r, 20)).map(x => r.start + x / GD_PITCH)
      : [r.start + 1.5, r.end - 1.5];
    for (const p of pp) pins.add(L.o === "h" ? `${Math.round(p)},${L.a}` : `${L.a},${Math.round(p)}`);
  });
  // krzyżaki: kwadrat stopy, ramiona do połowy odstępu, pin w środku
  for (const [u, v] of s.cross || []) {
    const J = gdJoint(s.lines, [u, v]), t = { x: tr("krzyżak „+”"), t: tr("trójnik"), l: tr("kątownik") }[J.k], ext = gdJointExt(res, [u, v], J);
    GD_CANON[J.k].forEach((c, i) => { const d = (c + J.a0) % 360; for (const j of gdExtPins(ext && ext[i], 1)) pins.add(`${u + j * gdCos(d)},${v + j * gdSin(d)}`); });
    box.append(bar({ o: "h", a: v }, u - 0.5, u + 0.5, 5.25, "foot", t));
    for (const d of J.dirs) {
      const L = d % 180 === 0 ? { o: "h", a: v } : { o: "v", a: u }, c = d % 180 === 0 ? u : v, sg = d < 180 ? 1 : -1;
      box.append(bar(L, c, c + sg * GD_ARM, GD_FOOT, "foot", t), bar(L, c - sg * 0.3, c + sg * GD_ARM, 3, "wall", t));
    }
    pins.add(`${u},${v}`);
  }
  // łuki – SVG nad siatką: stopa i ścianka (z odcinkami prostymi do połowy odstępu za końcami)
  const arcPath = A => {
    const P = (u, v) => `${X(u).toFixed(1)} ${Y(v).toFixed(1)}`, rr = (A.r * GD_PITCH * k).toFixed(1), [e0, e1] = gdArcEnds(A);
    let d = `M ${P(e0.E[0] + e0.d[0] * 0.5, e0.E[1] + e0.d[1] * 0.5)} L ${P(...e0.E)}`;
    for (let a = A.a0 + 90; a <= A.a0 + A.kat; a += 90) d += ` A ${rr} ${rr} 0 0 0 ${P(A.u + A.r * gdCos(a), A.v + A.r * gdSin(a))}`;
    return d + ` L ${P(e1.E[0] + e1.d[0] * 0.5, e1.E[1] + e1.d[1] * 0.5)}`;
  };
  const arcSvg = (A, cls, idx) => `<path class="foot${cls}" d="${arcPath(A)}" stroke-width="${(2 * GD_FOOT * k).toFixed(1)}"/>` +
    `<path class="wall${cls}" d="${arcPath(A)}" stroke-width="${(6.34 * k).toFixed(1)}"${idx >= 0 ? ` data-arc="${idx}"` : ""}><title>${gdArcErr(g, A) || tr("łuk {kat}°, promień {r} odstępów", { kat: A.kat, r: A.r })}</title></path>`;
  const svg = el("div", { class: "gd-svg" });
  // shift – przesuwany zaznaczony łuk (podgląd w czasie przeciągania)
  const drawArcs = (extra = null, shift = null) => {
    svg.innerHTML = `<svg width="100%" height="100%">${s.arcs.map((A, ai) => {
      const B = shift && ai === GD.selA ? { ...A, u: A.u + shift[0], v: A.v + shift[1] } : A;
      return arcSvg(B, (gdArcErr(g, B) ? " bad" : "") + (ai === GD.selA ? " sel" : ""), ai);
    }).join("")}${extra ? arcSvg(extra, " pick", -1) : ""}</svg>`;
  };
  drawArcs();
  box.append(svg);
  for (const [ai, A] of s.arcs.entries()) if (!gdArcErr(g, A)) {
    for (const [u, v] of gdArcPins(A)) pins.add(`${u},${v}`);
    const ext = gdArcExt(res, ai);
    if (ext) gdArcEnds(A).forEach(({ E, d }, k) => { for (const j of gdExtPins(ext[k])) pins.add(`${E[0] + j * d[0]},${E[1] + j * d[1]}`); });
  }
  // słupki: podstawa (kwadrat 20 / 30 mm) i trzon (koło Ø d) – klik zaznacza
  s.posts.forEach((P, pi) => {
    const err = gdPostErr(g, s, res, pi), [cu, cv] = gdPostC(P), B = gdPostHalf(P), dd = (GD_POST_D.includes(P.d) ? P.d : 12) * k;
    box.append(el("div", { class: "gd-bar base" + (err ? " bad foot" : ""), style: `left:${(X(cu) - B * k).toFixed(1)}px;top:${(Y(cv) - B * k).toFixed(1)}px;width:${(2 * B * k).toFixed(1)}px;height:${(2 * B * k).toFixed(1)}px` + (gdPostP(P) === 1 ? ";border-radius:50%" : "") }));
    box.append(el("div", { class: "gd-post" + (err ? " bad" : "") + (pi === GD.selP ? " sel" : ""), "data-post": pi,
      title: err || gdPostLabel(gdPostP(P), { d: GD_POST_D.includes(P.d) ? P.d : 12, h: (gdPostGen(P, i.h).h).toLocaleString(locale()) }),
      style: `left:${(X(cu) - dd / 2).toFixed(1)}px;top:${(Y(cv) - dd / 2).toFixed(1)}px;width:${dd.toFixed(1)}px;height:${dd.toFixed(1)}px` }));
    if (!err) for (const [u, v] of gdPostPins(P)) pins.add(`${u},${v}`);
  });
  const dot = Math.max(3, 4 * k);
  for (let jj = 0; jj < g.R; jj++) for (let ii = 0; ii < g.C; ii++)
    box.append(el("div", { class: "gd-hole" + (pins.has(`${ii},${jj}`) ? " pin" : ""),
      style: `left:${(X(ii) - dot / 2).toFixed(1)}px;top:${(Y(jj) - dot / 2).toFixed(1)}px;width:${dot.toFixed(1)}px;height:${dot.toFixed(1)}px` }));
  const prev = el("div", { class: "gd-bar wall pick", style: "display:none" });
  box.append(prev);

  // przeciąganie: początek – najbliższy otwór (albo ścianka, gdy kursor jest za skrajnym otworem); kierunek – większe przesunięcie
  const at = e => { const r = box.getBoundingClientRect(); return [(e.clientX - r.left) / (GD_PITCH * k) + g.wall.h[0], g.wall.v[1] - (e.clientY - r.top) / (GD_PITCH * k)]; };
  const idx = (u, N) => u < -0.4 ? -1 : u > N - 1 + 0.4 ? N : Math.max(0, Math.min(N - 1, Math.round(u)));
  const lineOf = (p0, p1) => {
    const du = p1[0] - p0[0], dv = p1[1] - p0[1];
    if (Math.max(Math.abs(du), Math.abs(dv)) < 0.6) return null;
    if (Math.abs(du) >= Math.abs(dv)) {
      const a = Math.max(0, Math.min(g.R - 1, Math.round(p0[1]))), s0 = idx(p0[0], g.C), s1 = idx(p1[0], g.C);
      return { o: "h", a, s: Math.min(s0, s1), e: Math.max(s0, s1) };
    }
    const a = Math.max(0, Math.min(g.C - 1, Math.round(p0[0]))), s0 = idx(p0[1], g.R), s1 = idx(p1[1], g.R);
    return { o: "v", a, s: Math.min(s0, s1), e: Math.max(s0, s1) };
  };
  // łuk: środek – najbliższy otwór; 90° – ćwiartka w stronę kursora, 180° – wierzchołek w stronę kursora
  const arcOf = (p0, p1) => {
    const u = Math.max(0, Math.min(g.C - 1, Math.round(p0[0]))), v = Math.max(0, Math.min(g.R - 1, Math.round(p0[1])));
    const du = p1[0] - u, dv = p1[1] - v;
    if (Math.max(Math.abs(du), Math.abs(dv)) < 0.6) return null;
    const kat = GD.mode === "a180" ? 180 : 90;
    const a0 = kat === 90 ? (du >= 0 ? (dv >= 0 ? 0 : 270) : (dv >= 0 ? 90 : 180))
      : Math.abs(du) >= Math.abs(dv) ? (du > 0 ? 270 : 90) : (dv > 0 ? 0 : 180);
    return { u, v, r: GD.rad, kat, a0 };
  };
  box.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    const t = e.target.closest("[data-line]"), ta = e.target.closest("[data-arc]"), tp = e.target.closest("[data-post]");
    // zaznaczony łuk – przeciągnięcie przesuwa go po otworach (prośba użytkownika: trudno trafić od razu)
    GD.drag = { p0: at(e), line: t ? +t.dataset.line : -1, arc: ta ? +ta.dataset.arc : -1, post: tp ? +tp.dataset.post : -1, moved: false, move: !!ta && +ta.dataset.arc === GD.selA };
    box.setPointerCapture(e.pointerId);
  });
  box.addEventListener("pointermove", e => {
    if (!GD.drag) return;
    if (GD.drag.move) {
      const p = at(e), d = [Math.round(p[0] - GD.drag.p0[0]), Math.round(p[1] - GD.drag.p0[1])];
      if (d[0] || d[1]) GD.drag.moved = true;
      GD.drag.d = d; drawArcs(null, d);
      return;
    }
    if (gdPostMode(GD.mode)) return;  // słupek – na kliknięcie
    if (GD.mode !== "line") {
      const A = arcOf(GD.drag.p0, at(e));
      if (A) GD.drag.moved = true;
      drawArcs(A);
      return;
    }
    const L = lineOf(GD.drag.p0, at(e));
    if (!L) { prev.style.display = "none"; return; }
    GD.drag.moved = true;
    const N = gdLen(g, L.o), a = L.s < 0 ? g.wall[L.o][0] : L.s - 0.5, b = L.e >= N ? g.wall[L.o][1] : L.e + 0.5;
    const pb = bar(L, a, b, 3, "wall pick");
    prev.style.cssText = pb.style.cssText; prev.style.display = "";
  });
  const end = e => {
    const d = GD.drag; GD.drag = null;
    if (!d) return;
    prev.style.display = "none";
    if (d.move) {
      if (d.moved && d.d) gdMoveArc(s, g, d.d[0], d.d[1]); else { GD.selA = -1; renderResult(); }
      return;
    }
    // słupek: kliknięcie w słupek – zaznaczenie, w siatkę – nowy słupek (4 piny – kratka pod kursorem, 5 – najbliższy otwór)
    if (d.post >= 0) { GD.selP = d.post === GD.selP ? -1 : d.post; GD.sel = GD.selA = -1; renderResult(); return; }
    if (gdPostMode(GD.mode)) {
      const p = +GD.mode[1], [x, y] = d.p0;
      const u = p === 4 ? Math.floor(x) : Math.round(x), v = p === 4 ? Math.floor(y) : Math.round(y);
      histBreak(); s.posts.push({ u, v, p, d: GD.postD, h: GD.postH }); GD.sel = GD.selA = -1; GD.selP = s.posts.length - 1;
      save(); renderResult(); return;
    }
    if (d.moved && GD.mode !== "line") {
      const A = arcOf(d.p0, at(e));
      if (A && !s.arcs.some(x => x.u === A.u && x.v === A.v && x.r === A.r && x.kat === A.kat && x.a0 === A.a0)) { histBreak(); s.arcs.push(A); save(); }
      GD.sel = GD.selA = -1; renderResult(); return;
    }
    const L = d.moved ? lineOf(d.p0, at(e)) : null;
    if (L && L.e > L.s) { histBreak(); gdAddLine(s, L); GD.sel = GD.selA = -1; save(); renderResult(); return; }
    if (!d.moved) {
      if (d.arc >= 0) { GD.selA = d.arc === GD.selA ? -1 : d.arc; GD.sel = -1; }
      else { GD.sel = d.line === GD.sel ? -1 : d.line; GD.selA = -1; }
      GD.selP = -1;
      renderResult();
    }
  };
  box.addEventListener("pointerup", end);
  box.addEventListener("pointercancel", () => { GD.drag = null; prev.style.display = "none"; drawArcs(); });
  return el("div", { class: "bin-gridwrap" }, el("div", { class: "hint" }, tr("tył")), box, el("div", { class: "hint" }, tr("przód")));
}
// Delete / Esc w zakładce przegródek (poza polami formularza)
document.addEventListener("keydown", e => {
  if (typeof state === "undefined" || state.tab !== "gd" || (e.target.closest && e.target.closest("input, select, textarea"))) return;
  const s = state.gd && state.gd[state.gdCur];
  if (!s) return;
  if (e.key === "Delete" && (GD.sel >= 0 || GD.selA >= 0 || GD.selP >= 0)) { e.preventDefault(); gdDelete(s); }
  const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];  // w górę = do tyłu
  if (mv && GD.selA >= 0) { e.preventDefault(); const i = gdInstances().find(x => x.key === state.gdCur); if (i) gdMoveArc(s, gdGeo(i.fam, i.d), ...mv); }
  if ((e.key === "r" || e.key === "R") && GD.selA >= 0 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); gdArcSet(s, { a0: (s.arcs[GD.selA].a0 + 90) % 360 }); }
  if (e.key === "Escape" && (GD.sel >= 0 || GD.selA >= 0 || GD.selP >= 0)) { GD.sel = GD.selA = GD.selP = -1; renderResult(); }
});
