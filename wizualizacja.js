// Wizualizacja 3D wieży VAULT – okno otwierane przyciskiem „Wizualizacja 3D” w podglądzie zestawu (openViz()).
// WebGL2 bez bibliotek (program działa bez internetu). Wymiary z geometrii plików STL: szerokości z WIDTH_MM,
// moduł = 48·F + 9 mm, głębokość = 42·d + 20 mm, front 10 mm, podstawa 52 mm. Gdy działa serwer, moduły, fronty,
// pudełka, wieka, dachy, podstawa, stopki, koła i uchwyt górny są rysowane z uproszczonych siatek plików STL
// (siatki3d.py, „Siatki z plików STL” niżej); bez nich – bryły poglądowe.
// Korzysta z globalnych z index.html: state, tr, el, save, FAMILIES, LAYOUT_WIDTH, WIDTH_MM, baseWidth.
"use strict";

// Palety z kolorów filamentów Bambu PLA Basic (wartości z Bambu Studio, filaments_color_codes.json; te same są w COLOR_PALETTE
// w index.html), więc „Wklej kolory z widoku 3D” w „Przygotuj wydruk” daje konkretne filamenty (2026-11-05, prośba
// użytkownika: spójne kolory i kilka nowych wariantów). Każda paleta ma 3–4 filamenty; kontrast stykających się części
// (front – zamek, pudełko – pojemniki, obudowa – front) sprawdzony w CIELAB (ΔE ≥ 20 poza celowo jednakowymi).
// ussa = jak na rysunkach w instrukcji: jasnoszary PLA 10104 (moduły, fronty, nakładki kluczyków, prowadnice), czarne
// pudełka, ślizgi, kluczyki i zamki, pomarańczowe blokady; box = pudełka szuflad, lock = drobne części
const VIZ_PALETTES = {
  ussa: { housing: "#D1D3D5", front: "#D1D3D5", sust: "#D1D3D5", box: "#000000", lock: "#000000", bins: "#FF6A13", stop: "#FF6A13", label: "#FFFFFF" },
  black: { housing: "#000000", front: "#FF6A13", sust: "#D1D3D5", box: "#000000", lock: "#000000", bins: "#FEC600" },
  white: { housing: "#FFFFFF", front: "#FFFFFF", sust: "#D1D3D5", box: "#D1D3D5", lock: "#545454", bins: "#0056B8" },
  graphite: { housing: "#545454", front: "#A6A9AA", sust: "#5B6579", box: "#000000", lock: "#000000", bins: "#E4BD68" },
  forest: { housing: "#3F8E43", front: "#F7E6DE", sust: "#847D48", box: "#6F5034", lock: "#6F5034", bins: "#E4BD68" },
  navy: { housing: "#5B6579", front: "#FFFFFF", sust: "#FFFFFF", box: "#0A2989", lock: "#0A2989", bins: "#FEC600" },
  warm: { housing: "#F7E6DE", front: "#6F5034", sust: "#6F5034", box: "#6F5034", lock: "#F7E6DE", bins: "#FF9016" },
  turquoise: { housing: "#FFFFFF", front: "#00B1B7", sust: "#00B1B7", box: "#545454", lock: "#545454", bins: "#FEC600" },
  red: { housing: "#545454", front: "#C12E1F", sust: "#D1D3D5", box: "#000000", lock: "#000000", bins: "#D1D3D5" },
};
// Okno 3D koloruje każdą część kolorem jej grupy wydruku (index.html: COLOR_GROUPS, colorGroup) – 2026-11-05, zgłoszenie
// użytkownika: paleta „beż + kakao” po „Wklej kolory z widoku 3D” nie dawała się wydrukować, bo okno 3D dzieliło części
// inaczej niż „Przygotuj wydruk” (blokady, etykiety, kręgosłup, fronty skrzynek). Teraz jedna tabela: grupa wydruku → rola
// palety. Role bez wartości: stop, label, dark – jak drobne, tyre – czarny; sust – jak fronty; lid, roof, mods – jak obudowa;
// insert / insertS – kolor palety najbardziej różny od pudełka / obudowy (wkład leży w pudełku szuflady / w module skrzynki).
const VIZ_GROUP_ROLE = { moduly: "housing", fronty: "front", fronty_skrzynek: "sust", pudelka: "box", drobne: "lock",
  blokady: "stop", etykiety: "label", uchwyty: "dark", wieka: "lid", dachy: "roof", modyfikacje: "mods", opony: "tyre",
  wklady: "insert", wklady_skrzynek: "insertS", pojemniki: "bins", przegrodki: "divs" };
const VIZ_ROLES = Object.values(VIZ_GROUP_ROLE);
// gotowe palety mają wszystkie role (brakujące = null), żeby wybór palety nadpisał kolory poprzedniej
for (const p of Object.values(VIZ_PALETTES)) for (const k of VIZ_ROLES) if (!(k in p)) p[k] = null;
// kolor do rysowania: czarny filament jako bardzo ciemny szary (czysta czerń gubi cieniowanie brył)
const vizShow = hex => { const c = vHex(hex); return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] < 0.12 ? c.map((v, i) => Math.max(v, [0.137, 0.141, 0.153][i])) : c; };
// kolory grup wydruku ({moduly: "#RRGGBB", …}) dla ustawień okna 3D V – wspólne dla sceny, miniatur i „Wklej kolory z widoku 3D”
function vizGroupColors(V) {
  const u = VIZ_PALETTES.ussa, ok = c => /^#[0-9a-f]{6}$/i.test(c || "") ? c : null, r = {};
  for (const k of VIZ_ROLES) r[k] = ok(V[k]);
  for (const k of ["housing", "front", "box", "lock", "bins"]) r[k] = r[k] || u[k];
  r.sust = r.sust || r.front;
  for (const k of ["stop", "label", "dark"]) r[k] = r[k] || r.lock;
  r.tyre = r.tyre || "#000000";  // opony z TPU – bez własnego koloru czarne (2026-11-07, wcześniej „do rozważenia” w CLAUDE.md)
  for (const k of ["lid", "roof", "mods"]) r[k] = r[k] || r.housing;
  const far = bg => [r.housing, r.front, r.sust, r.lock, r.box].reduce((a, c) =>
    Math.hypot(...vHex(c).map((v, i) => v - vHex(bg)[i])) > Math.hypot(...vHex(a).map((v, i) => v - vHex(bg)[i])) ? c : a);
  r.insert = r.insert || far(r.box);
  r.insertS = r.insertS || far(r.housing);
  r.divs = r.divs || r.bins;  // przegródki Grid Dividers – domyślnie jak pojemniki gridfinity (prośba użytkownika 2026-11-05)
  return Object.fromEntries(Object.entries(VIZ_GROUP_ROLE).map(([g, k]) => [g, r[k]]));
}
const vizGroupRoles = V => { const G = vizGroupColors(V); return Object.fromEntries(Object.entries(VIZ_GROUP_ROLE).map(([g, k]) => [k, G[g]])); };
// paleta „druk”: kolory części wybrane w „Przygotuj wydruk” (state.colors); grupa bez koloru – jak wyżej (null)
const vizPrintColors = () => {
  const k = state.colors || {};
  return Object.fromEntries(Object.entries(VIZ_GROUP_ROLE).map(([g, role]) => [role, k[g] || null]));
};
// [obrót wokół pionu, pochylenie] w radianach
const VIZ_VIEWS = { front: [0, 0.08], side: [Math.PI / 2, 0.08], q: [0.62, 0.38], top: [0.25, 1.4], back: [Math.PI + 0.55, 0.32] };
const VIZ_FOV = 35 * Math.PI / 180;

// ---------- Wektory, macierze, kolory ----------
const vSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vMul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vNorm = a => vMul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const M4 = {
  persp(f, a, n, fa) {
    const t = 1 / Math.tan(f / 2);
    return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]);
  },
  ortho(hw, hh, n, fa) {  // rzut prostokątny: połowa szerokości i wysokości widoku
    return new Float32Array([1 / hw, 0, 0, 0, 0, 1 / hh, 0, 0, 0, 0, 2 / (n - fa), 0, 0, 0, (fa + n) / (n - fa), 1]);
  },
  look(e, c, u) {
    const z = vNorm(vSub(e, c)), x = vNorm(vCross(u, z)), y = vCross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -vDot(x, e), -vDot(y, e), -vDot(z, e), 1]);
  },
  mul(a, b) {  // kolumnowo: (a·b)
    const o = new Float32Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
      o[i * 4 + j] = s;
    }
    return o;
  },
};
const vHex = h => {
  const m = /^#?([0-9a-f]{6})$/i.exec((h || "").trim());
  const n = m ? parseInt(m[1], 16) : 0x888888;
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
};
const vMix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const V_WHITE = [1, 1, 1], V_BLACK = [0, 0, 0];

// ---------- Budowa siatki ----------
// xf: przesunięcie {t:[x,y,z]} (wysunięta szuflada) i/lub obrót wokół osi X {a, py, pz} (front skrzynki na zawiasach)
function vizMesh() {
  const tri = [], lin = [], lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const EDGE = [0, 0, 0, 0.32];
  // xf: najpierw obrót wokół osi z przez (rx, ry) – kluczyk szuflady, potem obrót wokół osi x przez (py, pz), potem przesunięcie t
  const xp = (p, xf) => {
    if (!xf) return p;
    let [x, y, z] = p;
    if (xf.rz) {
      const c = Math.cos(xf.rz), s = Math.sin(xf.rz), dx = x - xf.rx, dy = y - xf.ry;
      x = xf.rx + dx * c - dy * s; y = xf.ry + dx * s + dy * c;
    }
    if (xf.a) {
      const c = Math.cos(xf.a), s = Math.sin(xf.a), dy = y - xf.py, dz = z - xf.pz;
      y = xf.py + dy * c - dz * s; z = xf.pz + dy * s + dz * c;
    }
    if (xf.t) { x += xf.t[0]; y += xf.t[1]; z += xf.t[2]; }
    return [x, y, z];
  };
  const xn = (n, xf) => {
    if (!xf || (!xf.a && !xf.rz)) return n;
    if (xf.rz) { const c = Math.cos(xf.rz), s = Math.sin(xf.rz); n = [n[0] * c - n[1] * s, n[0] * s + n[1] * c, n[2]]; }
    if (!xf.a) return n;
    const c = Math.cos(xf.a), s = Math.sin(xf.a);
    return [n[0], n[1] * c - n[2] * s, n[1] * s + n[2] * c];
  };
  const grow = p => { for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); } };
  const poly = (pts, n, col, xf, order) => {
    const P = pts.map(p => xp(p, xf)), N = xn(n, xf);
    for (const i of order) tri.push(P[i][0], P[i][1], P[i][2], N[0], N[1], N[2], col[0], col[1], col[2]);
    P.forEach(grow);
  };
  const quad = (a, b, c, d, n, col, xf) => poly([a, b, c, d], n, col, xf, [0, 1, 2, 0, 2, 3]);
  const line = (a, b, rgba, xf) => {
    const A = xp(a, xf), B = xp(b, xf);
    lin.push(A[0], A[1], A[2], ...rgba, B[0], B[1], B[2], ...rgba);
  };
  function boxEdges(a, b, xf, rgba = EDGE) {
    const [x0, y0, z0] = a, [x1, y1, z1] = b;
    const c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]])
      line(c[i], c[j], rgba, xf);
  }
  function box(a, b, col, xf = null, edges = true) {
    const [x0, y0, z0] = a, [x1, y1, z1] = b;
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], col, xf);
    quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], col, xf);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], col, xf);
    quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], col, xf);
    quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], col, xf);
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], col, xf);
    if (edges) boxEdges(a, b, xf);
  }
  // walec: c = środek, axis 0/1/2 = oś X/Y/Z
  function cyl(c, axis, r, len, col, xf = null, segs = 24) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3;
    const pt = (ang, s) => { const p = c.slice(); p[axis] += s * len / 2; p[u] += r * Math.cos(ang); p[v] += r * Math.sin(ang); return p; };
    for (let i = 0; i < segs; i++) {
      const a0 = i / segs * 2 * Math.PI, a1 = (i + 1) / segs * 2 * Math.PI, am = (a0 + a1) / 2;
      const n = [0, 0, 0]; n[u] = Math.cos(am); n[v] = Math.sin(am);
      quad(pt(a0, -1), pt(a1, -1), pt(a1, 1), pt(a0, 1), n, col, xf);
      for (const s of [-1, 1]) {
        const cc = c.slice(), nc = [0, 0, 0];
        cc[axis] += s * len / 2; nc[axis] = s;
        poly([cc, pt(a0, s), pt(a1, s)], nc, col, xf, [0, 1, 2]);
      }
    }
  }
  return { tri, lin, lo, hi, xp, grow, box, boxEdges, cyl, line };
}

// Obudowa modułu: dno, sufit, boki i tył – przód otwarty (zakrywają go fronty)
function vizHousing(m, xa, xb, ya, yb, D, col, inner, noTop) {
  const t = 3;
  m.box([xa, ya, -D], [xb, ya + t, 0], col, null, false);
  if (!noTop) m.box([xa, yb - t, -D], [xb, yb, 0], col, null, false);  // skrzynka: górę zastępuje wieko
  m.box([xa, ya + t, -D], [xa + t, yb - t, 0], col, null, false);
  m.box([xb - t, ya + t, -D], [xb, yb - t, 0], col, null, false);
  m.box([xa + t, ya + t, -D], [xb - t, yb - t, -D + t], inner, null, false);
  m.boxEdges([xa, ya, -D], [xb, yb, 0]);
}

// Siatka gridfinity (co 42 mm) na prostokącie [a,b] × [z0,z1] na wysokości y
function vizGrid(m, a, b, z0, z1, y, h, col, xf) {
  for (let x = a + 42; x < b - 6; x += 42) m.box([x - 0.9, y, z0], [x + 0.9, y + h, z1], col, xf, false);
  for (let z = z1 - 42; z > z0 + 6; z -= 42) m.box([a, y, z - 0.9], [b, y + h, z + 0.9], col, xf, false);
}

// ---------- Siatki z plików STL ----------
// Moduły, fronty, pudełka, wieka i dachy mogą być rysowane z uproszczonych siatek prawdziwych plików (serwer:
// /api/siatka, siatki3d.py). Wczytują się w tle; do tego czasu (i bez serwera) zostają bryły poglądowe.
// Ułożenie w pliku STL (sprawdzone na plikach USSA): moduły i wieka – X szerokość, Y wysokość, Z głębokość (tył przy
// Z min), część modułów L/XL i dachy obrócone w XY o ~45° (prostuje je oś główna PCA); pudełka – Z wysokość, Y głębokość;
// fronty – X szerokość, Y wysokość, Z grubość.
const VIZ_STL = { map: new Map(), onload: null };

function vizStlFile(rx) {
  return typeof findAll === "function" ? findAll(rx)[0] || null : null;
}

function vizStlGet(file) {
  let e = VIZ_STL.map.get(file);
  if (e) return e;
  if (typeof WEB !== "undefined" && WEB) { e = { status: "error", fits: new Map() }; VIZ_STL.map.set(file, e); return e; }  // wersja online – bez serwera
  e = { status: "loading", fits: new Map(), file };
  VIZ_STL.map.set(file, e);
  vizStlFetch(file, e).finally(() => VIZ_STL.onload && VIZ_STL.onload());
  return e;
}

// siatka generowana przez serwer z parametrów gen pod własnym kluczem (np. etykieta z napisem ułożona jak we froncie –
// inna niż plik do druku, więc nie pod nazwą pliku, której używają miniatury)
function vizStlGetGen(key, gen) {
  let e = VIZ_STL.map.get(key);
  if (e) return e;
  e = { status: "loading", fits: new Map(), file: key };
  VIZ_STL.map.set(key, e);
  vizStlFetch(key, e, gen).finally(() => VIZ_STL.onload && VIZ_STL.onload());
  return e;
}

// wczytanie siatki do wpisu e (status ok / err); gen – parametry pliku generowanego (pojemnik, etykieta), bryłę liczy serwer
function vizStlFetch(file, e = { status: "loading", fits: new Map() }, gen = null) {
  // pojemnik gridfinity (pojemniki.js): parametry zapisane przy nazwie pliku
  gen = gen || file.startsWith("@gridfinity/") && typeof BIN_GEN !== "undefined" && BIN_GEN.get(file);
  return (gen ? fetch("/api/pojemnik", { method: "POST", headers: { "X-Lang": typeof LANG === "string" ? LANG : "pl", "Content-Type": "application/json" }, body: JSON.stringify(gen) })
    : fetch("/api/siatka?plik=" + encodeURIComponent(file), { headers: { "X-Lang": typeof LANG === "string" ? LANG : "pl" } }))
    .then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status)))
    .then(buf => {
      // VSM2: liczba wierzchołków, trójkątów, długość opisu JSON (fronty: zaślepki i wnęka etykiety), dane
      const h = new DataView(buf), nv = h.getUint32(4, true), nt = h.getUint32(8, true), nm = h.getUint32(12, true);
      if (new TextDecoder().decode(new Uint8Array(buf, 0, 4)) !== "VSM2") throw new Error("format");
      e.meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 16, nm)) || "{}");
      e.pos = new Float32Array(buf, 16 + nm, nv * 3);
      e.idx = new Uint32Array(buf, 16 + nm + nv * 12, nt * 3);
      if (gen && typeof binSplitText === "function") binSplitText(e, e.meta, e);  // litery napisu wpuszczonego – e.text
      e.status = "ok";
      return e;
    })
    .catch(err => { e.status = "err"; console.warn("wizualizacja – siatka", file, err); return e; });
}

// k-ta z n sztuk zapisanych w pliku obok siebie wzdłuż osi `axis` (zawiasy dolne i pręty: 2 wzdłuż Y, zawias górny
// L-XL: 2 wzdłuż X). Trójkąty dzielone po środku ciężkości na n równych pasm bryły otaczającej (pręty w pliku stykają
// się, więc spójność siatki nie wystarcza). Wynik ma własne pos/idx – renderer traktuje go jak osobny plik.
function vizStlPiece(e, k, n, axis = 1) {
  if (e.status !== "ok") return e;
  const key = `${n}/${axis}`;
  if (!e.pieces) e.pieces = new Map();
  let pieces = e.pieces.get(key);
  if (!pieces) {
    const P = e.pos, I = e.idx, nv = P.length / 3;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < nv; i++) { const v = P[3 * i + axis]; if (v < lo) lo = v; if (v > hi) hi = v; }
    pieces = Array.from({ length: n }, () => ({ map: new Int32Array(nv).fill(-1), pos: [], idx: [] }));
    for (let t = 0; t < I.length; t += 3) {
      const c = (P[3 * I[t] + axis] + P[3 * I[t + 1] + axis] + P[3 * I[t + 2] + axis]) / 3;
      const g = pieces[Math.min(n - 1, Math.floor((c - lo) / Math.max(hi - lo, 1e-6) * n))];
      for (let q = 0; q < 3; q++) {
        const i = I[t + q];
        if (g.map[i] < 0) { g.map[i] = g.pos.length / 3; g.pos.push(P[3 * i], P[3 * i + 1], P[3 * i + 2]); }
        g.idx.push(g.map[i]);
      }
    }
    pieces = pieces.map(g => ({ status: "ok", fits: new Map(), meta: e.meta, pos: new Float32Array(g.pos), idx: new Uint32Array(g.idx) }));
    e.pieces.set(key, pieces);
  }
  return pieces[Math.min(k, n - 1)];
}

// Ułożenie siatki: obrót w XY (gdy cfg.rot), zamiana osi cfg.axes (np. "X,Z,-Y": x = X, y = Z, z = −Y) i przesunięcie tak,
// żeby bryła trafiła w prostokąt [a, b]: środek w x, dół (albo góra – cfg.top) w y, przód (z max) na b[2].
function vizStlFit(e, cfg, ar) {
  const key = (cfg.rot ? "r" : "") + cfg.axes + (cfg.flipY ? "f" : "");
  let f = e.fits.get(key);
  if (f) return f;
  const P = e.pos, n = P.length / 3;
  let th = 0;
  if (cfg.rot) {
    // obrót w XY: najmniejszy prostokąt otaczający (moduły L/XL i dachy leżą pod ~45°, wysokie moduły 4F – prosto);
    // z dwóch ułożeń (θ, θ+90°) to, którego proporcje szer./wys. są bliższe miejscu docelowemu (ar; Infinity = płaskie)
    const step = Math.max(1, Math.floor(n / 6000)), xs = [], ys = [];
    for (let i = 0; i < n; i += step) { xs.push(P[3 * i]); ys.push(P[3 * i + 1]); }
    const ext = a => {
      const c = Math.cos(-a), s = Math.sin(-a);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < xs.length; i++) {
        const x = xs[i] * c - ys[i] * s, y = xs[i] * s + ys[i] * c;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return [x1 - x0, y1 - y0];
    };
    const area = a => { const [w, h] = ext(a); return w * h; };
    let best = 0, ba = area(0);
    for (let d = 1; d < 90; d++) { const a = d * Math.PI / 180, v = area(a); if (v < ba - 1e-6) { ba = v; best = a; } }
    for (let d = -1; d <= 1.0001; d += 0.05) { const a = best + d * Math.PI / 180, v = area(a); if (v < ba - 1e-6) { ba = v; best = a; } }
    const norm = a => { while (a > Math.PI / 2) a -= Math.PI; while (a <= -Math.PI / 2) a += Math.PI; return a; };
    const cand = [norm(best), norm(best + Math.PI / 2)].map(a => { const [w, h] = ext(a); return [a, w / Math.max(h, 1e-6)]; });
    const score = r => ar === Infinity ? -r : Math.abs(Math.log(r / ar));
    th = score(cand[0][1]) <= score(cand[1][1]) ? cand[0][0] : cand[1][0];
    if (Math.abs(th) < 0.003) th = 0;
    if (cfg.flipY) th += Math.PI;
  }
  const c = Math.cos(-th), s = Math.sin(-th);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    const x = P[3 * i], y = P[3 * i + 1], q = [x * c - y * s, x * s + y * c, P[3 * i + 2]];
    for (let k = 0; k < 3; k++) { if (q[k] < lo[k]) lo[k] = q[k]; if (q[k] > hi[k]) hi[k] = q[k]; }
  }
  // A: wiersz i = oś widoku, [indeks osi STL, znak]
  const A = cfg.axes.split(",").map(t => [ "XYZ".indexOf(t.slice(-1)), t[0] === "-" ? -1 : 1 ]);
  const qlo = A.map(([k, sg]) => sg > 0 ? lo[k] : -hi[k]), qhi = A.map(([k, sg]) => sg > 0 ? hi[k] : -lo[k]);
  f = { c, s, A, qlo, qhi };
  e.fits.set(key, f);
  return f;
}

// Macierz modelu (kolumnowo) dla siatki e ułożonej w [a, b], z ruchem xf (jak vizMesh: obrót wokół X, przesunięcie)
function vizStlMatrix(f, a, b, cfg, xf) {
  const t = [(a[0] + b[0]) / 2 - (f.qlo[0] + f.qhi[0]) / 2,
    cfg.top ? b[1] - f.qhi[1] : a[1] - f.qlo[1],
    b[2] - f.qhi[2]];
  // wiersze macierzy 3×3: zamiana osi po obrocie w XY
  const rotRow = k => k === 0 ? [f.c, -f.s, 0] : k === 1 ? [f.s, f.c, 0] : [0, 0, 1];
  const R = f.A.map(([k, sg]) => rotRow(k).map(v => v * sg));
  let M = new Float32Array([R[0][0], R[1][0], R[2][0], 0, R[0][1], R[1][1], R[2][1], 0, R[0][2], R[1][2], R[2][2], 0, t[0], t[1], t[2], 1]);
  if (xf) {
    if (xf.rz) {  // obrót wokół osi z przez (rx, ry) – jak xp w vizMesh
      const cs = Math.cos(xf.rz), sn = Math.sin(xf.rz);
      const tr1 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -xf.rx, -xf.ry, 0, 1]);
      const rz = new Float32Array([cs, sn, 0, 0, -sn, cs, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      const tr2 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, xf.rx, xf.ry, 0, 1]);
      M = M4.mul(tr2, M4.mul(rz, M4.mul(tr1, M)));
    }
    if (xf.a) {
      const cs = Math.cos(xf.a), sn = Math.sin(xf.a);
      const tr1 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -xf.py, -xf.pz, 1]);
      const rx = new Float32Array([1, 0, 0, 0, 0, cs, sn, 0, 0, -sn, cs, 0, 0, 0, 0, 1]);
      const tr2 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, xf.py, xf.pz, 1]);
      M = M4.mul(tr2, M4.mul(rx, M4.mul(tr1, M)));
    }
    if (xf.t) M = M4.mul(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, xf.t[0], xf.t[1], xf.t[2], 1]), M);
  }
  return { M, lo: vAdd(f.qlo, t), hi: vAdd(f.qhi, t) };
}

// Wieża według rysunków z instrukcji USSA (Modifications, Roof Types, Drawers Naming): jasnoszare moduły z pomarańczowym
// znacznikiem na bokach, front z okrągłym zamkiem na dole, skrzynka z dwoma zatrzaskami u góry, 2 koła Ø160 z tyłu na pręcie
// przez podstawę i stopka (belka) z przodu, kręgosłup jako czarne listwy na każdym module.
function vizStack(m, S, st, si, x0, P) {
  const fam = baseWidth(st), W = WIDTH_MM[fam], D = 42 * st.depth + 20, x1 = x0 + W, md = st.mods, xm = (x0 + x1) / 2;
  const dark = P.lock, inner = vMix(P.housing, V_BLACK, 0.3), metal = [0.72, 0.73, 0.75];
  const rubber = P.tyre, roofCol = P.roof, lidCol = P.lid;
  // modyfikacje: podstawa, koła, pegboard, uchwyt stały i ścienny – grupa „modyfikacje”; kręgosłup z blokadą i pokrętłami,
  // rączka wysuwana, stopka, część 2 uchwytu ściennego – grupa „uchwyty”
  const modCol = P.mods, modDark = P.dark;
  // wkład gridfinity leży w pudełku szuflady albo w module skrzynki, więc kolor tła by go schował (czarny w czarnym –
  // zgłoszenie użytkownika 2026-11-01); bierze kolor palety najbardziej różny od tła (w „ussa”: w szufladzie jasny,
  // w skrzynce ciemny); paleta „druk” – kolor grupy wkładów
  // (szuflady – grupa „wkłady”, skrzynki z przegródkami – „wkłady i przegródki skrzynek”, vizGroupColors)
  const insertCol = P.insert;
  // pojemniki gridfinity stoją na wkładzie w pudełku: kolor palety najdalszy od obu (w „ussa” – pomarańczowy);
  // paleta „druk” – kolor grupy pojemników
  const binsOn = (a, b) => P.bins || [P.housing, P.front, P.sust, P.lock, P.box, P.stop].reduce((x, c) => {
    const d = k => Math.min(Math.hypot(...k.map((v, i) => v - a[i])), Math.hypot(...k.map((v, i) => v - b[i])));
    return d(c) > d(x) ? c : x;
  });
  const hole = vMix(dark, V_BLACK, 0.55);
  // rozsunięcie w trzech osiach (S.V.explode 0–1; prośba użytkownika 2026-11-03 – „jak w innych konfiguratorach, we wszystkich
  // osiach”): EX mm; każda grupa części dostaje przesunięcie OFF dokładane do xf (po obrotach), więc kształty się nie
  // zmieniają: warstwy, podstawa i dach – w pionie, fronty z zamkami – do przodu, moduły obok siebie (2× S, S + M),
  // blokady prowadnic i koła – na boki, kręgosłup, pegboard, uchwyty i zawiasy – do tyłu, wieka i rączki – w górę
  const EX = (+S.V.explode || 0) * 90;
  let OFF = null;
  const off = xf => !OFF ? xf : xf ? { ...xf, t: xf.t ? vAdd(xf.t, OFF) : OFF } : { t: OFF };
  const grp = (dx = 0, dy = 0, dz = 0) => { OFF = EX && (dx || dy || dz) ? [dx, dy, dz] : null; };
  const m0 = m;
  m = { ...m0, box: (a, b, c, xf, e) => m0.box(a, b, c, off(xf), e), cyl: (c, ax, r, l, col, xf, s) => m0.cyl(c, ax, r, l, col, off(xf), s),
    boxEdges: (a, b, xf, rgba) => m0.boxEdges(a, b, off(xf), rgba), line: (a, b, rgba, xf) => m0.line(a, b, rgba, off(xf)) };
  // znacznik na obu bokach modułu (przy przodzie) – blokada prowadnic w bryle poglądowej
  const mark = (ya, yb) => {
    const c = (ya + yb) / 2;
    m.box([x0 - 0.8, c - 9, -34], [x0, c + 9, -24], P.stop, null, false);
    m.box([x1, c - 9, -34], [x1 + 0.8, c + 9, -24], P.stop, null, false);
  };
  // zamek szuflady – kluczyk z pliku (Key / Hidden Key, oś Z pliku = oś obrotu): krzywka Z 0–3 za frontem, kołnierz
  // Ø 36,5 (Z 7–11) w gnieździe Ø 38,6 frontu 4–7,5 mm pod licem, pierścień Ø 34,8 do Z 18,4 – 3,4 mm przed licem,
  // płetwa uchwytu 28 × 9 (Z 19–33,4); nakładka (Key Cap) to kubek 37,8 × 13,2 × 11,7 otwarty przy Z max, wsunięty na
  // płetwę do końca (dno 2 mm, zamknięty koniec na zewnątrz). Uchwyt pionowo. Lico frontu w widoku: z = 10.
  const knob = (x, y, xf) => {
    const hidden = state.key === "hidden", kz = 10 - 4 - 11;  // Z pliku kluczyka → z widoku: kołnierz (Z 11) 4 mm pod licem
    const keyRx = hidden ? R`^01\. drawers/07\. universal/hidden key \(turn on supports\)\.stl$` : R`^01\. drawers/07\. universal/key \(turn on supports\)\.stl$`;
    const top = kz + (hidden ? 18.4 : 33.42);
    // kluczyk i nakładka obrócone o 180° wokół osi: zagłębienie nakładki u góry – wskazuje symbol zamknięte/otwarte
    // na froncie (prośba użytkownika 2026-10-27); obrót przy otwieraniu (xf.rz) dodaje się do tego
    const kxf = { rz: Math.PI + (xf && xf.rz || 0), rx: x, ry: y, t: xf && xf.t };
    if (stl(keyRx, CF.key, [x - 18.25, y - 22.5, kz], [x + 18.25, y + 22.5, top], P.lock, kxf)) {
      if (!hidden) stl(R`^01\. drawers/07\. universal/key cap\.stl$`, CF.keycap, [x - 6.6, y - 18.9, top + 2 - 11.67], [x + 6.6, y + 18.9, top + 2], P.keycap, kxf);
      return;
    }
    m.cyl([x, y, 11], 2, 16.5, 6, P.lock, xf);
    if (!stl(R`^01\. drawers/07\. universal/key cap\.stl$`, CF.keycap, [x - 6.6, y - 18.9, 6], [x + 6.6, y + 18.9, 17.7], P.keycap, xf))
      m.box([x - 2, y - 7, 14], [x + 2, y + 7, 14.6], P.lock, xf, false);
  };

  // część z pliku STL (siatka uproszczona) w prostokącie [a, b]; null = jeszcze niewczytana albo brak pliku;
  // piece = [k, n, oś]: k-ta z n sztuk w pliku (vizStlPiece); rx może być też gotowym wpisem siatki (vizStlGetGen)
  const d = st.depth;
  const stl = (rx, cfg, a, b, col, xf = null, piece = null) => {
    if (!S.V.stl) return null;
    xf = off(xf);
    let e = rx && rx.fits ? rx : null;
    if (!e) {
      const file = typeof rx === "string" ? rx : vizStlFile(rx);
      if (!file) return null;
      e = vizStlGet(file);
    }
    if (e.status !== "ok") return null;
    const src = e.file;
    if (piece) e = vizStlPiece(e, piece[0], piece[1], piece[2]);
    const f = vizStlFit(e, cfg, cfg.wide ? Infinity : (b[0] - a[0]) / Math.max(b[1] - a[1], 1)), r = vizStlMatrix(f, a, b, cfg, xf);
    S.parts.push({ e, M: r.M, col, group: vizPartGroup(src) });
    if (e.text) S.parts.push({ e: e.text, M: r.M, col: e.textCol || vHex(state.labelTextColor || "#000000") });  // litery etykiety z napisem
    for (let i = 0; i < 8; i++) m.grow(m.xp([i & 1 ? r.hi[0] : r.lo[0], i & 2 ? r.hi[1] : r.lo[1], i & 4 ? r.hi[2] : r.lo[2]], xf));
    return { ...r, e, f, a, b, cfg, file: typeof rx === "string" ? rx : rx && !rx.fits ? vizStlFile(rx) : null };
  };
  const stlHeight = (rx, cfg, w, hgt) => {
    if (!S.V.stl) return null;
    const file = vizStlFile(rx), e = file && vizStlGet(file);
    if (!e || e.status !== "ok") return null;
    const f = vizStlFit(e, cfg, cfg.wide ? Infinity : w / Math.max(hgt, 1));
    return f.qhi[1] - f.qlo[1];
  };
  // wymiary części z pliku po ułożeniu osiami cfg (bez obrotu w XY) – np. długość przegródki podłużnej
  const stlSize = (rx, cfg) => {
    if (!S.V.stl) return null;
    const file = vizStlFile(rx), e = file && vizStlGet(file);
    if (!e || e.status !== "ok") return null;
    const f = vizStlFit(e, cfg, cfg.wide ? Infinity : 1);
    return [0, 1, 2].map(i => f.qhi[i] - f.qlo[i]);
  };
  // wkład gridfinity XL (skrzynki i szuflady): w pliku szerokość × wysokość w XY pod kątem 47,2° (płyta 3–4 mm i uchwyty
  // do 25,9 mm), głębokość wzdłuż Z, przód przy Z max (2026-11-01, prośba użytkownika „w XL nie widzę wkładki”).
  // XL6/XL7: dwie części – Part 1 z tyłu, Part 2 z przodu; jedna z nich leży w pliku odwrócona (płyta przy X max, nie
  // przy X min): w skrzynkach Part 1, w szufladach Part 2 (flip) – CF.gridXL1. rxOf(k): k = "" (jedna część) albo
  // " part 1"/" part 2". Całość na środku między zb i zf.
  const gridXL = (rxOf, flip, x0, x1, y, zb, zf, col, xf = null) => {
    const parts = vizStlFile(rxOf("")) ? [[rxOf(""), CF.gridXL]]
      : [1, 2].map(k => [rxOf(" part " + k), k === flip ? CF.gridXL1 : CF.gridXL]);
    const sizes = parts.map(([rx, cfg]) => stlSize(rx, cfg));
    if (sizes.some(s => !s)) return;
    let z = (zb + zf) / 2 - sizes.reduce((s, q) => s + q[2], 0) / 2;
    parts.forEach(([rx, cfg], i) => { z += sizes[i][2]; stl(rx, cfg, [x0, y, z - sizes[i][2]], [x1, y, z], col, xf); });
  };
  // zaślepki w pogłębieniach śrub i etykieta we wnęce frontu z pliku – miejsca odczytane z geometrii (siatki3d.opis_frontu)
  const CAP = R`^01\. drawers/07\. universal/facade cap\.stl$`;
  // lab = { rx: pusta etykieta USSA, key: front (jak binKey), rodzaj: "d"/"s" } – etykieta z napisem z zakładki „Etykiety”
  // przypisana do tego frontu (labForFront) zamiast pustej, a przy wyłączonych pustych etykietach – pusta wnęka.
  // lockRx: zamki skrzynki (LOCK OUTER PART) w wycięciach krawędzi frontu; zwraca liczbę wstawionych zamków
  const frontParts = (fr, capCol, lab, xf, lockRx = null, lockTop = null, lockOpen = 0) => {
    const meta = fr.e.meta;
    if (!meta || meta.z === undefined) return 0;
    const M0 = vizStlMatrix(fr.f, fr.a, fr.b, fr.cfg, null).M, zf = fr.b[2];
    const toViz = (x, y) => [M0[0] * x + M0[4] * y + M0[8] * meta.z + M0[12], M0[1] * x + M0[5] * y + M0[9] * meta.z + M0[13]];
    for (const [hx, hy] of meta.zaslepki || []) {
      const [cx, cy] = toViz(hx, hy);
      stl(CAP, CF.cap, [cx - 4.9, cy - 4.9, zf - 3.8], [cx + 4.9, cy + 4.9, zf], capCol, xf);
    }
    if (meta.etykieta) {
      const [x0, y0, x1, y1] = meta.etykieta, A = toViz(x0, y0), B = toViz(x1, y1), cx = (A[0] + B[0]) / 2, cy = (A[1] + B[1]) / 2;
      // etykieta obrócona jak front (zaokrąglony koniec przy X min jak wnęka w pliku frontu – szuflady i skrzynki);
      // z napisem – siatka z serwera ułożona jak plik USSA (pojemniki.WERSJA 12), do wczytania pusta
      const q = typeof labForFront === "function" ? labForFront(lab.key, lab.rodzaj) : null;
      const a = [cx - 24, cy - 10.3, zf - 2], b = [cx + 24, cy + 10.3, zf];
      const e = q && q !== "none" && SERVER.ok && (SERVER.pojemnikiWer || 1) >= 12 ? vizStlGetGen(labFileOf(q) + "#front", { ...q, widok: "front" }) : null;
      if (e) e.textCol = q.styl === "wklesly" ? vMix(P.label, V_BLACK, 0.45) : null;  // wklęsła: dno wycięcia ciemniej
      if (q !== "none" && !(e && stl(e, CF.label, a, b, P.label, xf))) stl(lab.rx, CF.label, a, b, P.label, xf);
    }
    // logo na froncie (logo.js, zakładka „Etykiety”): siatka logo w układzie pliku frontu, ta sama macierz co front;
    // wypukłe i wpuszczone – kolor logo (kolor napisów), wklęsłe – ciemniejszy kolor frontu
    const lg = typeof logoForFront === "function" && SERVER.ok ? logoForFront(fr.file) : null;
    if (lg && lg.e.status === "ok") S.parts.push({ e: lg.e, M: fr.M, col: lg.styl === "wklesly" ? vMix(capCol, V_BLACK, 0.45) : vHex(state.labelTextColor || "#000000") });
    let zamki = 0;
    if (lockRx) for (const [lx, ly] of meta.zamki || []) {
      const [cx, cy] = toViz(lx, ly), top = lockTop ?? cy + LOCK_UP, L = stlHeight(lockRx, CF.lock, 50, 55);
      if (!L) continue;
      // Zamek dźwigniowy (Sustainers Assembly kroki 1–4, osie z plików 2026-10-27): uchwyt (LOCK HOLDER, płytka
      // 74,5 × 22,1 × 5,6 mm) przykręcony od tyłu frontu – otwory śrub we froncie 9,0 i 18,0 mm (1F) / 15,0 i 24,0 mm
      // (2F, 4F) pod krawędzią, czyli o tyle niżej, o ile dłuższy jest zamek 2-4F (L − 40,25); bolec z osią małych
      // pinów (15,8 mm od tyłu płytki, 8,4 mm od jej górnej krawędzi) wychodzi do przodu przez wycięcie. Łącznik
      // (LOCK INNER PART, U z rurką) ma osie co 15 mm: ramiona na uchwycie (H), rurka na dużych pinach w otworze
      // części zewnętrznej (O, 10,3 mm nad jej dołem, 5,3 mm za licem). O wynika z ułożenia zamka (hak w kieszeni
      // wieka), H leży 15 mm od O w stronę miejsca z otworów (różnica ~2 mm – siatki uproszczone).
      const O = [top - L + 10.3, zf + LOCK_OUT - 5.29];
      const Hn = [cy - (L - 40.25), zf - 10 + 10.2], dl = Math.hypot(Hn[0] - O[0], Hn[1] - O[1]) || 1;
      const H = [O[0] + 15 * (Hn[0] - O[0]) / dl, O[1] + 15 * (Hn[1] - O[1]) / dl];
      // otwieranie (opis użytkownika 2026-10-27): 1) odsuwamy dół zatrzasku – łącznik obraca się na uchwycie do przodu,
      // rama przechyla się wokół haka, który zostaje w kieszeni wieka (z tylnej krawędzi haka liczony kąt phi);
      // 2) zatrzask się podnosi – łącznik obraca się dalej (oś O w górę o ~15 mm), hak wychodzi z kieszeni;
      // 3) odchylamy górę – rama obraca się hakiem do przodu i w dół (beta – łącznik, phi – rama, obroty całkowite)
      const rot = (p, c, a) => { const cs = Math.cos(a), sn = Math.sin(a), y = p[0] - c[0], z = p[1] - c[1]; return [c[0] + cs * y - sn * z, c[1] + sn * y + cs * z]; };
      const ease = (u, a, b) => { const x = Math.min(1, Math.max(0, (u - a) / (b - a))); return x * x * (3 - 2 * x); };
      const u = Math.min(1, lockOpen / 0.4), B1 = -0.7, B2 = -1.6, B3 = -1.9, PHI3 = 2.5;
      const K = [top - 4.5 - O[0], -9.9];  // tylna część haka (w kieszeni wieka) względem O
      const phiHold = b => {               // kąt ramy, przy którym hak nie przesuwa się w przód/tył, gdy łącznik obróci się o b
        const Ob = rot(O, H, b), D = (O[1] + K[1]) - Ob[1], R = Math.hypot(K[0], K[1]);
        return Math.asin(Math.max(-1, Math.min(1, D / R))) - Math.atan2(K[1], K[0]);
      };
      const e1 = ease(u, 0, 0.35), e2 = ease(u, 0.35, 0.6), e3 = ease(u, 0.6, 1);
      const beta = B1 * e1 + (B2 - B1) * e2 + (B3 - B2) * e3;
      const phiA = phiHold(B1 * e1), phi = (e2 > 0 || e3 > 0 ? phiHold(B1) : phiA) * (1 - e3) + PHI3 * e3;
      const O2 = rot(O, H, beta), gamma = Math.atan2(H[1] - O[1], H[0] - O[0]), s = u;
      const oxf = s > 0.0005 ? { a: phi, py: O[0], pz: O[1], t: [0, O2[0] - O[0], O2[1] - O[1]] } : xf;
      const ixf = { a: gamma + beta, py: O[0], pz: O[1], t: [0, O2[0] - O[0], O2[1] - O[1]] };
      if (stl(lockRx, CF.lock, [cx - 25, top - 60, zf - 20], [cx + 25, top, zf + LOCK_OUT], P.lock, oxf)) zamki++;
      stl(R`^02\. sustainers/05\. universal/locks/lock holder\.stl$`, CF.lockHolder, [cx - 40, H[0] - 13.72, zf - 40], [cx + 40, H[0] + 10, H[1] + 4.3], P.lock, xf);
      stl(R`^02\. sustainers/05\. universal/locks/lock inner part\.stl$`, CF.lockInner, [cx - 25, O[0] - 4.3, zf - 40], [cx + 25, O[0] + 20, O[1] + 4.3], P.lock, ixf);
    }
    return zamki;
  };
  // zamek wystaje przed front [mm]; wysokość: hak (górne 9 mm pliku, sięga 9 mm za płytę) leży w kieszeni wieka nad
  // wycięciem (przód wieka cofnięty o 4 mm, wierzch obniżony o 6–9,5 mm na pierwszych 13 mm – pomiar S4 Roof,
  // 2026-10-27), więc wierzch zamka = wierzch zamkniętego wieka (lockTop). Bez wieka z pliku – 1 mm nad front.
  const LOCK_UP = 1, LOCK_OUT = 4;
  // Zawiasy skrzynki (instrukcja Sustainers Assembly, kroki 5–8): dolne przykręcone od środka do tylnej ścianki modułu
  // (gniazda śrub w plikach modułów 16,6 mm pod górną krawędzią; w pliku zawiasu górny otwór 24,2 mm pod jego szczytem),
  // przegub wystaje za ścianką nad jej krawędzią; górny pod wiekiem przy tylnej krawędzi (występ z otworami 15,1 mm pod
  // wierzchem wieka, otwory 15,8 i 35,8 mm od tylnej krawędzi; S/M – jeden szeroki, L/XL – dwa widełkowe); pomarańczowe
  // pręty wsuwane od boków przez przeguby. Położenia w szerokości (od środka modułu) z gniazd w plikach modułów i wiek;
  // kw = połowa szerokości zawiasu dolnego. Pliki zawiasów dolnych i prętów mają po 2 sztuki (vizStlPiece).
  const HINGES = { S: { bot: 51.9, top: [0], kw: 20 }, M: { bot: 69.3, top: [0], kw: 20 }, L: { bot: 86.8, top: [-41.2, 41.2], kw: 25 },
    XL: { bot: 131.4, top: [-85.9, 85.9], kw: 25 } };
  const HINGE_Z = 8;  // oś przegubów za tylną ścianką [mm]
  const hinges = (f, h, mid, top, lid, lxf) => {
    const g = HINGES[f], sm = f === "S" || f === "M", U = "^02\\. sustainers/05\\. universal/", kw = g.kw;
    const botRx = new RegExp(U + "hinges/" + (sm ? (h === 1 ? "s-m 1f" : "s-m 2-4f") : (h === 1 ? "l-xl 1f" : "l 2-4f")) + " hinge\\.stl$");
    const rodRx = new RegExp(U + `rods/${sm ? "s-m" : "l-xl"} rods\\.stl$`), rodL = sm ? 82.8 : 103.8;
    // łeb pręta: w S-M Rods przy X min, w L-XL Rods przy X max – sprawdzane po siatce (wierzchołki dalej od osi niż 0,8 promienia)
    const rodFile = S.V.stl && vizStlFile(rodRx), rodE = rodFile && vizStlGet(rodFile);
    let headMin = true;
    if (rodE && rodE.status === "ok") {
      const p = vizStlPiece(rodE, 0, 2);
      if (p.headMin === undefined) {
        const P = p.pos, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < P.length; i += 3) for (let q = 0; q < 3; q++) { lo[q] = Math.min(lo[q], P[i + q]); hi[q] = Math.max(hi[q], P[i + q]); }
        const cy = (lo[1] + hi[1]) / 2, cz = (lo[2] + hi[2]) / 2, rm = Math.max(hi[1] - lo[1], hi[2] - lo[2]) / 2;
        let sx = 0, n = 0;
        for (let i = 0; i < P.length; i += 3) if (Math.hypot(P[i + 1] - cy, P[i + 2] - cz) > 0.8 * rm) { sx += P[i]; n++; }
        p.headMin = n === 0 || sx / n < (lo[0] + hi[0]) / 2;
      }
      headMin = p.headMin;
    }
    for (const s of [-1, 1]) {
      const cx = mid + s * g.bot;
      // dolny: płyta (6 mm) przy wewnętrznej stronie tylnej ścianki (5 mm; przekrój 2026-11-01 – wcześniej przyjęte 6), szczyt
      // 7,6 mm nad modułem; sztuka 2 (Y max) z przegubem w −z. Płyta wystaje do wnętrza na 11 mm od tyłu modułu – pojemniki
      // gridfinity tylnego rzędu zaczynają się 13,05 mm od tyłu (luz 2,05 mm)
      stl(botRx, CF.hingeBot, [cx - kw, top - 70, -D - 14.5], [cx + kw, top + 7.6, -D + 11], P.lock, null, [1, 2]);
      // pręt od zewnętrznej strony przegubu do środka, łeb na zewnątrz
      const x0 = s < 0 ? cx - kw : cx + kw - rodL;
      stl(rodRx, (s < 0) === headMin ? CF.rodL : CF.rodR, [x0, top - 6.4, -D - HINGE_Z - 6.4], [x0 + rodL, top + 6.4, -D - HINGE_Z + 6.4], P.stop, null, [0, 2]);
    }
    if (!lid) return;
    // górny: płytą do występu pod wiekiem (15,1 mm pod wierzchem), walec przy tylnej krawędzi; S/M – jeden (walec Ø 14 na
    // całą szerokość pliku), L/XL – plik ma 2 sztuki jedna nad drugą (wzdłuż X), każda 7 mm z uchem Ø 7,5
    const topRx = new RegExp(U + `hinges/${sm ? f.toLowerCase() : "l-xl"} hinge top\\.stl$`), lt = lid.hi[1];
    for (const tx of g.top) stl(topRx, CF.hingeTop, [mid + tx - 50, lt - 50, -D - 15.5], [mid + tx + 50, lt - 15.1, -D + 41.5], P.lock, lxf, sm ? null : [0, 2, 0]);
  };
  // moduły szuflad i skrzynek oraz podstawa leżą w plikach górą w dół: góra (ząbek łączący jak na wierzchu wieka) przy Y min,
  // spód (listwy, podłoga skrzynki) przy Y max – flipY = obrót o 180°; stopka: Z wysokość, Y głębokość; uchwyt górny: Z wzdłuż szerokości; koło: oś Z → oś X widoku
  const CF = { mod: { rot: true, flipY: true, axes: "X,Y,Z" },
    // przegródki Grid Dividers: w pliku X – długość, Y – stopa 25,4, Z – wysokość; części brzegowe: Y 0–8 blok, dalej język
    // (w szczelinie przegródki) – Xp/Xn/Zp/Zn: blok na zewnątrz w stronę +x / −x / +z (przód) / −z (tył)
    // łuki (luki.py): plik X/Y w płaszczyźnie siatki (u w prawo, v do tyłu = −z), obrót o a0
    gdA0: { axes: "X,Z,-Y" }, gdA90: { axes: "-Y,Z,-X" }, gdA180: { axes: "-X,Z,Y" }, gdA270: { axes: "Y,Z,X" },
    gdH: { axes: "X,Z,Y" }, gdV: { axes: "Y,Z,X" }, gdVr: { axes: "Y,Z,-X" }, gdXp: { axes: "-Y,Z,X" }, gdXn: { axes: "Y,Z,X" }, gdZp: { axes: "X,Z,-Y" }, gdZn: { axes: "X,Z,Y" }, fac: { axes: "-X,-Y,Z" }, box: { axes: "X,Z,Y" }, roofUp: { rot: true, wide: true, flipY: true, axes: "X,Y,Z" },
    lid: { rot: true, wide: true, flipY: true, axes: "X,Y,Z" }, cap: { axes: "X,Y,Z" },
    // etykieta: zaokrąglony koniec przy X min – jak wnęka w pliku frontu, więc obrócona tak samo jak front (−X,−Y)
    label: { axes: "-X,-Y,Z" },
    // kluczyk: płetwa wzdłuż X pliku → pionowo; nakładka: dno (Z min pliku) na zewnątrz
    key: { axes: "-Y,X,Z" }, keycap: { axes: "Y,X,-Z" }, stop: { axes: "Z,X,Y" }, stopR: { axes: "-Z,X,-Y" }, lock: { axes: "Z,X,Y", top: true }, lockHolder: { axes: "-Z,-X,Y" }, lockInner: { axes: "Z,X,Y" }, foot: { axes: "X,-Z,Y" },
    // uchwyt górny: pałąk w płaszczyźnie XZ pliku, płaska podstawa z otworami M6 przy X max; lewe koło: tarcza i pokrywa
    // odbite (tarcza do środka, pokrywa na zewnątrz)
    handle: { axes: "Z,-X,-Y" }, heavyHandle: { axes: "Y,X,Z" }, wheel: { axes: "Z,Y,X" }, wheelL: { axes: "-Z,Y,X" },
    // zawiasy w plikach: X pion (przegub u góry), Y głębokość, Z szerokość (oś przegubu); dolny przegubem do tyłu (−Y),
    // górny płytą do góry i walcem do tyłu; pręty wzdłuż X (rodL: X min pliku na zewnątrz po lewej, rodR – po prawej)
    hingeBot: { axes: "Z,X,-Y", top: true }, hingeTop: { axes: "Z,X,Y", top: true }, rodL: { axes: "X,Z,Y" }, rodR: { axes: "-X,Z,Y" },
    // prowadnica i ślizg: w plikach X = wysokość, Y = długość (Y min = tył), Z = grubość – koryto prowadnicy (Z max) i wierzch
    // ślizgu (Z max) w stronę pudełka, czyli do środka modułu: lewa ściana +x, prawa −x
    runL: { axes: "Z,X,Y" }, runR: { axes: "-Z,X,Y" },
    // przegródki skrzynek: płytki 2 mm (Z) – poprzeczne X szer., Y wys. (wycięcia od Y min = od dołu); podłużne
    // (L Depth) X wys., Y długość, wycięcia co 42 mm od Y min – Y min z przodu; w 1F wycięcia przy X max (góra),
    // w 2F/4F plik leży do góry nogami (wycięcia przy X min) – obrót o 180°, żeby wycięcia były u góry i zazębiały się
    // z poprzecznymi (zgłoszenie użytkownika 2026-11-01: podłużne mijały wycięcia poprzecznych)
    divW: { axes: "X,Y,Z" }, divD1: { axes: "Z,X,Y" }, divD24: { axes: "-Z,-X,Y" },
    // pudełko szuflady XL i jego tylny panel: w pliku jak moduły – szerokość × wysokość w XY pod kątem 47,2°, głębokość
    // wzdłuż Z, przednia ściana przy Z min (pudełko drukowane na stojąco, tył osobno – Back Panel)
    boxXL: { rot: true, axes: "-X,Y,-Z" }, // wkład gridfinity XL: obrót „wide” kładzie płytę (X min pliku po wyprostowaniu o 47,2°) u góry – stąd flipY;
    // odwrócona w pliku część XL6/XL7 (płyta przy X max) – bez flipY
    gridXL: { rot: true, wide: true, flipY: true, axes: "X,Y,Z" }, gridXL1: { rot: true, wide: true, axes: "X,Y,Z" },
    // tył wieży (Modifications): kręgosłup – X szer., Y wys., Z grubość 33 (Z min płaska do modułu, klocki z otworami na
    // pręty na zewnątrz); uniwersalny – otwór 41,8 mm od krawędzi zewnętrznej; blokada uchwytu – Z pion (otwory na pręty),
    // Y głęb. 35; rączka – Z pion (Z max = dół z gniazdami prętów), Y głęb. 35; uchwyt stały – Y pion 47, Z max do
    // kręgosłupa; pokrętło blokady jak kluczyk szuflady (oś Z, płetwa), nakładka jak Key Cap – obrócone na tył wieży
    bb: { axes: "-X,Y,-Z" }, bbL: { axes: "X,-Y,-Z" }, bbR: { axes: "-X,Y,-Z" }, lockP: { axes: "X,Z,-Y" }, lockL: { axes: "X,Z,-Y" },
    lockR: { axes: "-X,Z,-Y" }, pullH: { axes: "X,-Z,Y" }, statH: { axes: "X,Y,Z" }, knob: { axes: "Y,X,-Z" }, knobCap: { axes: "-Y,X,Z" },
    // pegboard: Z max pliku (wnęki na klocki kręgosłupa) do kręgosłupa; uchwyt ścienny: Z max do modułu, Z min płaska ze
    // śrubami do ściany; część 2 (na ścianie): Z max (węższa ściana jaskółczego ogona) do ściany
    peg: { axes: "X,Y,Z" }, wall: { axes: "X,Y,Z" }, wall2: { axes: "-X,Y,-Z" } };
  const w = fam.toLowerCase(), MOD = "^03\\. modifications/";

  // koła (z tyłu, na pręcie M16 przez podstawę) i stopka (z przodu); bez kół i stopek wieża stoi na podłodze
  let y = 0;
  // podstawa jest o 10 mm dłuższa od modułu (równo z frontami, tył równo z modułem); otwór na pręt M16 w pliku podstawy
  // 31 mm od tylnej krawędzi i 21 mm nad spodem (instrukcja Modifications 2–9: koła na samym tyle, stopka z przodu)
  // koła i stopka tylko z podstawą (jak lista części)
  const wheels = md.base && md.wheels, feet = md.base && md.feet;
  // kółka meblowe (Casters Mode): 4 skrętne kółka Ø 50 mm, wysokość 70 mm, w otworach spodu podstawy (30 mm od boków,
  // 17 mm od tyłu, 20 mm od przodu) – części kupowane, rysowane poglądowo
  const casters = typeof castersOn === "function" && castersOn(md), CASTER_H = 70;
  const lift = wheels || feet ? 59 : casters ? CASTER_H : 0, wz = -D + 31, wy = lift + 21;
  const footW = Math.min({ S: 104.8, M: 194, L: 269.6, XL: 358.8 }[fam], W - 10);
  // stopka (Feet, 92 mm głęboka) równo z przednią krawędzią podstawy; płaska strona do podstawy, skos do przodu (Modifications 8)
  const foot = (z0, z1) => {
    if (stl(new RegExp(MOD + `feet/${w} feet\\.stl$`), CF.foot, [xm - footW / 2, 0, z0], [xm + footW / 2, lift, z1], modDark)) return;
    m.box([xm - footW / 2 + 6, 0, z0 + 6], [xm + footW / 2 - 6, 10, z1 - 6], rubber);
    m.box([xm - footW / 2, 10, z0], [xm + footW / 2, lift, z1], modDark);
  };
  if (wheels) {
    m.cyl([xm, wy, wz], 0, 8, W + 92, metal);
    for (const [wx, s] of [[x0 - 26, -1], [x1 + 26, 1]]) {
      grp(s * EX * 0.5);
      if (stl(new RegExp(MOD + "wheels/tyre \\(tpu\\)\\.stl$"), CF.wheel, [wx - 20, wy - 80, wz - 80], [wx + 20, wy + 80, wz + 80], rubber)) {
        stl(new RegExp(MOD + "wheels/disk\\.stl$"), s < 0 ? CF.wheelL : CF.wheel, [wx - 10, wy - 71, wz - 71], [wx + 10, wy + 71, wz + 71], modCol);
        stl(new RegExp(MOD + "wheels/cover\\.stl$"), s < 0 ? CF.wheelL : CF.wheel, [wx + s * 14 - 12, wy - 70, wz - 70], [wx + s * 14 + 12, wy + 70, wz + 70], modCol);
        continue;
      }
      m.cyl([wx, wy, wz], 0, 80, 40, rubber, null, 40);
      m.cyl([wx, wy, wz], 0, 70, 42, modCol, null, 40);
      m.cyl([wx + s * 6, wy, wz], 0, 52, 36, dark, null, 32);
      m.cyl([wx + s * 25, wy, wz], 0, 9, 2, metal, null, 16);
    }
    grp(0, 0, EX * 0.4);
    // stopka z przodu – zawsze razem z kołami (jedno pole „koła i stopka”, normalizeStack)
    foot(-82, 10);
  }
  else if (casters) {
    for (const cx of [x0 + 30, x1 - 30]) for (const cz of [-D + 17, -10]) {
      m.cyl([cx, CASTER_H - 3, cz], 1, 19, 6, metal, null, 24);              // płytka obrotowa
      for (const s of [-1, 1]) m.box([cx + s * 11 - 1.5, 25, cz - 22], [cx + s * 11 + 1.5, CASTER_H - 6, cz + 4], metal);  // widelec
      m.cyl([cx, 25, cz - 9], 0, 25, 18, rubber, null, 32);                 // kółko (ślad za osią obrotu)
      m.cyl([cx, 25, cz - 9], 0, 8, 20, metal, null, 16);
    }
  }
  grp();
  y = lift + (lift && md.base ? EX : 0);
  if (md.base) {
    if (!stl(new RegExp(MOD + `base/${w}/${w}${d} base( whole)?\\.stl$`), CF.mod, [x0, y, -D], [x1, y + 52, 10], modCol)) {
      m.box([x0, y, -D], [x1, y + 52, 10], modCol);
      m.box([x0 + 16, y + 18, 0], [x1 - 16, y + 34, 1.2], vMix(modCol, V_BLACK, 0.18), null, false);
      mark(y, y + 52);
    }
    y += 52;
  }

  // widok złożony (S.V.packed, domyślnie): ząbki na wierzchu modułu, podstawy i wieka skrzynki (5,2 mm) wchodzą między
  // listwy spodu warstwy wyżej (4,8 mm) – warstwy, podstawa i dach leżą o 5,2 mm niżej niż przy samych bryłach plików;
  // pod frontami zostaje szczelina ~4 mm z ząbkami, jak na zdjęciach użytkownika (2026-11-01). Rozłożony – jak dotąd.
  const TEETH = S.V.packed ? 5.2 : 0;
  if (md.base) y += EX - TEETH;
  const y0 = y, layerY = [], layerBody = [];
  const roofOn = st.roof !== "none" && st.layers.length && st.layers[st.layers.length - 1].type === "D";
  st.layers.forEach((l, li) => {
    const fams = FAMILIES[l.layout], cols = [];
    let cx = x0;
    for (const f of fams) { cols.push([cx, cx + WIDTH_MM[f], f]); cx += WIDTH_MM[f]; }
    const h = l.height;
    const modRx = (f, ci) => {
      const w = f.toLowerCase();
      if (l.type === "S") return w === "s" || w === "m" ? R`^02\. sustainers/[^/]+/${w}${d}/modules/${w}${d} ${h}f module\.stl$`
        : R`^02\. sustainers/[^/]+/${w}${d}/modules/${w}${d} ${h}f ${l.cols[ci].sInt} module\.stl$`;
      if (l.layout === "L2") return R`^01\. drawers/[^/]+/l${d}²/l${d}² module ${h}f\.stl$`;
      if (l.layout === "XL2") return R`^01\. drawers/[^/]+/xl${d}²/xl${d}² module ${h}f\.stl$`;
      return R`^01\. drawers/[^/]+/${w}${d}/modules/${w}${d} module ${h}f\.stl$`;
    };
    const lidRx = f => { const w = f.toLowerCase(); return R`^02\. sustainers/[^/]+/${w}${d}/roofs?/${w}${d} roof( whole)?\.stl$`; };
    let H = 48 * h + 9;
    const LID_IN = 7;  // kołnierz wieka wchodzi w moduł skrzynki [mm] (z map wysokości: wieko leży na ściankach bocznych)
    // wysokość modułu skrzynki do krawędzi, na której leży wieko: w L/XL Sealed ściany uszczelniające wystają 7,5 mm wyżej
    // (bryła 58,3/92,3/188,3 mm) i wchodzą w puste wieko – do 2026-11-01 wieko stało na nich 7,5 mm za wysoko (zrzut
    // użytkownika, XL4 Sealed)
    const SUST_RIM = { 1: 50.8, 2: 84.8, 4: 180.8 }[h];
    if (l.type === "S") cols.forEach(([ca, cb, f], ci) => {
      const hs = stlHeight(modRx(f, ci), CF.mod, cb - ca, H), hm = hs && Math.min(hs, SUST_RIM), hl = stlHeight(lidRx(f), CF.lid, cb - ca, 1);
      if (hm && hl) H = Math.max(H, hm + hl - LID_IN);
    });
    const ya = y, yb = y + H;
    layerY.push([ya, yb]);
    // korpus modułu bez listew pod spodem (4,8 mm) i ząbków na górze (5,2 mm); w skrzynce – do krawędzi modułu (wieko się
    // otwiera, kręgosłup jest tylko na module)
    layerBody.push([ya + 4.8, l.type === "S" ? ya + SUST_RIM : yb - 5.2, h]);
    // osobne moduły (2× S, S + M) mają własne obudowy; L², XL² i pełne moduły – jedną wspólną
    const separate = l.layout === "SS" || l.layout === "SM";
    let reach = 0;  // jak daleko przed obudowę wystają otwarte szuflady/fronty tej warstwy (etykieta przesuwa się z nimi)
    const own = separate || l.type === "S";  // skrzynki: każda kolumna to osobny moduł
    const housings = own ? cols.map(([ca, cb, f], ci) => [ca, cb, f, ci]) : [[x0, x1, l.layout === "L2" || l.layout === "XL2" ? "L" : fams[0], 0]];
    let real = true;
    const lidOpen = [];  // skrzynki z wiekiem z pliku: otwiera się wieko (zawiasy z tyłu), front jest przykręcony na stałe
    const lidTop = [];   // płaski wierzch zamkniętego wieka z pliku – do niego sięgają zamki frontu
    const slots = [];    // szczeliny na blokady prowadnic w ścianach modułów szuflad (siatki3d.szczeliny_modulu), [x, y, z]
    const sx = ci => own && cols.length > 1 ? (ci - (cols.length - 1) / 2) * EX * 0.7 : 0;  // moduły obok siebie – na boki
    for (const [ha, hb, f, ci] of housings) {
      grp(sx(ci));
      const r = stl(modRx(f, ci), CF.mod, [ha, ya, -D], [hb, yb, 0], P.housing);
      if (r && r.e.meta && r.e.meta.stopery) for (const [sx, sy, sz] of r.e.meta.stopery) {
        const M = r.M;
        slots.push([M[0] * sx + M[4] * sy + M[8] * sz + M[12], M[1] * sx + M[5] * sy + M[9] * sz + M[13], M[2] * sx + M[6] * sy + M[10] * sz + M[14], (ha + hb) / 2]);
      }
      // wieko skrzynki na górze modułu; po kliknięciu frontu unosi się do tyłu na zawiasach (instrukcja „Two Types of VAULT”),
      // oś obrotu = przeguby zawiasów (8 mm za tylną ścianką, na wysokości górnej krawędzi modułu)
      // bez siatki modułu albo wieka (bryły poglądowe, kształty jeszcze się wczytują) – płyta wieka na tych samych
      // zawiasach, żeby skrzynka otwierała się tak samo jak po wczytaniu (wcześniej opadał wtedy front)
      if (l.type === "S") {
        // z plików: najpierw odpinają się zatrzaski frontu (pierwsze 40 % ruchu), wieko rusza od 35 %
        const o0 = S.open.get(`${si}-${li}-${ci}-s`) || 0, o = r ? Math.max(0, (o0 - 0.35) / 0.65) : o0;
        const top = r ? Math.min(r.hi[1], r.lo[1] + SUST_RIM) : yb - 3, ly = r ? top - LID_IN : top;
        const lxf = o > 0.0005 ? { a: -o * 1.75, py: top, pz: -D - HINGE_Z } : null;
        grp(sx(ci), EX * 0.4);  // wieko w górę
        const lid = r && stl(lidRx(f), CF.lid, [ha, ly, -D], [hb, yb, 10], lidCol, lxf);
        // płaski wierzch wieka: 5,2 mm pod czubkami występów „align to connect” i ząbków (zmierzone w S3–L7 Roof); zamek
        // kończy się równo z nim (render USSA L3, zgłoszenie użytkownika 2026-10-27)
        if (lid) lidTop[ci] = lid.hi[1] - 5.2;
        else { m.box([ha, ly, -D], [hb, yb, r ? 10 : 0], lidCol, lxf); m.boxEdges([ha, ly, -D], [hb, yb, r ? 10 : 0], lxf); }
        lidOpen[ci] = true;
        grp(sx(ci), EX * 0.2, -EX * 0.35);  // zawiasy i pręty do tyłu
        if (r) hinges(f, h, (ha + hb) / 2, top, lid, lxf);
        grp(sx(ci));
        // wkład gridfinity na dnie skrzynki (Universal/Baseplates: płyta 4,6 mm z kieszeniami, po bokach paski-uchwyty
        // 29 mm do wyciągania, w pliku X szerokość, Y głębokość, Z wysokość jak pudełka szuflad); dno modułu 9,8 mm nad
        // spodem (zmierzone w S4, M4, S6 1F/2F/4F), wkład 154,8/244/318,7 × (42·d + 14,9) mm – na środku głębokości.
        // XL – gridXL (w pliku inaczej ułożony, XL6/XL7 w 2 częściach)
        if (r && l.cols[ci].grid && f !== "XL") {
          const w = f.toLowerCase();
          stl(R`^02\. sustainers/05\. universal/baseplates/[^/]+/${w}${d} baseplate\.stl$`, CF.box,
            [ha, r.lo[1] + 9.8, -D], [hb, r.lo[1] + 9.8, -0.1], P.insertS);  // tyłem do tylnej ścianki (5 mm) – przodem 0,1 mm za przodem modułu
        }
        if (r && l.cols[ci].grid && f === "XL")
          gridXL(k => R`^02\. sustainers/05\. universal/baseplates/[^/]+/xl${d}${k} gridfinity baseplate\.stl$`, 1,
            ha, hb, r.lo[1] + 9.8, r.lo[2], r.hi[2], P.insertS);
        // pojemniki gridfinity z układu tej skrzynki (pojemniki.js) – płyta 42·d + 14,9 mm przodem 0,1 mm za przodem modułu,
        // kratki 7,1 mm od przedniej krawędzi płyty (strona z zabudowanym polem w M/L), 7,8 mm od tylnej (pomiar płyt S/M/L 2026-11-01)
        if (r && l.cols[ci].grid && typeof binVizParts === "function")
          binVizParts(S, `i:${st.id}:${l.id}:${ci}:0`, { typ: "s", fam: f, d, h, plyta: "grid" }, (ha + hb) / 2, r.lo[1] + 9.8,
            f === "XL" ? (r.lo[2] + r.hi[2]) / 2 : -0.1 - 7.1 - 21 * d, off(null), binsOn(P.housing, P.insertS));
        // przegródki (liczby z listy części przycięte do liczby rowków – divMax w index.html; Universal/Dividers): stoją na
        // dnie (9,8 mm nad spodem) w rowkach ścian. Środki rowków od tyłu modułu – SUST_GROOVES (index.html), zmierzone
        // we wszystkich plikach modułów 2026-11-01: układ zależy od rodziny, głębokości i wnętrza (S4 co 41 mm od 55,6,
        // M5 co 51,5, L4 Dividers od 53,6, L4 Sealed od 50,8…); wcześniej liczone 12 / 13,5 + 42·k i przegródki stały
        // obok rowków (zrzuty użytkownika). S/M: przegródka na całą szerokość; L/XL Dividers: poprzeczne (Width) w rowkach
        // boków i podłużne (Depth) w nacięciach tylnej ściany (L ±41,0, XL ±85,6 mm od środka) – koniec Y min pliku
        // 3,7 mm od tyłu modułu (dno nacięcia), wtedy wycięcia podłużnych trafiają w rowki we wszystkich L3–L7 i XL3–XL7
        // (przód wchodzi ~3 mm we front); L Sealed: uszczelniające (pół szerokości) w obu połówkach; XL Sealed: środkowe
        // między ścianami wewnętrznymi (x 149,5–269 mm od lewego boku) i boczne (5–144 / 274,5–413,8). Rozłożone możliwie
        // równo po rowkach.
        const dv = l.cols[ci].div || {}, sInt = l.cols[ci].sInt || "flat";
        if (r) {
          const fl = r.lo[1] + 9.8, zb = r.lo[2], x0 = r.lo[0], w = f.toLowerCase(), U = String.raw`^02\. sustainers/05\. universal/dividers/`;
          const g = sustGrooves(f, d, sInt), ile = k => Math.min(dv[k] || 0, divMax(f, d, sInt, k));
          const rozloz = n => Array.from({ length: Math.min(n, g.length) }, (_, i) => g[Math.round((i + 1) * (g.length + 1) / (Math.min(n, g.length) + 1)) - 1]);
          // n sztuk w dwóch częściach (połówki L, boki XL): po jednej w każdej na rowek, zaczynając od lewej
          const pary = (n, lewa, prawa) => rozloz(Math.ceil(n / 2)).forEach((z, i) => { lewa(z); if (2 * i + 1 < n) prawa(z); });
          const dCol = P.insertS, plik = rx => new RegExp(U + rx);
          const poprz = (rx, xa, xb, z) => stl(plik(rx), CF.divW, [xa, fl, zb], [xb, fl, zb + z + 1], dCol);
          const podl = (rx, x) => {
            const cfg = h === 1 ? CF.divD1 : CF.divD24, len = stlSize(plik(rx), cfg);
            if (len) stl(plik(rx), cfg, [x - 1, fl, zb], [x + 1, fl, zb + 3.7 + len[2]], dCol);
          };
          const mid = (ha + hb) / 2;
          if (f === "S" || f === "M") for (const z of rozloz(ile("n"))) poprz(`${w} dividers/${w}${h}f divider\\.stl$`, ha, hb, z);
          if (f === "L" && sInt === "sealed") {
            const rx = `l seal dividers/l-${h}f seal divider\\.stl$`;
            pary(ile("s"), z => poprz(rx, ha, mid, z), z => poprz(rx, mid, hb, z));
          }
          if (f === "L" && sInt === "dividers") {
            for (const z of rozloz(ile("w"))) poprz(`l width dividers/l-${h}f width divider\\.stl$`, ha, hb, z);
            for (const x of [mid - 41, mid + 41].slice(0, ile("d"))) podl(`l depth dividers/l${d}-${h}f depth divider\\.stl$`, x);
          }
          if (f === "XL" && sInt === "dividers") {
            for (const z of rozloz(ile("w"))) poprz("xl width divider\\.stl$", ha, hb, z);
            for (const x of [mid - 85.6, mid + 85.6].slice(0, ile("d"))) podl(`xl depth dividers/xl${d} depth divider\\.stl$`, x);
          }
          if (f === "XL" && sInt === "sealed") {
            for (const z of rozloz(ile("sc"))) poprz("xl seal divider \\(center\\)\\.stl$", x0 + 149.5, x0 + 269, z);
            pary(ile("ss"), z => poprz("xl seal divider \\(sides\\)\\.stl$", x0 + 5, x0 + 144, z),
              z => poprz("xl seal divider \\(sides\\)\\.stl$", x0 + 274.5, x0 + 413.8, z));
          }
        }
      }
      if (!r) { vizHousing(m, ha, hb, ya, yb, D, P.housing, inner, l.type === "S"); real = false; }
    }
    grp();
    if (!real && !own && !separate) for (const c of cols.slice(1)) m.box([c[0] - 1.5, ya + 3, -D + 3], [c[0] + 1.5, yb - 3, 0], P.housing, null, false);
    if (!real) mark(ya, yb);
    // blokady prowadnic (Runner Stopper) we wszystkich szczelinach ścian bocznych modułu – najniższa szczelina szuflady
    // blokuje prowadnicę, pozostałe zaślepiają otwory (jak na liście części); na prawej ścianie obrócona o 180° wokół pionu
    for (const s of slots) {
      const out = s[0] < s[3] ? -1 : 1, x0 = out > 0 ? s[0] - 8.2 : s[0], x1 = out > 0 ? s[0] : s[0] + 8.2;
      grp(out * EX * 0.45);  // dalej niż prowadnice
      stl(R`^01\. drawers/07\. universal/runners/runner stopper\.stl$`, out > 0 ? CF.stopR : CF.stop, [x0, s[1] - 3.9, s[2] - 8.95], [x1, s[1] + 3.9, s[2] + 8.95], P.stop);
    }

    grp();
    cols.forEach(([ca, cb], ci) => {
      const c = l.cols[ci], cw = cb - ca, mid = (ca + cb) / 2;
      // szuflady obok siebie we wspólnej obudowie (L², XL²) też rozjeżdżają się na boki (bez obudowy); osobne moduły – jak moduł
      const sd = own || cols.length < 2 ? sx(ci) : (ci - (cols.length - 1) / 2) * EX * 0.5;
      const przod = (dalej = 0) => grp(sd, 0, EX * 0.7 + dalej);  // front z zamkiem, etykietą i zaślepkami – do przodu
      if (l.type === "D") {
        let top = yb - 5;
        c.pattern.forEach((h, k) => {
          const fh = 48 * h - 1, fy0 = top - fh, fy1 = top, id = `${si}-${li}-${ci}-${k}`;
          top -= fh + 1;
          // najpierw kluczyk obraca się o 90° w prawo (pierwsze 40 % ruchu, ~1 s), potem szuflada się wysuwa (od 35 %);
          // przy zamykaniu odwrotnie (prośba użytkownika 2026-10-27, tempo jak przy zatrzaskach skrzynek)
          const o = S.open.get(id) || 0, kt = Math.min(1, o / 0.4), turn = -Math.PI / 2 * kt * kt * (3 - 2 * kt);
          const slide = Math.max(0, (o - 0.35) / 0.65), xf = slide > 0.0005 ? { t: [0, 0, slide * D * 0.72] } : null;
          // rozsunięcie: pudełko (z wkładem, pojemnikami i ślizgami) wyjeżdża z modułu także przy zamkniętej szufladzie
          // (zgłoszenie użytkownika 2026-11-03: „brakuje elementów przy rozsunięciu w trybie zamkniętym”), prowadnice
          // w 65 % tej drogi, front przed pudełkiem; bxf – pudełko rysowane, choć szuflada zamknięta
          const pull = EX ? (+S.V.explode || 0) * D * 0.6 : 0, bxf = xf || (EX ? { t: [0, 0, 0] } : null);
          reach = Math.max(reach, slide * D * 0.72);
          const col = id === S.hover ? P.hover(P.front) : P.front, fw = fams[ci].toLowerCase();
          const facRx = fw === "xl" ? R`^01\. drawers/05\. xl families/xl facade 1f\.stl$` : R`^01\. drawers/[^/]+/facades/${fw}${h}f \(turn on supports\)\.stl$`;
          przod(pull);
          const fr = stl(facRx, CF.fac, [ca, fy0, 0], [cb, fy1, 10], col, xf);
          if (fr) frontParts(fr, col, { rx: R`^01\. drawers/07\. universal/label\.stl$`, key: `i:${st.id}:${l.id}:${ci}:${k}`, rodzaj: "d" }, xf);
          else {
            m.box([ca + 1, fy0, 0], [cb - 1, fy1, 10], col, xf);
            m.box([ca + 12, fy0 + 7, 10], [ca + 46, fy0 + 15, 11], P.label, xf);  // etykieta (Label)
          }
          const ky = fy0 + Math.min(23.5, fh / 2), kxf = turn < -0.0005 ? { rz: turn, rx: mid, ry: ky, t: xf && xf.t } : xf;
          knob(mid, ky, kxf);  // zamek (Key Lock) – osobna część, także w otworze frontu z pliku
          // XL: w folderze Boxes są dwa pliki – pudełko i tylny panel (do 2026-11-01 wzorzec brał pierwszy, czyli panel, i rysował
          // go jak pudełko S/M/L – czarna deska wystająca spod frontu, zgłoszenie użytkownika)
          const boxRx = fw === "xl" ? R`^01\. drawers/[^/]+/xl${d}/boxes/xl${d} box 1f\.stl$` : R`^01\. drawers/[^/]+/${fw}${d}/boxes/${fw}${d} box ${h}f\.stl$`;
          const boxCfg = fw === "xl" ? CF.boxXL : CF.box;
          // dno pudełka 9,8 mm nad spodem poziomu (z prowadnic: środek prowadnicy 28,3 mm nad spodem modułu, szczelina na
          // ślizg w ścianie pudełka 13,5–23,5 mm nad jego dnem), czyli fy0 + 4,8
          const BOX_UP = 4.8;
          // dno pudełka 3 mm (pomiar wszystkich rozmiarów S/M/L 2026-11-05 – do tej pory przyjęte 2 mm: przegródki stały 1 mm
          // w dnie, które przebijało cienką krawędź stopy – zrzut użytkownika; płyta i pojemniki też o 1 mm za nisko)
          const DNO = 3;
          const pudlo = (dx = 0) => grp(sd + dx, 0, EX * 0.35 + pull);  // pudełko w pół drogi do frontu
          pudlo();
          const bxr = bxf && stl(boxRx, boxCfg, [ca, fy0 + BOX_UP, -D], [cb, fy1, 0], P.box, bxf);
          if (bxr) {
            // tylny panel XL (6,3 mm, węższy o ściany boczne) zamyka otwarty tył pudełka, równo z jego tylną krawędzią
            const bl = fw === "xl" && stlSize(boxRx, boxCfg);
            if (bl) stl(R`^01\. drawers/[^/]+/xl${d}/boxes/xl${d} back panel\.stl$`, CF.boxXL, [ca, fy0 + BOX_UP, -D], [cb, fy1, 6.3 - bl[2]], P.box, bxf);
            // wkład gridfinity na dnie pudełka z pliku (pudełko 185,8 mm, wkład 176 mm – wyśrodkowany w głębokości); XL
            // ma jeden rodzaj wkładu (bez wersji z uchwytami), ułożony w pliku jak pudełko XL – gridXL
            const ins = insOf(c, k);
            if (insGrid(ins) && fw === "xl") {
              const bl = stlSize(boxRx, boxCfg);
              if (bl) gridXL(k => R`^01\. drawers/[^/]+/xl${d}/gridfinity baseplate/xl${d} baseplate${k}\.stl$`, 2,
                ca, cb, fy0 + BOX_UP + DNO, -bl[2], 0, insertCol, bxf);
            }
            if (insGrid(ins) && fw !== "xl") {
              const base = R`^01\. drawers/[^/]+/${fw}${d}/gridfinity baseplate/${fw}${d} baseplate\.stl$`;
              const rx = ins === "grid2" ? R`^01\. drawers/[^/]+/${fw}${d}/gridfinity baseplate/${fw}${d} (baseplate_with 2 handles|gridfinity baseplate 2_handles)\.stl$`
                : ins === "grid1" ? R`^01\. drawers/[^/]+/${fw}${d}/gridfinity baseplate/${fw}${d} baseplate_with 1 handle\.stl$` : base;
              stl(vizStlFile(rx) ? rx : base, CF.box, [ca, fy0 + BOX_UP + DNO, -D], [cb, fy0 + BOX_UP + DNO, -4.9], insertCol, bxf);
            }
            // pojemniki gridfinity z układu tej szuflady (pojemniki.js, klucz egzemplarza) – na płycie (42·d + 8 mm, przodem
            // 4,9 mm za frontem; przekazywany środek płyty, kieszenie względem niego przesuwa binGridOff; XL – środek pudełka)
            if (insGrid(ins) && S.V.stl && typeof binVizParts === "function") {
              const bl = fw === "xl" && stlSize(boxRx, boxCfg);
              binVizParts(S, `i:${st.id}:${l.id}:${ci}:${k}`, { typ: "d", fam: fams[ci], d, h, plyta: ins }, (ca + cb) / 2, fy0 + BOX_UP + DNO,
                fw === "xl" ? (bl ? -bl[2] / 2 : null) : -4.9 - (42 * d + 8) / 2, off(bxf), binsOn(P.box, insertCol));
            }
            // wkład na głowice na całe pudełko S (pojemniki.js – glowParams): na dnie, ścianki boczne 4,2 mm, przednia 6,6, tylna 3,
            // luz 0,5 mm; w pliku X – szerokość, Y+ – tył, Z – wysokość (CF.gdA0)
            if (ins === "glowice" && S.V.stl && typeof glowParams === "function" && SERVER.ok && (SERVER.pojemnikiWer || 1) >= GLOW_WKLAD_VER) {
              const p = glowParams(`i:${st.id}:${l.id}:${ci}:${k}`, d), fy = fy0 + BOX_UP + DNO;
              if (p.glowice.length || p.skarpety)
                stl(vizStlGetGen(binFileOf(p), p), CF.gdA0, [bxr.lo[0] + 4.7, fy, bxr.lo[2] + 3.5], [bxr.hi[0] - 4.7, fy + 13.2, bxr.hi[2] - 7.1], binsOn(P.box, insertCol), bxf);
            }
            // przegródki Grid Dividers z układu tej szuflady (przegrodki.js) w otworach dna: kolumna 0 – 4,2 mm (ścianka boczna)
            // + GD_SIDE od lewego boku pudełka, rząd 0 (przód) – 17,65 mm (ścianka 6,6 + 11,05) od przedniej krawędzi pudełka
            // (pomiar plików 2026-11-05; XL przez analogię); stoją na dnie (3 mm nad spodem pudełka), w kolorze przegródek (domyślnie
            // jak pojemniki – prośba użytkownika 2026-11-05)
            if (ins === "dividers" && typeof gdVizLayout === "function") {
              const G = gdVizLayout(`i:${st.id}:${l.id}:${ci}:${k}`, fams[ci], d, h);
              if (G) {
                const fy = fy0 + BOX_UP + DNO, yh = fy + G.hgt, P0 = GD_PITCH;
                const X = u => bxr.lo[0] + 4.2 + (GD_SIDE[fams[ci]] || 5.19) + u * P0, Z = v => bxr.hi[2] - 17.65 - v * P0;
                for (const p of G.parts) {
                  let a, b, cfg;
                  if (p.kind === "post") {  // słupek (luki.py): podstawa 12 mm z gniazdami pinów, trzon z kopułką; bez siatki – bryły poglądowe
                    const q = p.gen, B = p.half, cx = X(p.c[0]), cz = Z(p.c[1]);
                    if (!(gdPostOk() && stl(vizStlGetGen(p.file, q), CF.gdA0, [cx - B, fy, cz - B], [cx + B, fy + q.h, cz + B], P.divs, bxf))) {
                      const hb = q.piny === 1 ? 3 : 7;
                      if (q.piny === 1) m.cyl([cx, fy + hb / 2, cz], 1, B, hb, P.divs, bxf, 24); else m.box([cx - B, fy, cz - B], [cx + B, fy + hb, cz + B], P.divs, bxf);
                      m.cyl([cx, fy + hb + (q.h - hb) / 2, cz], 1, q.d / 4 + 1.25, q.h - hb, P.divs, bxf, 24);
                    }
                    continue;
                  }
                  if (p.kind === "short") {  // krótka przegródka (luki.py): plik X – długość od początku, przedłużenie e0/e1 do ścianki
                    if (p.o === "h") stl(vizStlGetGen(p.file, p.gen), CF.gdH, [X(p.u0) - p.e0, fy, Z(p.a) - 12.7], [X(p.u1) + p.e1, yh, Z(p.a) + 12.7], P.divs, bxf);
                    else stl(vizStlGetGen(p.file, p.gen), CF.gdVr, [X(p.a) - 12.7, fy, Z(p.u1) - p.e1], [X(p.a) + 12.7, yh, Z(p.u0) + p.e0], P.divs, bxf);
                    continue;
                  }
                  if (p.kind === "cross") {  // łącznik (luki.py): środek w otworze, języki 17,44 mm tam, gdzie ramiona, poza nimi kwadrat 5,26
                    const ex = d => p.box[d];
                    stl(vizStlGetGen(p.file, p.gen), CF["gdA" + p.a0], [X(p.u) - ex(180), fy, Z(p.v) - ex(90)], [X(p.u) + ex(0), yh, Z(p.v) + ex(270)], P.divs, bxf);
                    continue;
                  }
                  if (p.kind === "arc") {
                    // łuk z generatora (luki.py): w pliku środek łuku w 0, łuk od +x przeciwnie do wskazówek zegara, z wysokość;
                    // obrót a0 w siatce (v do tyłu = −z w scenie); bryła: stopa 12,68 mm na zewnątrz, język 17,45 mm za końcami
                    // przedłużony koniec (doklejony krótki odcinek): prosto do 5,25 + n·10,5 (+ mm do ścianki) zamiast języka
                    const R0 = p.r * P0, o = R0 + 12.68, el = x => x ? 5.25 + (+x[0]) * P0 + (x.slice(1).startsWith("w") ? +x.slice(2) : 0) : 17.45;
                    const lx = [p.kat === 180 ? -o : -el(p.ext[1]), o], ly = [-Math.max(el(p.ext[0]), p.kat === 180 ? el(p.ext[1]) : 0), o];
                    const rot = { 0: [1, 0, 0, 1], 90: [0, -1, 1, 0], 180: [-1, 0, 0, -1], 270: [0, 1, -1, 0] }[p.a0];  // [u←x, u←y, v←x, v←y]
                    const cs = [[lx[0], ly[0]], [lx[1], ly[0]], [lx[0], ly[1]], [lx[1], ly[1]]].map(([x, y]) => [rot[0] * x + rot[1] * y, rot[2] * x + rot[3] * y]);
                    const us = cs.map(c => c[0]), vs = cs.map(c => c[1]);
                    a = [X(p.u) + Math.min(...us), fy, Z(p.v) - Math.max(...vs)]; b = [X(p.u) + Math.max(...us), yh, Z(p.v) - Math.min(...vs)];
                    cfg = CF["gdA" + p.a0];
                    stl(vizStlGetGen(p.file, p.gen), cfg, a, b, P.divs, bxf);
                    continue;
                  }
                  if (p.kind === "div") {
                    if (p.o === "h") { a = [X(p.u0), fy, Z(p.a) - 12.7]; b = [X(p.u1), yh, Z(p.a) + 12.7]; cfg = CF.gdH; }
                    else { a = [X(p.a) - 12.7, fy, Z(p.u1)]; b = [X(p.a) + 12.7, yh, Z(p.u0)]; cfg = CF.gdV; }
                  } else {
                    // część brzegowa: blok przy ściance, język w szczelinie przegródki; zakończenie zaokrąglone: język 12,2 mm
                    // w przegródce, za nim 15,3 mm z zaokrąglonym końcem
                    const out = p.o === "h" ? p.side : -p.side, W = p.o === "h" ? X(p.at) : Z(p.at);
                    // na wymiar (p.len – blok + język, 0,5 mm od ścianki) albo USSA (20,2 mm)
                    const ln = p.len || 20.2, gp = p.gap || 0;
                    const [lo, hi] = p.kind === "edge" ? (out > 0 ? [W - gp - ln, W - gp] : [W + gp, W + gp + ln]) : (out > 0 ? [W - 12.2, W + 15.3] : [W - 15.3, W + 12.2]);
                    if (p.o === "h") { a = [lo, fy, Z(p.a) - 12.7]; b = [hi, yh, Z(p.a) + 12.7]; cfg = out > 0 ? CF.gdXp : CF.gdXn; }
                    else { a = [X(p.a) - 12.7, fy, lo]; b = [X(p.a) + 12.7, yh, hi]; cfg = out > 0 ? CF.gdZp : CF.gdZn; }
                  }
                  // bez siatki (wczytywanie, widok uproszczony) – sama ścianka 6 mm
                  if (!stl(p.gen ? vizStlGetGen(p.file, p.gen) : p.rx, cfg, a, b, P.divs, bxf))
                    m.box(p.o === "h" ? [a[0], fy, (a[2] + b[2]) / 2 - 3] : [(a[0] + b[0]) / 2 - 3, fy, a[2]],
                      p.o === "h" ? [b[0], yh, (a[2] + b[2]) / 2 + 3] : [(a[0] + b[0]) / 2 + 3, yh, b[2]], P.divs, bxf);
                }
              }
            }
            // prowadnice teleskopowe (Drawer Assembly kroki 6, 9–11; wymiary z plików STL, 2026-10-24):
            // prowadnica (Runner Guide 27 × 9,4 mm, długość modułu) leży przy ścianie modułu między żebrami T (14,3 i 42,3 mm
            // nad spodem poziomu; ich główki 13,9–18,9 / 37,4–42,4 mm trzymają ją przy ścianie) korytem do środka;
            // ślizg (Runner Slide 18,2 × 9 × 118 mm) wierzchem 12 × 2 mm w szczelinie ściany pudełka (od 26 mm od tyłu do
            // przodu), podstawą 18,2 × 2,5 (tylne 73 mm) w korycie prowadnicy – przednie 45 mm koryta to rowek T, który ją
            // zatrzymuje. Blokada w szczelinie modułu (45 mm od przodu) wchodzi w rowek na spodzie prowadnicy (35–136 mm od
            // przodu) – prowadnica wysuwa się do ~82 mm, pudełko w prowadnicy do ~44 mm; w widoku prowadnica jedzie 65 %
            // otwarcia, ślizg z pudełkiem. Tylko nowa biblioteka (1 sztuka w pliku); XL ma inne prowadnice – pominięte.
            if (fw !== "xl") {
              const gy = fy0 + 23.3, gxf = { t: [0, 0, bxf.t[2] * 0.65] };
              const guideRx = R`^01\. drawers/07\. universal/runners/x${d} runner guide\.stl$`, slideRx = R`^01\. drawers/07\. universal/runners/x${d} runner slide\.stl$`;
              for (const [wall, s] of [[ca, 1], [cb, -1]]) {
                const cfg = s > 0 ? CF.runL : CF.runR, xs = (p, q) => [Math.min(wall + s * p, wall + s * q), Math.max(wall + s * p, wall + s * q)];
                let [g0, g1] = xs(3.1, 12.5);  // ściana modułu 3,1 mm, prowadnica 9,4
                // rozsunięcie: prowadnica na zewnątrz (do ściany modułu i dalej), ślizg w pół drogi między nią a pudełkiem
                grp(sd - s * EX * 0.3, 0, (EX * 0.35 + pull) * 0.65);
                stl(guideRx, cfg, [g0, gy - 13.5, -D], [g1, gy + 13.5, 0], P.guide, gxf);
                pudlo(-s * EX * 0.15);
                [g0, g1] = xs(7.6, 16.6);  // podstawa ślizgu na dnie koryta (4,5 mm od ściany prowadnicy), wierzch 2 mm w ścianie pudełka
                stl(slideRx, cfg, [g0, gy - 9.1, -D], [g1, gy + 9.1, 0], P.box, bxf);
              }
              pudlo();
            }
          } else if (bxf) {  // pudełko szuflady (czarne, jak w instrukcji) widać tylko po wysunięciu albo przy rozsunięciu
            const xf = bxf;
            const a = ca + 9, b = cb - 9, ty0 = fy0 + 3, ty1 = fy1 - 7, z0 = -(D - 16), t = 2.2;
            m.box([a, ty0, z0], [b, ty0 + t, 0], P.box, xf, false);
            m.box([a, ty0, z0], [a + t, ty1, 0], P.box, xf, false);
            m.box([b - t, ty0, z0], [b, ty1, 0], P.box, xf, false);
            m.box([a, ty0, z0], [b, ty1, z0 + t], P.box, xf, false);
            m.boxEdges([a, ty0, z0], [b, ty1, 0], xf);
            if (insGrid(insOf(c, k))) {
              m.box([a + t, ty0 + t, z0 + t], [b - t, ty0 + t + 1.5, -0.5], insertCol, xf, false);
              vizGrid(m, a + t, b - t, z0 + t, -0.5, ty0 + t + 1.5, 4, vMix(insertCol, V_BLACK, 0.15), xf);
            }
          }
          przod(pull);
          S.picks.push({ id, a: [ca, fy0, 0], b: [cb, fy1, 16], xf: off(xf) });
        });
      } else {
        const id = `${si}-${li}-${ci}-s`, fy0 = ya + 5, fy1 = fy0 + 48 * h - 2;
        // bez wieka z pliku (bryły poglądowe): front opada na dolnej krawędzi, żeby było widać wnętrze
        const o = lidOpen[ci] ? 0 : S.open.get(id) || 0, xf = o > 0.0005 ? { a: o * 1.5, py: fy0, pz: 10 } : null;
        reach = Math.max(reach, Math.sin(o * 1.5) * (fy1 - fy0));
        const col = id === S.hover ? P.hover(P.sust) : P.sust, fw = fams[ci].toLowerCase();
        przod();
        const facRx = fw === "xl" ? R`^02\. sustainers/04\. xl families/xl1f facade\.stl$` : R`^02\. sustainers/[^/]+/facades/${fw}${h}f facade\.stl$`;
        const fr = stl(facRx, CF.fac, [ca, fy0, 0], [cb, fy1, 10], col, xf);
        const lockRx = R`^02\. sustainers/05\. universal/locks/lock outer part ${h === 1 ? "1f" : "2-4f"}\.stl$`;
        // etykieta: front 1F – krótka „Label for Sustainers”, 2F i 4F – wnęka jak w szufladach, więc Label.stl
        const labelRx = h === 1 ? R`^02\. sustainers/05\. universal/label for sustainers\.stl$` : R`^01\. drawers/07\. universal/label\.stl$`;
        const zamki = fr ? frontParts(fr, P.front, { rx: labelRx, key: `i:${st.id}:${l.id}:${ci}:0`, rodzaj: h === 1 ? "s" : "d" }, xf, lockRx, lidTop[ci], S.open.get(id) || 0) : 0;
        if (!fr) {  // skrzynka nie ma kluczyka (to zamek szuflad) – zamykają ją zatrzaski u góry
          m.box([ca + 1, fy0, 0], [cb - 1, fy1, 10], col, xf);
          m.box([ca + 12, fy0 + 7, 10], [ca + 46, fy0 + 15, 11], P.label, xf);
        }
        // bez zamków z pliku: zatrzaski poglądowe u góry (zachodzą na górną krawędź) – S/M jeden, L/XL dwa, jak wycięcia w froncie
        const lxs = fw === "s" || fw === "m" ? [mid] : [ca + cw * 0.2, cb - cw * 0.2];
        if (!zamki) for (const lx of lxs) m.box([lx - 12, fy1 - 30, 10], [lx + 12, fy1 + 3, 15], dark, xf);
        S.picks.push({ id, a: [ca, fy0, 0], b: [cb, fy1, 16], xf: off(xf) });
        grp(sx(ci));
        if (c.grid) vizGrid(m, ca + 3, cb - 3, -D + 3, -1, ya + 3, 4, vMix(P.housing, V_BLACK, 0.15), null);
      }
    });
    grp();
    if (S.V.labels) {
      const tags = separate ? fams.map(f => f + st.depth)
        : [l.layout === "L2" ? `L${st.depth}²` : l.layout === "XL2" ? `XL${st.depth}²` : fams[0] + st.depth];
      // face: etykieta należy do przodu wieży – znika, gdy patrzymy od tyłu
      S.labels.push({ p: [x0 - 14, (ya + yb) / 2, 12 + reach], face: [0, 0, 1], text: `${tags.join(" + ")} · ${l.height}F`, cls: "layer" });
    }
    y = yb - (li < st.layers.length - 1 || roofOn ? TEETH - EX : 0);
  });
  const y1 = y + (roofOn ? TEETH : 0);

  // dach (tylko nad szufladami) – kształty jak na stronie „Roof Types”
  const top = st.layers[st.layers.length - 1];
  const roofReal = top && top.type === "D" && st.roof !== "none" && (() => {
    const cut = st.roof === "heavy" && fam === "XL" && vizStlFile(R`^01\. drawers/[^/]+/xl${d}/roofs/xl${d} heavyweight roof cut\.stl$`);
    const r = stl(cut || R`^01\. drawers/[^/]+/${w}${d}/roofs/${w}${d} ${ROOF_FILE[st.roof]} roof\.stl$`, CF.roofUp, [x0, y, -D], [x1, y, 0], roofCol);  // Heavyweight też (listwy 4,8 mm po tej samej stronie pliku co w Table – pomiar 2026-11-02)
    // Heavyweight: rączka (rurka Ø 30 × 156,5 mm, w pliku długość wzdłuż Y) między koszami – końce w gniazdach ścianek koszy
    // (Y 44,7–74,9 mm nad spodem dachu, okrągły koniec gniazda na środku głębokości; L4, L6, XL5 Cut – pomiar 2026-11-02)
    if (r && st.roof === "heavy") {
      grp(0, EX * 0.6);
      const hx = (r.lo[0] + r.hi[0]) / 2, hy = r.lo[1] + 59.8, hz = (r.lo[2] + r.hi[2]) / 2;
      stl(R`^01\. drawers/07\. universal/heawyweight roof handle\.stl$`, CF.heavyHandle, [hx - 78.3, hy - 15, hz - 14.8], [hx + 78.3, hy + 15, hz + 14.8], P.dark);
      grp();
    }
    if (r) y += r.hi[1] - r.lo[1];
    return !!r;
  })();
  if (top && top.type === "D" && st.roof !== "none" && !roofReal) {
    const rc = roofCol;
    if (st.roof === "table") {
      m.box([x0, y, -D], [x1, y + 14, 0], rc);
      m.box([x0 + 7, y + 14, -D + 7], [x1 - 7, y + 18, -7], vMix(roofCol, V_WHITE, 0.15));
      y += 18;
    } else if (st.roof === "heavy") {
      m.box([x0, y, -D], [x1, y + 10, 0], rc);
      const b = Math.min(W * 0.3, D - 30), cz = -D / 2, bh = 72;
      for (const bx of [x0 + 8, x1 - 8 - b]) {  // dwa kosze
        m.box([bx, y + 10, cz - b / 2], [bx + b, y + 14, cz + b / 2], inner, null, false);
        for (const [a, c] of [[[bx, y + 10, cz - b / 2], [bx + 5, y + 10 + bh, cz + b / 2]], [[bx + b - 5, y + 10, cz - b / 2], [bx + b, y + 10 + bh, cz + b / 2]],
          [[bx + 5, y + 10, cz - b / 2], [bx + b - 5, y + 10 + bh, cz - b / 2 + 5]], [[bx + 5, y + 10, cz + b / 2 - 5], [bx + b - 5, y + 10 + bh, cz + b / 2]]]) m.box(a, c, rc);
      }
      m.cyl([xm, y + 10 + 34, cz], 0, 14, W - 16 - 2 * b, dark, null, 20);  // drążek między koszami
      y += 10 + bh;
    } else if (st.roof === "bowl") {
      m.box([x0, y, -D], [x1, y + 8, 0], rc);
      m.box([x0 + 10, y + 8, -D + 10], [x1 - 10, y + 9, -10], vMix(roofCol, V_BLACK, 0.15), null, false);
      for (const [a, b] of [[[x0, y + 8, -D], [x0 + 10, y + 24, 0]], [[x1 - 10, y + 8, -D], [x1, y + 24, 0]],
        [[x0 + 10, y + 8, -D], [x1 - 10, y + 24, -D + 10]], [[x0 + 10, y + 8, -10], [x1 - 10, y + 24, 0]]]) m.box(a, b, rc);
      y += 24;
    } else if (st.roof === "under") {
      m.box([x0, y, -D], [x1, y + 16, 0], rc);
      const nx = Math.max(2, Math.round(W / 70)), nz = Math.max(2, Math.round(D / 70));
      for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
        const hx = x0 + W * (i + 0.5) / nx, hz = -D + D * (k + 0.5) / nz;
        m.box([hx - 2.5, y + 16, hz - 2.5], [hx + 2.5, y + 16.5, hz + 2.5], hole, null, false);
      }
      y += 16;
    } else {  // grid: płyta z kratką gridfinity i obrzeżem
      m.box([x0, y, -D], [x1, y + 10, 0], rc);
      for (const [a, b] of [[[x0, y + 10, -D], [x0 + 4, y + 22, 0]], [[x1 - 4, y + 10, -D], [x1, y + 22, 0]],
        [[x0 + 4, y + 10, -D], [x1 - 4, y + 22, -D + 4]], [[x0 + 4, y + 10, -4], [x1 - 4, y + 22, 0]]]) m.box(a, b, rc, null, false);
      vizGrid(m, x0 + 4, x1 - 4, -D + 4, -4, y + 10, 12, vMix(roofCol, V_BLACK, 0.15), null);
      y += 22;
    }
  }
  if (top && top.type === "D" && st.roof !== "none") {
    // uchwyt górny: stojący pałąk 126 (wzdłuż szerokości) × 51 (wysokość) × 37 mm (głębokość) na płaskiej podstawie;
    // stoi w kratkach dachu Grid – tylko z tym dachem (jak lista części; inne dachy nie mają kratek ani otworów)
    if (st.topHandle && st.roof === "grid") {
      grp(0, EX * 0.6);
      const cz = -D / 2, hc = P.dark,  // grupa „uchwyty”
        hy = y - 12;
      if (!stl(R`^01\. drawers/07\. universal/top handle \(turn on supports\)\.stl$`, CF.handle, [xm - 63, hy, cz - 18.6], [xm + 63, hy + 51, cz + 18.6], hc)) {
        m.box([xm - 63, hy, cz - 25.5], [xm + 63, hy + 12, cz + 25.5], hc, null, false);
        m.cyl([xm, hy + 12, cz], 0, 25.5, 126, hc, null, 28);
      }
      y = Math.max(y, hy + 37.5);
      grp();
    }
  }

  // tył (2026-11-01, prośba użytkownika „popracuj nad wizualizacją kręgosłupa i rączek”; Modifications Assembly 1, 8–19):
  // kręgosłup (Backbone) – listwa na całą szerokość (dedykowany) albo para klocków 63 mm przy bokach (uniwersalny), płaską
  // stroną (Z min pliku) do tyłu modułu, klocki z otworami na zewnątrz; po jednym na warstwę (jak lista części: 1F 47 mm,
  // 2F 99 mm, 4F = 2× 2F, XL tylko 1F), na środku korpusu modułu (bez ząbków i listew; w skrzynce – do krawędzi modułu,
  // wieko się otwiera). Pręty M16 uchwytu wysuwanego idą pionowo przez klocki: 41,8 mm od boków, 15,8 mm za tyłem modułu
  // (otwory Ø 17 we wszystkich plikach kręgosłupów). Blokada uchwytu (Pull-out Handle Lock, 47 × 35 mm, pręty pionowo
  // przez zaciski z pokrętłami) – na górze najwyższej warstwy zamiast jej górnego kręgosłupa; uchwyt stały (Stationary
  // Handle, 47 mm, odstaje 50 mm) – na kręgosłupie pod blokadą (albo na samej górze). Rączka (Pull-out Handle) na prętach:
  // w widoku złożonym wsunięta (leży na blokadzie), rozłożonym – wysunięta 150 mm nad wieżę. Kształty z plików STL; bez
  // nich – bryły poglądowe. Pegboard (Modifications 15/15) – na kręgosłupie, płyta na każdy element kręgosłupa; uchwyty
  // ścienne (Mounting Instructions) – płyta na tył modułu, w otworach jaskółczych ogonów części 2 przykręcone do ściany.
  let back = -D;
  const BB_H = { 1: 47, 2: 99 }, rodZ = -D - 15.8, rodX = [x0 + 41.8, x1 - 41.8];
  const bbRx = h => md.backbone === "uni" ? new RegExp(MOD + `backbone/universal ${h}f backbone\\.stl$`) : new RegExp(MOD + `backbone/${w}${h}f backbone\\.stl$`);
  const bbHas = h => fam === "XL" && md.backbone !== "uni" ? h === 1 : h <= 2;
  const LOCK_H = 47, topY = layerBody.length ? layerBody[layerBody.length - 1][1] : y1, bbSlots = [];
  const lockOn = pullOn(st) && layerBody.length;
  // kręgosłup tylko na warstwach szuflad pod pierwszą skrzynką (zawiasy skrzynek za tyłem modułu – bbLayers w index.html)
  const nBB = bbLayers(st);
  // jeden element kręgosłupa o wysokości h (1/2 F) od y w górę
  const backbone = (h, ya) => {
    const yb = ya + BB_H[h], a = [x0, ya, -D - 33], b = [x1, yb, -D];
    if (md.backbone === "uni") {
      const l = stl(bbRx(h), CF.bbL, [x0, ya, -D - 33], [x0 + 63.05, yb, -D], modDark);
      const r = stl(bbRx(h), CF.bbR, [x1 - 63.05, ya, -D - 33], [x1, yb, -D], modDark);
      if (!l || !r) for (const [p, q] of [[x0, x0 + 63], [x1 - 63, x1]]) m.box([p, ya, -D - 33], [q, yb, -D], modDark);
      return;
    }
    if (stl(bbRx(h), CF.bb, a, b, modDark)) return;
    m.box(a, b, modDark);
    for (const hx of [x0 + 18, x0 + 36, x1 - 36, x1 - 18])
      for (const hy of BB_H[h] > 60 ? [ya + 12, yb - 12] : [(ya + yb) / 2]) m.box([hx - 3.5, hy - 3.5, -D - 33.5], [hx + 3.5, hy + 3.5, -D - 33], hole, null, false);
  };
  grp(0, 0, -EX * 0.5);
  if (md.backbone !== "none") {
    layerBody.forEach(([b0, b1, hl], i) => {
      if (i >= nBB) return;
      // najwyższa warstwa z blokadą: kręgosłup tylko pod nią
      const lockHere = lockOn && i === layerBody.length - 1;
      const hTot = lockHere ? Math.max(0, hl - 1) : hl;
      if (!hTot) return;
      const hs = boardsFor(hTot, bbHas), tot = hs.reduce((s, h) => s + BB_H[h], 0);
      let ya = lockHere ? b1 - LOCK_H - tot : (b0 + b1) / 2 - tot / 2;
      for (const h of hs) { backbone(h, ya); bbSlots.push([ya, h]); ya += BB_H[h]; }
    });
    if (bbSlots.length) back = -D - 33;
  }
  // pegboard (IKEA Skådis 5 mm / USSA 12 mm, szerokość W − 42) przykręcony do każdego elementu kręgosłupa – tylko z kręgosłupem
  // (prośba użytkownika 2026-11-01; formularz i lista części tak samo)
  grp(0, 0, -EX * 1.0);
  if (md.pegboard !== "none" && bbSlots.length) {
    const ikea = md.pegboard === "ikea", t = ikea ? 5 : 12, pw = W - 42;
    const dir = ikea ? "ikea skadis pegboard" : "ussa pegboard";
    for (const [ya, h] of bbSlots) {
      const a = [xm - pw / 2, ya, back - t], b = [xm + pw / 2, ya + BB_H[h], back];
      if (stl(new RegExp(MOD + `pegboard attachment/${dir}/${w}${h}f\\.stl$`), CF.peg, a, b, modCol)) continue;
      m.box(a, b, modCol);
      if (ikea) {
        for (let gx = a[0] + 12, i = 0; gx < b[0] - 6; gx += 20, i++)
          for (let gy = a[1] + 14 + (i % 2) * 10; gy < b[1] - 10; gy += 40) m.box([gx - 2.5, gy - 7.5, back - t - 0.5], [gx + 2.5, gy + 7.5, back - t], hole, null, false);
      } else {
        for (let gx = a[0] + 14; gx < b[0] - 8; gx += 25)
          for (let gy = a[1] + 12; gy < b[1] - 8; gy += 25) m.box([gx - 3, gy - 3, back - t - 0.5], [gx + 3, gy + 3, back - t], hole, null, false);
      }
    }
    back -= t;
  }
  // uchwyty ścienne (Wall Mounts, 48·F + 7 × 17 mm, pełna szerokość) na środku korpusu każdej warstwy (XL tylko 1F – warstwy
  // składane z 1F jak kręgosłup); w otworach (2F/4F: 17,5 mm pod górną krawędzią i w 4F jeszcze 96 mm niżej; L – dwa obok
  // siebie, 1F – bez otworu) część 2 przykręcona do ściany, równo z tylną płaszczyzną uchwytu – pomiar plików 2026-11-01
  if (wallOn(st)) {  // w miejscu kręgosłupa – z kręgosłupem i w wieży ze skrzynką pomijany (jak lista części)
    const WH = { 1: 55.1, 2: 103.1, 4: 199.1 }, wallHas = h => fam === "XL" ? h === 1 : true;
    const hooks = (h) => {
      const rows = h === 4 ? [0, 96] : h === 2 ? [0] : [];
      const xs = fam === "L" ? [xm - 82.4, xm + 82.4] : fam === "XL" ? [] : [xm];
      return rows.flatMap(r => xs.map(x => [x, r]));
    };
    layerBody.forEach(([b0, b1, hl]) => {
      const hs = boardsFor(hl, wallHas), tot = hs.reduce((s, h) => s + WH[h], 0);
      let ya = (b0 + b1) / 2 - tot / 2;
      for (const h of hs) {
        const yb = ya + WH[h];
        grp(0, 0, -EX * 1.4);
        if (!stl(new RegExp(MOD + `wall mounts/${w}${h}f wall mount\\.stl$`), CF.wall, [x0, ya, back - 17], [x1, yb, back], modCol))
          m.box([x0, ya, back - 17], [x1, yb, back], modCol);
        for (const [hx, r] of hooks(h)) {
          const top = yb - 10 - r;  // górna krawędź części 2 w jaskółczym ogonie otworu
          grp(0, 0, -EX * 1.8);
          if (!stl(new RegExp(MOD + "wall mounts/wall mount second part\\.stl$"), CF.wall2, [hx - 51.3, top - 24.2, back - 17], [hx + 51.3, top, back - 3.2], modDark))
            m.box([hx - 51, top - 24, back - 17], [hx + 51, top, back - 3.2], modDark);
        }
        ya = yb;
      }
    });
    back -= 17;
  }
  grp(0, 0, -EX * 1.0);
  if (md.handleStatic && backOn(st) && layerBody.length) {  // na kręgosłupie (jak lista części)
    // na kręgosłupie pod blokadą (albo na górze kręgosłupa – pod pierwszą skrzynką); gdy wieża za niska – na wysokości blokady
    const bbTop = layerBody[Math.min(nBB, layerBody.length) - 1][1];
    let ya = bbTop - LOCK_H - (lockOn ? LOCK_H : 0);
    if (ya < layerBody[0][0]) ya = bbTop - LOCK_H;
    const zb = md.backbone !== "none" ? -D - 33 : -D;
    if (!stl(new RegExp(MOD + `stationary handle/${w} stationary handle\\.stl$`), CF.statH, [x0, ya, zb - 50], [x1, ya + LOCK_H, zb], modCol)) {
      const hw = W - 42;
      for (const hx of [xm - hw / 2, xm + hw / 2 - 18]) m.box([hx, ya, zb - 50], [hx + 18, ya + LOCK_H, zb], modCol);
      m.box([xm - hw / 2, ya + 6, zb - 50], [xm + hw / 2, ya + LOCK_H - 6, zb - 36], modCol);
    }
    back = Math.min(back, zb - 50);
  }
  grp(0, 0, -EX * 0.5);
  if (lockOn) {
    const ly = topY - LOCK_H, lockUni = md.backbone === "uni";
    const lockRx = new RegExp(MOD + (lockUni ? "backbone/universal pull-out handle lock\\.stl$" : `backbone/${w} pull-out handle lock\\.stl$`));
    const okL = lockUni ? stl(lockRx, CF.lockL, [x0, ly, -D - 35], [x0 + 89.1, ly + LOCK_H, -D], modDark) && stl(lockRx, CF.lockR, [x1 - 89.1, ly, -D - 35], [x1, ly + LOCK_H, -D], modDark)
      : stl(lockRx, CF.lockP, [x0, ly, -D - 35], [x1, ly + LOCK_H, -D], modDark);
    if (!okL) m.box([x0, ly, -D - 35], [x1, ly + LOCK_H, -D], modDark);
    // pokrętła blokady (Handle Lock Knob: część 1 – pokrętło Ø 34 × 22 mm z płetwą, część 2 – nakładka na płetwę jak
    // Key Cap) na zewnętrznej ścianie blokady, przy prętach (Modifications 16–17)
    grp(0, 0, -EX * 0.8);  // pokrętła blokady
    for (const rx of rodX) {
      const kz = -D - 35, ky = ly + LOCK_H / 2;
      if (stl(new RegExp(MOD + "backbone/handle lock knob part 1\\.stl$"), CF.knob, [rx - 17, ky - 17, kz - 22], [rx + 17, ky + 17, kz], P.dark))
        stl(new RegExp(MOD + "backbone/handle lock knob part 2\\.stl$"), CF.knobCap, [rx - 7, ky - 19, kz - 23.5], [rx + 7, ky + 19, kz - 23.5 + 11.67], P.dark);
      else m.cyl([rx, ky, kz - 11], 2, 17, 22, P.dark, null, 24);
    }
    // rączka: wsunięta (złożone) – leży na blokadzie, wysunięta – 150 mm nad wieżą; pręty od dołu kręgosłupa do rączki
    const hy = S.V.packed ? topY : y + 150, hz = [rodZ - 17.5, rodZ + 17.5];
    const rb = layerBody[0][0];
    grp(0, 0, -EX * 0.5);
    for (const rx of rodX) m.cyl([rx, (rb + hy + 30) / 2, rodZ], 1, 8, hy + 30 - rb, metal, null, 16);
    grp(0, EX * 0.6, -EX * 0.5);  // rączka w górę
    if (!stl(new RegExp(MOD + `pull-out handle/${w} pull-out handle\\.stl$`), CF.pullH, [x0, hy, hz[0]], [x1, hy + 61.5, hz[1]], modDark)) {
      m.box([rodX[0] - 16, hy, hz[0]], [rodX[1] + 16, hy + 35, hz[1]], modDark);
      m.box([rodX[0] + 14, hy + 8, hz[0] - 1], [rodX[1] - 14, hy + 22, hz[1] + 1], hole, null, false);
    }
    back = Math.min(back, -D - 57);
  }

  grp();
  // wymiary (linie + opisy)
  if (S.V.dims) {
    const A = [...S.accent, 1], tick = 12, front = 12, dz = front + 55, dx = x1 + (wheels ? 90 : 55);
    m.line([x0, 1, dz], [x1, 1, dz], A); m.line([x0, 1, dz - tick], [x0, 1, dz + tick], A); m.line([x1, 1, dz - tick], [x1, 1, dz + tick], A);
    m.line([dx, 0, front], [dx, y, front], A); m.line([dx - tick, 0, front], [dx + tick, 0, front], A); m.line([dx - tick, y, front], [dx + tick, y, front], A);
    m.line([dx, 1, back], [dx, 1, front], A); m.line([dx - tick, 1, back], [dx + tick, 1, back], A);
    S.labels.push({ p: [xm, 1, dz], text: `${Math.round(W)} mm`, cls: "dim" });
    S.labels.push({ p: [dx, y / 2, front], text: `${Math.round(y)} mm`, cls: "dim" });
    S.labels.push({ p: [dx, 1, (back + front) / 2], text: `${Math.round(front - back)} mm`, cls: "dim" });
  }
  if (S.V.all) S.labels.push({ p: [xm, y + 40, -D / 2], text: `${st.name} ×${st.qty}`, cls: "stack" });
  const kw = wheels ? 46 : 0;
  S.rects.push([x0 - kw, back, x1 + kw, 12]);  // obrys na podłodze dla cienia
}

function vizScene(V, open, hover, accent) {
  const m = vizMesh(), S = { V, open, hover, accent, picks: [], labels: [], rects: [], parts: [] };
  // Każda część ma jeden z 5 kolorów palety (prośba użytkownika 2026-10-28: „niektóre elementy mają kolor, którego nie ma
  // w palecie”), przypisanych dokładnie jak grupy w „Przygotuj wydruk” (VIZ_GROUP_ROLE); pręty M16 – stal. Cienie wnętrza
  // obudowy i otworów poglądowych to przyciemnione kolory palety.
  // każda rola = kolor jednej grupy wydruku (vizGroupColors). Obudowa i fronty z tego samego filamentu (jasnoszary jak
  // w instrukcji): obudowa, wieka, dachy i modyfikacje w tym kolorze o odcień ciemniejsze, żeby fronty odcinały się od modułu
  const G = vizGroupColors(V), c = g => vizShow(G[g]), same = G.moduly.toLowerCase() === G.fronty.toLowerCase();
  const housing = same ? vMix(c("moduly"), V_BLACK, 0.06) : c("moduly"), front = c("fronty");
  const h = g => G[g].toLowerCase() === G.moduly.toLowerCase() ? housing : c(g);
  const P = { housing, front, sust: c("fronty_skrzynek"), box: c("pudelka"), lock: c("drobne"), stop: c("blokady"),
    label: c("etykiety"), dark: c("uchwyty"), lid: h("wieka"), roof: h("dachy"), mods: h("modyfikacje"), tyre: c("opony"),
    insert: c("wklady"), insertS: c("wklady_skrzynek"), bins: c("pojemniki"), divs: c("przegrodki"),
    // nakładka kluczyka (grupa frontów) w kolorze frontu, prowadnice (grupa modułów) w kolorze obudowy – jak w instrukcji
    keycap: front, guide: housing,
    // front pod kursorem: jaśniejszy albo ciemniejszy odcień własnego koloru
    hover: c => vMix(c, 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] < 0.45 ? V_WHITE : V_BLACK, 0.22) };
  const list = V.all ? state.stacks.map((st, i) => [st, i]) : [[state.stacks[state.current], state.current]];
  let x = 0;
  for (const [st, si] of list) {
    const W = WIDTH_MM[baseWidth(st)];
    vizStack(m, S, st, si, x - (list.length === 1 ? W / 2 : 0), P);
    x += W + 170;
  }
  // obrys do klikania: narożniki przekształcone tak samo jak front (wysunięcie, obrót)
  for (const p of S.picks) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < 8; i++) {
      const q = m.xp([i & 1 ? p.b[0] : p.a[0], i & 2 ? p.b[1] : p.a[1], i & 4 ? p.b[2] : p.a[2]], p.xf);
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[k]); hi[k] = Math.max(hi[k], q[k]); }
    }
    p.lo = lo; p.hi = hi;
  }
  return { m, ...S };
}

// ---------- Renderer WebGL2 ----------
function vizRenderer(gl) {
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = (vs, fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, "#version 300 es\n" + vs));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, "#version 300 es\nprecision highp float;\n" + fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
      const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, "");
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  };
  const SHADE = `vec3 shade(vec3 n, vec3 c, vec3 w, vec3 eye) {
       vec3 l1 = normalize(vec3(0.45, 0.85, 0.6)), l2 = normalize(vec3(-0.6, 0.35, 0.45));
       vec3 l3 = normalize(vec3(-0.3, 0.5, -0.8));  // słabe światło od tyłu – żeby tył wieży nie był czarny
       float d = max(dot(n, l1), 0.0) * 0.6 + max(dot(n, l2), 0.0) * 0.22 + max(dot(n, l3), 0.0) * 0.28 + 0.3 + 0.1 * (n.y * 0.5 + 0.5);
       vec3 v = normalize(eye - w);
       float s = pow(max(dot(n, normalize(l1 + v)), 0.0), 40.0) * 0.16;
       float ao = mix(0.8, 1.0, smoothstep(0.0, 110.0, w.y));
       return c * d * ao + s;
     }`;
  const lit = program(
    `layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC;
     uniform mat4 uVP; out vec3 vN; out vec3 vC; out vec3 vW;
     void main() { vN = aN; vC = aC; vW = aP; gl_Position = uVP * vec4(aP, 1.0); }`,
    `in vec3 vN; in vec3 vC; in vec3 vW; uniform vec3 uEye; out vec4 o; ${SHADE}
     void main() { o = vec4(shade(normalize(vN), vC, vW, uEye), 1.0); }`);
  // siatki z plików STL: macierz modelu i kolor części, normalna ściany z pochodnych położenia (siatka uproszczona
  // nie ma normalnych), zwrócona do oka – niektóre pliki mają odwrócone trójkąty
  const part = program(
    `layout(location=0) in vec3 aP; uniform mat4 uVP; uniform mat4 uM; out vec3 vW;
     void main() { vec4 w = uM * vec4(aP, 1.0); vW = w.xyz; gl_Position = uVP * w; }`,
    `in vec3 vW; uniform vec3 uEye; uniform vec3 uC; out vec4 o; ${SHADE}
     void main() {
       vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
       if (dot(n, uEye - vW) < 0.0) n = -n;
       o = vec4(shade(n, uC, vW, uEye), 1.0);
     }`);
  const gpu = new Map();  // wpis VIZ_STL → bufory na karcie (wgrywane raz)
  const gpuOf = e => {
    let g = gpu.get(e);
    if (g) return g;
    const v = gl.createVertexArray(), b = gl.createBuffer(), ib = gl.createBuffer();
    gl.bindVertexArray(v);
    gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, e.pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, e.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    g = { v, b, ib, n: e.idx.length };
    gpu.set(e, g);
    return g;
  };
  const lines = program(
    `layout(location=0) in vec3 aP; layout(location=1) in vec4 aC; uniform mat4 uVP; out vec4 vC;
     void main() { vC = aC; gl_Position = uVP * vec4(aP, 1.0); }`,
    `in vec4 vC; out vec4 o; void main() { o = vec4(vC.rgb * vC.a, vC.a); }`);
  const floor = program(
    `layout(location=0) in vec3 aP; uniform mat4 uVP; out vec2 vP;
     void main() { vP = aP.xz; gl_Position = uVP * vec4(aP, 1.0); }`,
    `in vec2 vP; uniform vec4 uRects[16]; uniform int uN; uniform vec3 uColor; uniform vec2 uC; uniform float uR; out vec4 o;
     float sdBox(vec2 p, vec4 r) { vec2 c = (r.xy + r.zw) * 0.5, h = (r.zw - r.xy) * 0.5; vec2 d = abs(p - c) - h;
       return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
     void main() {
       float d = 1e9;
       for (int i = 0; i < 16; i++) { if (i >= uN) break; d = min(d, sdBox(vP, uRects[i])); }
       float sh = (1.0 - smoothstep(-40.0, 220.0, d)) * 0.28 + (1.0 - smoothstep(-6.0, 22.0, d)) * 0.3;
       vec2 g = abs(fract(vP / 42.0 - 0.5) - 0.5) / fwidth(vP / 42.0);
       float grid = 1.0 - min(min(g.x, g.y), 1.0);
       float fade = 1.0 - smoothstep(uR * 0.3, uR, length(vP - uC));
       vec3 col = uColor * (1.0 - sh) * (1.0 - grid * 0.07);
       o = vec4(col * fade, fade);
     }`);

  const vao = (layout) => {
    const v = gl.createVertexArray(), b = gl.createBuffer();
    gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    const stride = layout.reduce((n, k) => n + k, 0) * 4;
    let off = 0;
    layout.forEach((k, i) => { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, k, gl.FLOAT, false, stride, off); off += k * 4; });
    gl.bindVertexArray(null);
    return { v, b, n: 0, per: stride / 4 };
  };
  const T = vao([3, 3, 3]), L = vao([3, 4]), F = vao([3]);
  const put = (o, data) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, o.b);
    gl.bufferData(gl.ARRAY_BUFFER, data instanceof Float32Array ? data : new Float32Array(data), gl.DYNAMIC_DRAW);
    o.n = data.length / o.per;
  };

  // ---------- Render „Photo” (zgłoszenie nr 9 / pomysł z VAULTaway, 2026-11-07) ----------
  // Bez śledzenia promieni: N klatek uśrednionych w buforze zmiennoprzecinkowym. Każda klatka ma mapę cieni z jednego
  // kierunku – na przemian słońce (stożek ~5° → miękkie cienie) i losowy kierunek nieba (półkula → zacienienie
  // zakamarków i szczelin), do tego przesunięcie kamery o ułamek piksela (gładkie krawędzie). Kolory palety to sRGB:
  // liczone liniowo, na końcu krzywa ACES i gamma. Wynik zostaje na płótnie (Zapisz PNG).
  const PHOTO_FS = `uniform sampler2D uSh; uniform mat4 uLVP; uniform vec3 uL; uniform vec3 uEye; uniform float uSun; uniform float uSky; uniform float uAmb;
     float vis(vec3 w, vec3 n) {
       vec4 p = uLVP * vec4(w + n * 1.2, 1.0); vec3 q = p.xyz / p.w * 0.5 + 0.5;
       if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0 || q.z > 1.0) return 1.0;
       return q.z - 0.0006 > texture(uSh, q.xy).r ? 0.0 : 1.0;
     }
     vec3 photo(vec3 n, vec3 c, vec3 w) {
       vec3 alb = pow(c, vec3(2.2));
       float ndl = max(dot(n, uL), 0.0), v = ndl > 0.0 ? vis(w, n) : 0.0;
       vec3 h = normalize(uL + normalize(uEye - w));
       float s = uSun > 0.0 ? pow(max(dot(n, h), 0.0), 60.0) * 0.35 * v * ndl : 0.0;
       return alb * ((uSun + uSky) * ndl * v + uAmb) + s * uSun * 0.5;
     }`;
  const shadowP = program(
    `layout(location=0) in vec3 aP; uniform mat4 uLVP; uniform mat4 uM; void main() { gl_Position = uLVP * uM * vec4(aP, 1.0); }`,
    `out vec4 o; void main() { o = vec4(1.0); }`);
  const photoLit = program(
    `layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC;
     uniform mat4 uVP; out vec3 vN; out vec3 vC; out vec3 vW;
     void main() { vN = aN; vC = aC; vW = aP; gl_Position = uVP * vec4(aP, 1.0); }`,
    `in vec3 vN; in vec3 vC; in vec3 vW; out vec4 o; ${PHOTO_FS}
     void main() { vec3 n = normalize(vN); if (dot(n, uEye - vW) < 0.0) n = -n; o = vec4(photo(n, vC, vW), 1.0); }`);
  const photoPart = program(
    `layout(location=0) in vec3 aP; uniform mat4 uVP; uniform mat4 uM; out vec3 vW;
     void main() { vec4 w = uM * vec4(aP, 1.0); vW = w.xyz; gl_Position = uVP * w; }`,
    `in vec3 vW; uniform vec3 uC; out vec4 o; ${PHOTO_FS}
     void main() { vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if (dot(n, uEye - vW) < 0.0) n = -n; o = vec4(photo(n, uC, vW), 1.0); }`);
  const photoFloor = program(
    `layout(location=0) in vec3 aP; uniform mat4 uVP; out vec3 vW; void main() { vW = aP; gl_Position = uVP * vec4(aP, 1.0); }`,
    `in vec3 vW; uniform vec3 uColor; uniform vec2 uC; uniform float uR; out vec4 o; ${PHOTO_FS}
     void main() { float fade = 1.0 - smoothstep(uR * 0.25, uR * 0.85, length(vW.xz - uC)); o = vec4(photo(vec3(0.0, 1.0, 0.0), uColor, vW) * fade, fade); }`);
  const QUAD_VS = `layout(location=0) in vec2 aP; out vec2 vT; void main() { vT = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;
  const addP = program(QUAD_VS, `in vec2 vT; uniform sampler2D uT; out vec4 o; void main() { o = texture(uT, vT); }`);
  const toneP = program(QUAD_VS, `in vec2 vT; uniform sampler2D uT; uniform float uN; out vec4 o;
     vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
     void main() { vec4 a = texture(uT, vT) / uN; vec3 c = a.a > 0.0 ? a.rgb / a.a : vec3(0.0);
       o = vec4(pow(aces(c), vec3(1.0 / 2.2)) * a.a, a.a); }`);
  const quad = gl.createVertexArray(), qb = gl.createBuffer();
  gl.bindVertexArray(quad); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.bindVertexArray(null);
  const tex = (w, h, fmt, ifmt, type) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]])
      gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  };
  let PH = null;  // zasoby renderu „Photo” (tworzone przy pierwszym użyciu, przy zmianie rozmiaru płótna od nowa)
  const photoRes = (w, h) => {
    if (PH && PH.w === w && PH.h === h) return PH;
    if (PH) { for (const t of PH.tex) gl.deleteTexture(t); for (const f of PH.fb) gl.deleteFramebuffer(f); gl.deleteRenderbuffer(PH.rb); }
    const SM = 2048, sh = tex(SM, SM, gl.DEPTH_COMPONENT, gl.DEPTH_COMPONENT24, gl.UNSIGNED_INT);
    const shFb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, shFb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, sh, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    const frame = tex(w, h, gl.RGBA, gl.RGBA16F, gl.HALF_FLOAT), acc = tex(w, h, gl.RGBA, gl.RGBA32F, gl.FLOAT);
    const rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    const frFb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frFb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frame, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    const okFr = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    const accFb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, accFb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, acc, 0);
    const okAcc = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    PH = { w, h, SM, sh, shFb, frame, acc, rb, frFb, accFb, ok: okFr && okAcc, tex: [sh, frame, acc], fb: [shFb, frFb, accFb] };
    return PH;
  };
  const floatOk = !!gl.getExtension("EXT_color_buffer_float");
  let sceneBox = null;
  let fl = null, parts = [];
  return {
    drop(e) {  // zwolnienie buforów siatki, której już nie będzie (podgląd pojemnika po zmianie parametrów)
      const g = gpu.get(e);
      if (!g) return;
      gl.deleteVertexArray(g.v); gl.deleteBuffer(g.b); gl.deleteBuffer(g.ib);
      gpu.delete(e);
    },
    upload(scene) {
      put(T, scene.m.tri); put(L, scene.m.lin);
      parts = scene.parts;
      const lo = scene.m.lo, hi = scene.m.hi, cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;
      const R = Math.max(hi[0] - lo[0], hi[2] - lo[2], hi[1] - lo[1]) * 1.6 + 600;
      put(F, [cx - R, -0.5, cz - R, cx + R, -0.5, cz - R, cx + R, -0.5, cz + R, cx - R, -0.5, cz - R, cx + R, -0.5, cz + R, cx - R, -0.5, cz + R]);
      const rects = new Float32Array(64);
      scene.rects.slice(0, 16).forEach((r, i) => rects.set(r, i * 4));
      fl = { rects, n: Math.min(16, scene.rects.length), c: [cx, cz], R };
      sceneBox = { lo: lo.slice(), hi: hi.slice() };
    },
    // render „Photo”: camVP(jx, jy) – macierz kamery przesunięta o ułamek piksela; zwraca Promise<boolean> (false – brak
    // obsługi buforów zmiennoprzecinkowych albo przerwane przez cancel()); onProgress(ułamek)
    photo({ camVP, eye, floorColor, sunDir = [0.45, 0.85, 0.6], frames = 96, onProgress = () => {}, cancelled = () => false }) {
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      if (!floatOk || !fl || !sceneBox) return Promise.resolve(false);
      const P = photoRes(w, h);
      if (!P.ok) return Promise.resolve(false);
      const lo = sceneBox.lo, hi = sceneBox.hi, c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
      const r = Math.max(200, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2) * 1.15;
      const sun = vNorm(sunDir), ident = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      // ciąg Haltona – równomierne próbki (przesunięcie kamery, kierunki)
      const halton = (i, b) => { let f = 1, x = 0; for (; i > 0; i = Math.floor(i / b)) { f /= b; x += f * (i % b); } return x; };
      const dirOf = k => {
        const u = halton(k + 1, 2), v = halton(k + 1, 3);
        if (k % 2 === 0) {  // słońce: kierunek w stożku ~5° wokół sun
          const t = vNorm(vCross(sun, [0, 1, 0])), b = vCross(t, sun), a = 2 * Math.PI * u, rr = 0.09 * Math.sqrt(v);
          return { L: vNorm(vAdd(sun, vAdd(vMul(t, Math.cos(a) * rr), vMul(b, Math.sin(a) * rr)))), sun: 1.25 * 2, sky: 0 };
        }
        // niebo: półkula nad podłogą (równomiernie po kącie bryłowym), y ≥ 0,08 – płaskie promienie i tak trafiają w podłogę
        const y = 0.08 + 0.92 * u, s = Math.sqrt(1 - y * y), a = 2 * Math.PI * v;
        return { L: [s * Math.cos(a), y, s * Math.sin(a)], sun: 0, sky: 0.36 * 2 * 2 * 0.92 };
      };
      gl.bindFramebuffer(gl.FRAMEBUFFER, P.accFb); gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      let k = 0;
      const one = () => {
        const d = dirOf(k), L = d.L;
        // mapa cieni z kierunku L (rzut prostokątny na kulę otaczającą scenę)
        const LV = M4.look(vAdd(c, vMul(L, r * 2)), c, Math.abs(L[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0]);
        const LVP = M4.mul(M4.ortho(r, r, r * 0.5, r * 3.5), LV);
        gl.bindFramebuffer(gl.FRAMEBUFFER, P.shFb); gl.viewport(0, 0, P.SM, P.SM);
        gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND); gl.depthMask(true);
        gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
        gl.useProgram(shadowP.p); gl.uniformMatrix4fv(shadowP.u.uLVP, false, LVP);
        gl.uniformMatrix4fv(shadowP.u.uM, false, ident);
        gl.bindVertexArray(T.v); gl.drawArrays(gl.TRIANGLES, 0, T.n);
        for (const pt of parts) { const g = gpuOf(pt.e); gl.uniformMatrix4fv(shadowP.u.uM, false, pt.M); gl.bindVertexArray(g.v); gl.drawElements(gl.TRIANGLES, g.n, gl.UNSIGNED_INT, 0); }
        gl.disable(gl.POLYGON_OFFSET_FILL);
        // klatka: kamera przesunięta o ułamek piksela
        const VP = camVP((halton(k + 1, 2) - 0.5) * 2 / w, (halton(k + 1, 3) - 0.5) * 2 / h);
        gl.bindFramebuffer(gl.FRAMEBUFFER, P.frFb); gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, P.sh);
        const common = prog => {
          gl.useProgram(prog.p);
          gl.uniformMatrix4fv(prog.u.uVP, false, VP); gl.uniformMatrix4fv(prog.u.uLVP, false, LVP);
          gl.uniform1i(prog.u.uSh, 0); gl.uniform3fv(prog.u.uL, L); gl.uniform3fv(prog.u.uEye, eye);
          gl.uniform1f(prog.u.uSun, d.sun); gl.uniform1f(prog.u.uSky, d.sky); gl.uniform1f(prog.u.uAmb, 0.03);
        };
        gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        common(photoFloor);
        // podłoga ciemniejsza od tła – widać na niej cień
        gl.uniform3fv(photoFloor.u.uColor, vMul(floorColor, 0.82)); gl.uniform2fv(photoFloor.u.uC, fl.c); gl.uniform1f(photoFloor.u.uR, fl.R);
        gl.bindVertexArray(F.v); gl.drawArrays(gl.TRIANGLES, 0, F.n);
        gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST);
        common(photoLit);
        gl.bindVertexArray(T.v); gl.drawArrays(gl.TRIANGLES, 0, T.n);
        common(photoPart);
        for (const pt of parts) {
          const g = gpuOf(pt.e);
          gl.uniformMatrix4fv(photoPart.u.uM, false, pt.M); gl.uniform3fv(photoPart.u.uC, pt.col);
          gl.bindVertexArray(g.v); gl.drawElements(gl.TRIANGLES, g.n, gl.UNSIGNED_INT, 0);
        }
        // dodanie klatki do sumy
        gl.bindFramebuffer(gl.FRAMEBUFFER, P.accFb); gl.viewport(0, 0, w, h);
        gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(addP.p); gl.bindTexture(gl.TEXTURE_2D, P.frame); gl.uniform1i(addP.u.uT, 0);
        gl.bindVertexArray(quad); gl.drawArrays(gl.TRIANGLES, 0, 6);
        k++;
      };
      const show = () => {  // suma / liczba klatek → płótno
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, P.acc);
        gl.useProgram(toneP.p); gl.uniform1i(toneP.u.uT, 0); gl.uniform1f(toneP.u.uN, Math.max(1, k));
        gl.bindVertexArray(quad); gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindVertexArray(null); gl.bindTexture(gl.TEXTURE_2D, null);
      };
      return new Promise(res => {
        // po kilka klatek naraz, następna porcja dopiero gdy karta graficzna skończy poprzednią (fence) – polecenia WebGL są
        // asynchroniczne, bez czekania cała praca trafiłaby do kolejki za jednym razem (zawieszenie, brak postępu)
        let sync = null;
        const tick = () => {
          if (cancelled()) { if (sync) gl.deleteSync(sync); gl.bindFramebuffer(gl.FRAMEBUFFER, null); res(false); return; }
          if (sync) {
            if (gl.getSyncParameter(sync, gl.SYNC_STATUS) !== gl.SIGNALED) { setTimeout(tick, 4); return; }
            gl.deleteSync(sync); sync = null;
            show(); onProgress(k / frames);
            if (k >= frames) { res(true); return; }
          }
          for (let i = 0; i < 4 && k < frames; i++) one();
          sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush();
          setTimeout(tick, 4);
        };
        tick();
      });
    },

    draw(VP, eye, floorColor) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(floor.p);
      gl.uniformMatrix4fv(floor.u.uVP, false, VP);
      gl.uniform4fv(floor.u.uRects, fl.rects); gl.uniform1i(floor.u.uN, fl.n);
      gl.uniform3fv(floor.u.uColor, floorColor); gl.uniform2fv(floor.u.uC, fl.c); gl.uniform1f(floor.u.uR, fl.R);
      gl.bindVertexArray(F.v); gl.drawArrays(gl.TRIANGLES, 0, F.n);

      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
      gl.useProgram(lit.p);
      gl.uniformMatrix4fv(lit.u.uVP, false, VP); gl.uniform3fv(lit.u.uEye, eye);
      gl.bindVertexArray(T.v); gl.drawArrays(gl.TRIANGLES, 0, T.n);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      if (parts.length) {
        gl.useProgram(part.p);
        gl.uniformMatrix4fv(part.u.uVP, false, VP); gl.uniform3fv(part.u.uEye, eye);
        for (const pt of parts) {
          const g = gpuOf(pt.e);
          gl.uniformMatrix4fv(part.u.uM, false, pt.M); gl.uniform3fv(part.u.uC, pt.col);
          gl.bindVertexArray(g.v); gl.drawElements(gl.TRIANGLES, g.n, gl.UNSIGNED_INT, 0);
        }
      }

      gl.depthMask(false);
      gl.useProgram(lines.p);
      gl.uniformMatrix4fv(lines.u.uVP, false, VP);
      gl.bindVertexArray(L.v); gl.drawArrays(gl.LINES, 0, L.n);
      gl.depthMask(true);
      gl.bindVertexArray(null);
    },
  };
}

// przesunięcie środka widoku o dx, dy pikseli (prawy przycisk myszy): scena idzie za kursorem; cam: yaw, pitch, dist
function vizPan(cam, dx, dy, h) {
  const cp = Math.cos(cam.pitch), f = vMul([Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp], -1);
  const r = vNorm(vCross(f, [0, 1, 0])), u = vCross(r, f), s = 2 * cam.dist * Math.tan(VIZ_FOV / 2) / (h || 1);
  return vAdd(vMul(r, -dx * s), vMul(u, dy * s));
}
// grupa wydruku części z pliku (index.html: colorGroup); klucz siatki generowanej może mieć dopisek „#…”
const vizPartGroup = file => file && typeof colorGroup === "function" ? colorGroup(String(file).replace(/#.*$/, "")) : null;

// Część trafiona promieniem o + t·d (kolor po kliknięciu w oknie 3D – zgłoszenie nr 9, 2026-11-07): dla każdej części
// z grupą promień przeniesiony do układu siatki (odwrotność macierzy M, kolumnowej), najpierw bryła otaczająca, potem
// trójkąty (Möller–Trumbore). Zwraca { part, t } najbliższej albo null.
function vizRayParts(parts, o, d) {
  let best = null, bt = Infinity;
  for (const p of parts) {
    if (!p.group) continue;
    const e = p.e, P = e.pos, I = e.idx, M = p.M;
    if (!e.bb) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { const v = P[i + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
      e.bb = { lo, hi };
    }
    // odwrotność części liniowej (3×3) macierzy afinicznej
    const a = M[0], b = M[4], c = M[8], dd = M[1], ee = M[5], f = M[9], g = M[2], h = M[6], k = M[10];
    const A = ee * k - f * h, B = -(dd * k - f * g), C = dd * h - ee * g, det = a * A + b * B + c * C;
    if (!det) continue;
    const inv = [A / det, -(b * k - c * h) / det, (b * f - c * ee) / det,
      B / det, (a * k - c * g) / det, -(a * f - c * dd) / det,
      C / det, -(a * h - b * g) / det, (a * ee - b * dd) / det];
    const q = [o[0] - M[12], o[1] - M[13], o[2] - M[14]];
    const lo_ = [inv[0] * q[0] + inv[1] * q[1] + inv[2] * q[2], inv[3] * q[0] + inv[4] * q[1] + inv[5] * q[2], inv[6] * q[0] + inv[7] * q[1] + inv[8] * q[2]];
    const ld = [inv[0] * d[0] + inv[1] * d[1] + inv[2] * d[2], inv[3] * d[0] + inv[4] * d[1] + inv[5] * d[2], inv[6] * d[0] + inv[7] * d[1] + inv[8] * d[2]];
    if (vizRayBox(lo_, ld, e.bb.lo, e.bb.hi) >= bt) continue;
    for (let i = 0; i < I.length; i += 3) {
      const i0 = I[i] * 3, i1 = I[i + 1] * 3, i2 = I[i + 2] * 3;
      const e1x = P[i1] - P[i0], e1y = P[i1 + 1] - P[i0 + 1], e1z = P[i1 + 2] - P[i0 + 2];
      const e2x = P[i2] - P[i0], e2y = P[i2 + 1] - P[i0 + 1], e2z = P[i2 + 2] - P[i0 + 2];
      const px = ld[1] * e2z - ld[2] * e2y, py = ld[2] * e2x - ld[0] * e2z, pz = ld[0] * e2y - ld[1] * e2x;
      const det2 = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det2) < 1e-12) continue;
      const id = 1 / det2, sx = lo_[0] - P[i0], sy = lo_[1] - P[i0 + 1], sz = lo_[2] - P[i0 + 2];
      const u = (sx * px + sy * py + sz * pz) * id;
      if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
      const v = (ld[0] * qx + ld[1] * qy + ld[2] * qz) * id;
      if (v < 0 || u + v > 1) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * id;
      if (t > 0 && t < bt) { bt = t; best = p; }
    }
  }
  return best ? { part: best, t: bt } : null;
}

function vizRayBox(o, d, lo, hi) {
  let t0 = 0, t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    const inv = 1 / d[i];
    let a = (lo[i] - o[i]) * inv, b = (hi[i] - o[i]) * inv;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (!(t0 <= t1)) return Infinity;
  }
  return t0;
}

// ---------- Okno wizualizacji ----------
let VIZ = null;

// dock: true – panel obok edytora, false – pełne okno, brak – jak ostatnio (przyciski pod podglądem wieży)
function openViz(dock) {
  // ponowne „Obok edytora” przy otwartym panelu zamyka widok 3D (prośba użytkownika 2026-11-07)
  if (VIZ) { if (dock === true && state.viz && state.viz.dock) VIZ.close(); else if (dock !== undefined && VIZ.dock) VIZ.dock(dock); return; }
  state.viz = Object.assign({ palette: "ussa", ...VIZ_PALETTES.ussa, labels: true, dims: false, all: false, rotate: false, stl: true, packed: true, ortho: false, explode: 0 }, state.viz || {});
  const V = state.viz;
  if (dock !== undefined) V.dock = !!dock;
  if (VIZ_PALETTES[V.palette]) Object.assign(V, VIZ_PALETTES[V.palette]);  // paleta mogła się zmienić w nowej wersji
  if (V.palette === "druk") Object.assign(V, vizPrintColors());  // kolory części mogły się zmienić od ostatniego otwarcia
  if (state.stacks.length < 2) V.all = false;
  const css = getComputedStyle(document.documentElement), cssHex = k => css.getPropertyValue(k);

  const canvas = el("canvas", { class: "viz-canvas" });
  const labelsBox = el("div", { class: "viz-labels" });
  const stage = el("div", { class: "viz-stage" }, canvas, labelsBox);
  const bar = el("div", { class: "viz-bar" }), badge = el("span", { class: "hint" });  // badge: postęp wczytywania kształtów z plików
  const ov = el("div", { class: "viz-overlay", role: "dialog" }, bar, stage,
    el("div", { class: "viz-foot hint" },
      tr("Przeciągnij – obrót, prawy przycisk – przesuwanie, kółko – przybliżenie, kliknięcie frontu – otwarcie, dwuklik – widok domyślny.") + " " +
      tr("Moduły, fronty, zamki, pudełka, dachy, podstawa, stopki, koła, kręgosłup, pegboard i uchwyty z plików STL (uproszczone; pierwsze otwarcie trwa dłużej); złożone – moduły zapięte jak w rzeczywistości, rączka wsunięta.")));
  document.body.append(ov);
  // „Obok edytora” (zgłoszenie nr 9 – widok 3D na żywo przy edycji, 2026-11-07): okno jako panel z prawej (na wąskim ekranie
  // u dołu), strona pod nim dalej działa, a każda zmiana projektu (save/render w index.html → VIZ.refresh) przebudowuje scenę
  const applyDock = () => {
    ov.classList.toggle("dock", !!V.dock);
    ov.setAttribute("aria-modal", V.dock ? "false" : "true");
    document.body.classList.toggle("viz-docked", !!V.dock);
    document.body.style.overflow = V.dock ? "" : "hidden";
  };
  applyDock();

  const gl = canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
  let R = null;
  try { if (gl) R = vizRenderer(gl); } catch (e) { console.error(e); }
  if (!R) stage.replaceChildren(el("p", { class: "err", style: "padding:20px" }, tr("Ta przeglądarka nie obsługuje WebGL 2 – wizualizacja 3D jest niedostępna.")));

  const cam = { yaw: VIZ_VIEWS.q[0], pitch: VIZ_VIEWS.q[1], dist: 2000, t: [0, 150, 0] };
  const goal = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, t: cam.t.slice() };
  const open = new Map(), target = new Map();
  let hover = null, scene = null, labelsKey = "", geo = true, dirty = true, last = performance.now(), raf = 0;
  let drag = null, lastEye = [0, 0, 0], liveFit = false, liveBox = "";
  let photoJob = null, photoShown = false;  // render „Photo”: trwający ({ cancel }) i wynik na płótnie
  const accent = vHex(cssHex("--accent"));

  const stlOn = () => V.stl && location.protocol !== "file:";
  VIZ_STL.onload = () => { geo = true; refit = true; };
  let refit = false;
  const rebuild = () => {
    scene = vizScene({ ...V, stl: stlOn() }, open, hover, accent);
    R.upload(scene);
    const key = scene.labels.map(l => l.cls + "|" + l.text).join("\n");
    if (key !== labelsKey) {
      labelsKey = key;
      labelsBox.replaceChildren(...scene.labels.map(l => el("div", { class: "viz-label " + l.cls }, l.text)));
    }
    geo = false; dirty = true;
  };
  const fit = (instant) => {
    const lo = scene.m.lo, hi = scene.m.hi;
    goal.t = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    const r = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2;
    // płótno bez rozmiaru (okno jeszcze nierozłożone, karta w tle): proporcje 1 – inaczej 1/0 = ∞ i kamera na stałe NaN
    const asp = canvas.clientWidth && canvas.clientHeight ? canvas.clientWidth / canvas.clientHeight : 1;
    goal.dist = r / Math.sin(VIZ_FOV / 2) * (asp < 1 ? 1 / asp : 1) * 0.98;
    if (!isFinite(goal.dist)) goal.dist = 2000;
    if (instant) { cam.t = goal.t.slice(); cam.dist = goal.dist; }
    dirty = true;
  };
  const view = k => { [goal.yaw, goal.pitch] = VIZ_VIEWS[k]; fit(false); };

  const draw = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    const cp = Math.cos(cam.pitch);
    const eye = vAdd(cam.t, vMul([Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp], cam.dist));
    // rzut prostokątny (V.ortho): ta sama wielkość co perspektywa w środku sceny – połowa wysokości = odległość · tg(FOV/2)
    const hh = cam.dist * Math.tan(VIZ_FOV / 2);
    const proj = V.ortho ? M4.ortho(hh * w / h, hh, cam.dist * 0.05, cam.dist * 20) : M4.persp(VIZ_FOV, w / h, cam.dist * 0.05, cam.dist * 20);
    const VP = M4.mul(proj, M4.look(eye, cam.t, [0, 1, 0]));
    lastEye = eye;
    const bg = vHex(cssHex("--bg")), panel = vHex(cssHex("--panel"));
    R.draw(VP, eye, vMix(bg, panel, 0.55));
    // opisy: rzut punktu 3D na ekran
    const kids = labelsBox.children;
    scene.labels.forEach((l, i) => {
      const p = l.p, e = kids[i];
      const cx = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12], cy = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13];
      const cw = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15];
      if (!e) return;
      if (cw <= 0 || (l.face && vDot(vSub(eye, p), l.face) < 0)) { e.style.display = "none"; return; }
      e.style.display = "";
      e.style.left = ((cx / cw) * 0.5 + 0.5) * w + "px";
      e.style.top = (0.5 - (cy / cw) * 0.5) * h + "px";
    });
    dirty = false;
  };

  const angDiff = (a, b) => { let d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };
  const frame = now => {
    try { step(now); } catch (e) { console.error("wizualizacja:", e); }
    raf = requestAnimationFrame(frame);
  };
  const step = now => {
    const dt = Math.min(0.05, Math.max(0, now - last) / 1000);
    last = now;
    // ruch kamery albo zmiana sceny w trakcie renderu „Photo” – przerwanie
    if (photoJob && (geo || dirty)) photoJob.cancel = true;
    for (const [id, t] of target) {
      // stała prędkość (pełne otwarcie ~2,4 s): pierwsze 40 % ruchu to odpinanie zatrzasków skrzynki albo obrót kluczyka
      // szuflady (prośby użytkownika 2026-10-27: wolniejsze otwieranie zamka, kluczyk w tym samym tempie)
      const o = open.get(id) || 0, n = o + Math.sign(t - o) * Math.min(Math.abs(t - o), dt / 2.4);
      const v = Math.abs(t - n) < 0.002 ? t : n;
      if (v !== o) { open.set(id, v); geo = true; }
      if (v === t && t === 0) { target.delete(id); open.delete(id); }
    }
    if (V.rotate && !drag) { goal.yaw += dt * 0.3; cam.yaw += dt * 0.3; dirty = true; }
    if (!isFinite(cam.dist)) cam.dist = isFinite(goal.dist) ? goal.dist : 2000;  // zabezpieczenie: NaN zostałby na zawsze
    const k = 1 - Math.exp(-dt * 9);
    const dy = angDiff(goal.yaw, cam.yaw), dp = goal.pitch - cam.pitch, dd = goal.dist - cam.dist, dtv = vSub(goal.t, cam.t);
    if (Math.abs(dy) + Math.abs(dp) > 1e-4 || Math.abs(dd) > 0.5 || Math.hypot(...dtv) > 0.5) {
      cam.yaw += dy * k; cam.pitch += dp * k; cam.dist += dd * k; cam.t = vAdd(cam.t, vMul(dtv, k)); dirty = true;
    }
    if (geo) rebuild();
    // zmiana projektu przy otwartym oknie: kamera dopasowuje się tylko, gdy zmienił się rozmiar sceny (np. nowa warstwa)
    if (liveFit && scene) {
      liveFit = false;
      const box = [...scene.m.lo, ...scene.m.hi].map(v => Math.round(v / 20)).join(",");
      if (liveBox && box !== liveBox) fit(false);
      liveBox = box;
    }
    // licznik wczytywanych kształtów (serwer upraszcza duże pliki po jednym – do tego czasu bryły poglądowe)
    const all = [...VIZ_STL.map.values()], loading = all.filter(e => e.status === "loading").length;
    const txt = loading && stlOn() ? tr("wczytywanie kształtów: {a}/{b}", { a: all.length - loading, b: all.length }) : "";
    if (!photoJob && badge.textContent !== txt) badge.textContent = txt;
    if (refit && !loading) { refit = false; fit(false); }
    if (dirty && !photoJob) { draw(); photoShown = false; }
  };

  const ray = (px, py) => {
    const w = canvas.clientWidth, h = canvas.clientHeight, nx = px / w * 2 - 1, ny = 1 - py / h * 2, th = Math.tan(VIZ_FOV / 2);
    const f = vNorm(vSub(cam.t, lastEye)), r = vNorm(vCross(f, [0, 1, 0])), u = vCross(r, f);
    let o = lastEye, d = vNorm(vAdd(f, vAdd(vMul(r, nx * th * w / h), vMul(u, ny * th))));
    if (V.ortho) {  // promienie równoległe: początek przesunięty w płaszczyźnie widoku
      const hh = cam.dist * th;
      o = vAdd(lastEye, vAdd(vMul(r, nx * hh * w / h), vMul(u, ny * hh)));
      d = f;
    }
    return [o, d];
  };
  const pick = (px, py) => {
    const [o, d] = ray(px, py);
    let best = null, bt = Infinity;
    for (const p of scene.picks) { const t = vizRayBox(o, d, p.lo, p.hi); if (t < bt) { bt = t; best = p.id; } }
    return best;
  };
  // Kolor po kliknięciu (zgłoszenie nr 9, 2026-11-07): tryb „Kolor kliknięciem” – kliknięta część pokazuje okienko
  // z filamentami (COLOR_PALETTE) dla jej grupy wydruku. Zmienia kolor grupy w oknie (paleta „własne”, a w „kolory części”
  // – kolory do wydruku); „także do wydruku” zapisuje go od razu w „Kolorach części” (state.colors).
  let paintBox = null;
  const paintClose = () => { if (paintBox) { paintBox.remove(); paintBox = null; } };
  const paintSet = (g, hex, print) => {
    if (print || V.palette === "druk") { state.colors = state.colors || {}; state.colors[g] = hex.toUpperCase(); }
    if (V.palette === "druk") Object.assign(V, vizPrintColors());
    else { Object.assign(V, vizGroupRoles(V)); V[VIZ_GROUP_ROLE[g]] = hex; V.palette = "custom"; }
    save(); geo = true; renderBar();
    if (print && typeof renderResult === "function") renderResult();
  };
  const paintAt = (px, py) => {
    paintClose();
    if (!scene) return;
    const hit = vizRayParts(scene.parts, ...ray(px, py)), g = hit && hit.part.group;
    if (!g || !(g in VIZ_GROUP_ROLE)) {
      if (!V.stl) toast(tr("Kolor kliknięciem działa na kształtach z plików STL – włącz „Kształty z plików STL”."), false);
      return;
    }
    const groups = typeof COLOR_GROUPS !== "undefined" ? COLOR_GROUPS : [], name = tr((groups.find(x => x[0] === g) || [])[1] || g);
    const cur = (vizGroupColors(V)[g] || "").toLowerCase(), pal = typeof filColors === "function" ? filColors(g === "opony" && FIL()[FIL_TPU] ? FIL_TPU : undefined) : [];
    const printChk = el("input", { type: "checkbox", checked: V.palette === "druk" || !!V.paintPrint, disabled: V.palette === "druk",
      onchange: e => { V.paintPrint = e.target.checked; save(); } });
    const pickHex = hex => { paintSet(g, hex, printChk.checked); paintClose(); };
    paintBox = el("div", { class: "viz-paint", role: "dialog", "aria-label": tr("Kolor grupy {g}", { g: name }) },
      el("div", { class: "row" }, el("b", {}, name), el("span", { style: "flex:1" }), el("button", { class: "small", title: tr("Zamknij (Esc)"), onclick: paintClose }, "✕")),
      el("div", { class: "hint" }, tr("Kolor całej grupy – tak jak w „Kolorach części” w „Przygotuj wydruk”.")),
      el("div", { class: "hint" }, g === "opony" && typeof FIL === "function" && FIL()[FIL_TPU] ? FIL_TPU : typeof filLine === "function" ? filLine() : ""),
      el("div", { class: "viz-paint-sw" }, pal.map(([hex, n]) => el("button", { class: "sw" + (hex.toLowerCase() === cur ? " on" : ""), title: n,
        style: `background:${hex}`, "aria-label": n, onclick: () => pickHex(hex) }))),
      el("div", { class: "row" }, el("label", {}, tr("własny") + " ", el("input", { type: "color", value: /^#[0-9a-f]{6}$/i.test(cur) ? cur : "#888888", onchange: e => pickHex(e.target.value) })),
        el("label", { title: V.palette === "druk" ? tr("Paleta „kolory części” to kolory do wydruku") : "" }, printChk, " ", tr("także do wydruku"))));
    stage.append(paintBox);
    const W = stage.clientWidth, H = stage.clientHeight, bw = paintBox.offsetWidth, bh = paintBox.offsetHeight;
    paintBox.style.left = Math.max(6, Math.min(W - bw - 6, px + 12)) + "px";
    paintBox.style.top = Math.max(6, Math.min(H - bh - 6, py + 12)) + "px";
    const first = paintBox.querySelector(".sw.on") || paintBox.querySelector(".sw");
    if (first) first.focus();
  };
  const toggle = id => { const now = target.has(id) ? target.get(id) : (open.get(id) || 0); target.set(id, now > 0.5 ? 0 : 1); };
  const setAll = v => { for (const p of scene.picks) target.set(p.id, v); };

  // lewy przycisk – obrót, prawy (i środkowy) – przesuwanie widoku (prośba użytkownika 2026-11-02); widoki i dwuklik
  // ustawiają środek od nowa
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("pointerdown", e => {
    drag = { x: e.clientX, y: e.clientY, moved: 0, pan: e.button === 2 || e.button === 1 };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    const rc = canvas.getBoundingClientRect();
    // puszczony przycisk bez pointerup (prawy przycisk – menu kontekstowe w Windows; zgłoszenie użytkownika: przesuwanie
    // trwało do następnego kliknięcia) – koniec przeciągania
    if (drag && !e.buttons) { drag = null; canvas.style.cursor = "grab"; }
    if (drag && drag.pan) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
      const t = vizPan(cam, dx, dy, canvas.clientHeight);
      cam.t = vAdd(cam.t, t); goal.t = vAdd(goal.t, t);
      dirty = true;
      canvas.style.cursor = "move";
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
      goal.yaw -= dx * 0.008; cam.yaw -= dx * 0.008;
      goal.pitch = Math.max(0.02, Math.min(1.45, goal.pitch + dy * 0.006)); cam.pitch = goal.pitch;
      dirty = true;
      canvas.style.cursor = "grabbing";
      return;
    }
    if (V.paint) { if (hover) { hover = null; geo = true; } canvas.style.cursor = "crosshair"; return; }
    if (photoJob || photoShown) return;  // podświetlenie frontu zamazałoby zdjęcie
    const id = pick(e.clientX - rc.left, e.clientY - rc.top);
    if (id !== hover) { hover = id; geo = true; }
    canvas.style.cursor = id ? "pointer" : "grab";
  });
  canvas.addEventListener("pointerup", e => {
    const rc = canvas.getBoundingClientRect();
    if (drag && !drag.pan && drag.moved < 5) {
      if (V.paint) paintAt(e.clientX - rc.left, e.clientY - rc.top);
      else { const id = pick(e.clientX - rc.left, e.clientY - rc.top); if (id) toggle(id); }
    }
    drag = null;
    canvas.style.cursor = "grab";
  });
  for (const t of ["pointercancel", "lostpointercapture"]) canvas.addEventListener(t, () => { drag = null; canvas.style.cursor = "grab"; });
  canvas.addEventListener("pointerleave", () => { if (hover) { hover = null; geo = true; } });
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    goal.dist = Math.max(250, Math.min(20000, goal.dist * Math.exp(e.deltaY * 0.0012)));
    dirty = true;
  }, { passive: false });
  canvas.addEventListener("dblclick", () => view("q"));

  const close = () => {
    if (photoJob) photoJob.cancel = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    document.removeEventListener("keydown", onKey);
    const lose = gl && gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
    ov.remove();
    document.body.style.overflow = "";
    document.body.classList.remove("viz-docked");
    VIZ_STL.onload = null;
    VIZ = null;
  };
  // Esc w polu edytora obok zadokowanego okna nie zamyka okna
  const onKey = e => { if (e.key === "Escape") { if (paintBox) paintClose(); else if (!V.dock || ov.contains(e.target) || e.target === document.body) close(); } };
  document.addEventListener("keydown", onKey);
  // tylko prawdziwa zmiana rozmiaru (przebudowa paska wywołuje obserwatora bez zmiany – przerywałoby to render „Zdjęcie”)
  let roSize = "";
  const ro = new ResizeObserver(() => { const k = stage.clientWidth + "x" + stage.clientHeight; if (k !== roSize) { roSize = k; dirty = true; } });
  ro.observe(stage);

  // „Zdjęcie” (render Photo w vizRenderer): kamera zatrzymana w bieżącym ujęciu, ~96 klatek uśrednionych; drugi klik – przerwij
  const photoRun = async () => {
    if (photoJob) { photoJob.cancel = true; return; }
    if (!scene || !R) return;
    Object.assign(cam, { yaw: goal.yaw, pitch: goal.pitch, dist: goal.dist, t: goal.t.slice() });
    V.rotate = false;
    draw();
    const w = canvas.clientWidth, h = canvas.clientHeight, hh = cam.dist * Math.tan(VIZ_FOV / 2);
    const proj = V.ortho ? M4.ortho(hh * w / h, hh, cam.dist * 0.05, cam.dist * 20) : M4.persp(VIZ_FOV, w / h, cam.dist * 0.05, cam.dist * 20);
    const VP0 = M4.mul(proj, M4.look(lastEye, cam.t, [0, 1, 0]));
    const job = photoJob = { cancel: false };
    dirty = false; geo = false;
    renderBar();
    const bg = vHex(cssHex("--bg")), panel = vHex(cssHex("--panel"));
    // słońce z lewej, z przodu i z góry względem kamery – cień pada w prawo do tyłu, widoczny na podłodze
    const az = cam.yaw - 0.9, sunDir = [Math.sin(az) * 0.62, 0.78, Math.cos(az) * 0.62];
    const ok = await R.photo({ eye: lastEye, floorColor: vMix(bg, panel, 0.55), sunDir, frames: 96,
      camVP: (jx, jy) => M4.mul(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, jx, jy, 0, 1]), VP0),
      onProgress: f => { badge.textContent = tr("zdjęcie: {p} %", { p: Math.round(f * 100) }); },
      cancelled: () => job.cancel });
    photoJob = null; badge.textContent = "";
    if (ok) { photoShown = true; dirty = false; toast(tr("Zdjęcie gotowe – „Zapisz PNG” zapisze je w pliku. Obrót albo przybliżenie wraca do zwykłego widoku."), false); }
    else { dirty = true; if (!job.cancel) toast(tr("Ta przeglądarka nie obsługuje renderu „Zdjęcie” (WebGL 2 z buforami zmiennoprzecinkowymi)."), false); }
    if (VIZ) renderBar();
  };

  const savePng = () => {
    if (dirty && scene) draw();
    const name = (V.all ? "VAULT" : state.stacks[state.current].name).replace(/[\\/:*?"<>|]+/g, "_").trim() || "VAULT";
    canvas.toBlob(b => {
      const a = el("a", { href: URL.createObjectURL(b), download: name + ".png" });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  };

  function renderBar() {
    const tog = (k, text) => el("button", { class: "small" + (V[k] ? " on" : ""), onclick: () => {
      V[k] = !V[k]; save(); geo = true; renderBar();
      if (k === "all") { setTimeout(() => fit(false)); }
    } }, text);
    // podczas przesuwania (input) tylko kolor sceny – przebudowa paska usuwała pole i przeglądarka zamykała okno wyboru
    // koloru po pierwszym ruchu (zgłoszenie użytkownika 2026-11-02); pasek (wybór palety „własne”) po zamknięciu okna (change)
    // próbka na każdą grupę kolorów z „Przygotuj wydruk” (te same nazwy); zmiana – paleta „własne”, z kolorami poprzedniej
    const G = vizGroupColors(V), groups = typeof COLOR_GROUPS !== "undefined" ? COLOR_GROUPS : [];
    const color = g => el("input", { type: "color", value: G[g].toLowerCase(), title: tr((groups.find(x => x[0] === g) || [])[1] || g),
      oninput: e => { Object.assign(V, vizGroupRoles(V)); V[VIZ_GROUP_ROLE[g]] = e.target.value; V.palette = "custom"; save(); geo = true; },
      onchange: e => { Object.assign(V, vizGroupRoles(V)); V[VIZ_GROUP_ROLE[g]] = e.target.value; V.palette = "custom"; save(); geo = true; renderBar(); } });
    // kolejność (prośba użytkownika 2026-11-05): jak w instrukcji, kolory z wydruku, własne, potem gotowe warianty
    const palettes = [["ussa", tr("jasnoszary (jak w instrukcji)")], ["druk", tr("kolory części (z wydruku)")], ["custom", tr("własne")],
      ["black", tr("czarny + pomarańcz")], ["white", tr("biały")], ["graphite", tr("grafit")], ["forest", tr("leśny")],
      ["navy", tr("niebieskoszary + granat")], ["warm", tr("beż + kakao")], ["turquoise", tr("biały + turkus")], ["red", tr("czerwień + grafit")]];
    bar.replaceChildren(
      el("b", {}, tr("Wizualizacja 3D")),
      el("span", { class: "viz-group" }, tr("Widok:") + " ",
        ...[["front", tr("przód")], ["side", tr("bok")], ["q", "3/4"], ["top", tr("góra")], ["back", tr("tył")]]
          .map(([k, t]) => el("button", { class: "small", onclick: () => view(k) }, t))),
      el("span", { class: "viz-group" },
        el("button", { class: "small", onclick: () => setAll(1) }, tr("Otwórz wszystkie")),
        el("button", { class: "small", onclick: () => setAll(0) }, tr("Zamknij wszystkie"))),
      el("span", { class: "viz-group" }, tog("ortho", tr("Bez perspektywy")),
        el("label", { title: tr("Rozsunięcie wieży we wszystkich osiach – warstwy w pionie, fronty do przodu, moduły i koła na boki, kręgosłup do tyłu") }, tr("Rozsunięcie") + " ",
          el("input", { type: "range", min: 0, max: 1, step: 0.05, value: +V.explode || 0, style: "width:90px;vertical-align:middle",
            oninput: e => { V.explode = +e.target.value; save(); geo = true; },
            onchange: () => setTimeout(() => fit(false)) }))),
      el("span", { class: "viz-group" }, tog("rotate", tr("Obracaj")), tog("labels", tr("Etykiety")), tog("dims", tr("Wymiary")), tog("packed", tr("Złożone")),
        location.protocol !== "file:" && !WEB ? tog("stl", tr("Kształty z plików STL")) : null,
        state.stacks.length > 1 ? tog("all", tr("Wszystkie zestawy")) : null, badge),
      el("span", { class: "viz-group" }, tr("Kolory:") + " ",
        el("button", { class: "small" + (V.paint ? " on" : ""), title: tr("Kliknij część w widoku, żeby wybrać kolor jej grupy (moduły, fronty, pudełka…)"),
          onclick: () => { V.paint = !V.paint; paintClose(); save(); geo = true; renderBar(); } }, "🎨 " + tr("Kolor kliknięciem")),
        sel(V.palette, palettes, v => { V.palette = v; if (VIZ_PALETTES[v]) Object.assign(V, VIZ_PALETTES[v]); if (v === "druk") Object.assign(V, vizPrintColors()); save(); geo = true; renderBar(); }),
        ...Object.keys(VIZ_GROUP_ROLE).map(color)),
      el("span", { class: "viz-group", style: "margin-left:auto" },
        el("button", { class: "small" + (V.dock ? " on" : ""), title: tr("Okno 3D obok edytora – zmiany w projekcie widać od razu"),
          // panel obok edytora: ponowne kliknięcie zamyka widok 3D (pełne okno – przycisk „Wizualizacja 3D” pod podglądem)
          onclick: () => { if (V.dock) { close(); return; } V.dock = true; save(); applyDock(); renderBar(); setTimeout(() => fit(false), 50); } }, tr("Obok edytora")),
        el("button", { class: "small" + (photoJob ? " on" : ""), onclick: photoRun,
          title: photoJob ? tr("Przerwij zdjęcie") : tr("Realistyczny obraz z miękkimi cieniami i światłem nieba (kilka sekund), potem „Zapisz PNG”. Obrót albo przybliżenie wraca do zwykłego widoku.") },
          "📷 " + tr("Zdjęcie")),  // ten sam napis w trakcie (zmiana szerokości paska zmieniłaby rozmiar płótna i przerwała render)
        el("button", { class: "small", onclick: savePng }, tr("Zapisz PNG")),
        el("button", { class: "small", title: tr("Zamknij (Esc)"), onclick: close }, "✕")));
  }
  renderBar();

  // step: ręczne klatki do testów (np. gdy karta w tle nie dostaje requestAnimationFrame)
  VIZ = { close, step: (ms = 16) => step(last + ms), view, setAll, refresh: () => { geo = true; liveFit = true; }, toggleFirst: () => scene.picks[0] && toggle(scene.picks[0].id),
    state: () => ({ cam: { ...cam }, open: [...open], picks: scene && scene.picks.length, photo: photoShown, photoBusy: !!photoJob }),
    parts: () => scene ? scene.parts : [],  // test zgodności kolorów z grupami wydruku
    // przyciski pod podglądem wieży przy otwartym oknie: przełączenie pełne okno / obok edytora
    dock: on => { if (!!V.dock === !!on) return; V.dock = !!on; save(); applyDock(); renderBar(); setTimeout(() => fit(false), 50); } };
  if (!R) return;
  rebuild();
  requestAnimationFrame(() => { fit(true); raf = requestAnimationFrame(frame); });
}

// ---------- Miniatury części na liście „Do druku” ----------
// (2026-11-03, pytanie użytkownika „czy możemy wyświetlać miniaturki STL-i, jeśli przesuwamy kursorem nad nazwą?”)
// Element z atrybutem data-thumb (plik) pokazuje po 300 ms dymek z częścią ułożoną jak w pliku (Z w górę – tak leży na
// stole slicera) i wymiarami. Jeden kontekst WebGL na wszystkie miniatury: siatka z /api/siatka (pliki generowane –
// /api/pojemnik z parametrami z THUMB.gen), render do ukrytego płótna, obrazek zapamiętany na plik, kolor i tło;
// siatka nie zostaje w pamięci (chyba że wczytało ją okno 3D), bufory na karcie zwalniane od razu.
const THUMB = { img: new Map(), load: new Map(), gen: new Map(), tip: null, timer: 0, cur: null, shown: "", x: 0, y: 0 };
const THUMB_W = 240, THUMB_H = 180;

// kolor części jak w oknie 3D: paleta state.viz (w „druk” – kolory grup z „Przygotuj wydruk”)
function thumbColor(file) {
  const V = Object.assign({}, VIZ_PALETTES.ussa, state.viz || {});
  if (V.palette === "druk") Object.assign(V, vizPrintColors());
  const c = vizGroupColors(V)[typeof colorGroup === "function" ? colorGroup(file) : "drobne"];
  return /^#[0-9a-f]{6}$/i.test(c || "") ? c.toLowerCase() : "#d1d3d5";
}

function thumbRender(e, col, bg, flip) {
  if (!THUMB.R) {
    const c = THUMB.canvas = document.createElement("canvas");
    c.width = THUMB_W * 2; c.height = THUMB_H * 2;  // podwójna gęstość – ostro także na ekranach o skali 200 %
    const gl = c.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
    try { if (gl) THUMB.R = vizRenderer(gl); } catch (err) { console.error(err); }
    if (!THUMB.R) return null;
  }
  const P = e.pos, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { const v = P[i + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
  const sx = hi[0] - lo[0], sy = hi[1] - lo[1], sz = hi[2] - lo[2];
  // X pliku w prawo, Z w górę, Y w głąb; środek bryły nad początkiem układu, spód na podłodze. flip – obrót o 180° wokół X
  // (etykieta wklęsła i wpuszczona leży w pliku licem do stołu – w miniaturze napis do góry)
  const M = flip ? new Float32Array([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, -(lo[0] + hi[0]) / 2, hi[2], -(lo[1] + hi[1]) / 2, 1])
    : new Float32Array([1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, -(lo[0] + hi[0]) / 2, -lo[2], (lo[1] + hi[1]) / 2, 1]);
  let c = vHex(col);
  const lum = v => 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2], b = vHex(bg);
  if (Math.abs(lum(c) - lum(b)) < 0.2) c = vMix(c, lum(b) < 0.5 ? V_WHITE : V_BLACK, 0.35);  // czarne pudełko na ciemnym tle
  const parts = [{ e, M, col: c }];
  if (e.text) parts.push({ e: e.text, M, col: vHex(state.labelTextColor || "#000000") });
  THUMB.R.upload({ m: { tri: [], lin: [], lo: [-sx / 2, 0, -sy / 2], hi: [sx / 2, sz, sy / 2] }, parts, rects: [[-sx / 2, -sy / 2, sx / 2, sy / 2]] });
  const dist = Math.hypot(sx, sy, sz) / 2 / Math.sin(VIZ_FOV / 2) * 1.04, yaw = 0.62, pitch = 0.5, t = [0, sz / 2, 0];
  const eye = vAdd(t, vMul([Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)], dist));
  const gl = THUMB.canvas.getContext("webgl2");
  gl.viewport(0, 0, THUMB.canvas.width, THUMB.canvas.height);
  THUMB.R.draw(M4.mul(M4.persp(VIZ_FOV, THUMB_W / THUMB_H, dist * 0.05, dist * 20), M4.look(eye, t, [0, 1, 0])), eye, vMix(b, V_BLACK, 0.06));
  const url = THUMB.canvas.toDataURL("image/png");
  for (const p of parts) THUMB.R.drop(p.e);
  return { url, size: [sx, sy, sz] };
}

function thumbGet(file, col, bg) {
  const key = file + "|" + col + "|" + bg;
  if (THUMB.img.has(key)) return Promise.resolve(THUMB.img.get(key));
  let p = THUMB.load.get(key);
  if (!p) {
    const shared = VIZ_STL.map.get(file), gen = THUMB.gen.get(file);  // siatka wczytana już przez okno 3D
    const flip = !!gen && gen.typ === "etykieta" && gen.styl !== "wypukly";
    p = (shared && shared.status === "ok" ? Promise.resolve(shared) : vizStlFetch(file, undefined, gen))
      .then(e => {
        const r = e.status === "ok" ? thumbRender(e, col, bg, flip) : null;
        if (r) {  // błędu nie zapamiętujemy – serwer mógł być chwilowo niedostępny
          THUMB.img.set(key, r);
          if (THUMB.img.size > 300) THUMB.img.delete(THUMB.img.keys().next().value);
        }
        return r;
      })
      .finally(() => THUMB.load.delete(key));
    THUMB.load.set(key, p);
  }
  return p;
}

// dymek przy kursorze, zawsze w oknie (przy prawej i dolnej krawędzi – po drugiej stronie kursora)
function thumbPlace() {
  const tip = THUMB.tip;
  if (!tip || tip.hidden) return;
  const w = tip.offsetWidth, h = tip.offsetHeight, W = document.documentElement.clientWidth, H = window.innerHeight, g = 16;
  let x = THUMB.x + g, y = THUMB.y + g;
  if (x + w > W - 8) x = THUMB.x - g - w;
  if (y + h > H - 8) y = THUMB.y - g - h;
  tip.style.left = Math.max(8, Math.min(x, W - w - 8)) + "px";
  tip.style.top = Math.max(8, Math.min(y, H - h - 8)) + "px";
}

function thumbHide() {
  clearTimeout(THUMB.timer);
  if (THUMB.cur) THUMB.cur.removeAttribute("aria-describedby");
  THUMB.cur = null; THUMB.shown = "";
  if (THUMB.tip) THUMB.tip.hidden = true;
}

function thumbShow(a) {
  if (THUMB.cur !== a || !a.isConnected) return;
  if (location.protocol === "file:" || typeof SERVER === "undefined" || !SERVER.ok) return;  // bez serwera – bez miniatur
  const file = a.dataset.thumb, css = getComputedStyle(document.documentElement);
  const col = thumbColor(file), bg = css.getPropertyValue("--panel").trim() || "#ffffff";
  if (!THUMB.tip) {
    THUMB.tip = el("div", { class: "thumb-tip", role: "tooltip", id: "thumbTip", hidden: true },
      el("img", { alt: "", width: THUMB_W, height: THUMB_H }), el("div", { class: "hint" }));
    document.body.append(THUMB.tip);
  }
  const tip = THUMB.tip, img = tip.firstChild, cap = tip.lastChild;
  THUMB.shown = file;
  const fill = r => {
    if (THUMB.cur !== a) return;
    img.hidden = !r;
    if (r) img.src = r.url;
    const g = typeof GEOM !== "undefined" && GEOM[file], s = g ? g.slice(2, 5) : r ? r.size : null;
    cap.textContent = !r ? tr("brak podglądu kształtu")
      : s.map(v => v.toLocaleString(typeof locale === "function" ? locale() : undefined, { maximumFractionDigits: 1 })).join(" × ") + " mm";
    thumbPlace();
  };
  const key = file + "|" + col + "|" + bg;
  if (THUMB.img.has(key)) fill(THUMB.img.get(key));
  else {
    img.hidden = true;
    cap.textContent = tr("wczytywanie kształtu…");
    thumbGet(file, col, bg).then(fill, () => fill(null));
  }
  a.setAttribute("aria-describedby", "thumbTip");
  tip.hidden = false;
  thumbPlace();
}

function thumbArm(a, x, y) {
  THUMB.x = x; THUMB.y = y;
  clearTimeout(THUMB.timer);
  // ten sam plik w przerysowanej liście (np. po zmianie licznika wydrukowanych) – dymek zostaje
  if (THUMB.tip && !THUMB.tip.hidden && THUMB.shown === a.dataset.thumb) { THUMB.cur = a; return; }
  if (THUMB.tip) THUMB.tip.hidden = true;
  if (THUMB.cur) THUMB.cur.removeAttribute("aria-describedby");
  THUMB.cur = a;
  THUMB.timer = setTimeout(() => thumbShow(a), 300);
}

(() => {
  const find = t => t && t.closest ? t.closest("[data-thumb]") : null;
  document.addEventListener("mouseover", ev => {
    const a = find(ev.target);
    if (a === THUMB.cur) return;
    if (a) thumbArm(a, ev.clientX, ev.clientY);
    else if (THUMB.cur) thumbHide();
  });
  document.addEventListener("mouseout", ev => { if (!ev.relatedTarget && THUMB.cur) thumbHide(); });  // kursor poza oknem
  document.addEventListener("mousemove", ev => { if (THUMB.cur) { THUMB.x = ev.clientX; THUMB.y = ev.clientY; thumbPlace(); } }, { passive: true });
  // klawiatura: Tab na nazwie pliku pokazuje miniaturę pod nią, Esc chowa
  document.addEventListener("focusin", ev => {
    const a = find(ev.target);
    if (a && a !== THUMB.cur && a.matches(":focus-visible")) { const r = a.getBoundingClientRect(); thumbArm(a, r.left, r.bottom - 12); }
  });
  document.addEventListener("focusout", ev => { if (THUMB.cur && find(ev.target) === THUMB.cur) thumbHide(); });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape" && THUMB.cur) thumbHide(); });
  window.addEventListener("scroll", () => { if (THUMB.cur) thumbHide(); }, { passive: true, capture: true });
  document.addEventListener("pointerdown", () => { if (THUMB.cur) thumbHide(); });
})();
