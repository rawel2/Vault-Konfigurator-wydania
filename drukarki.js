// Obszary druku – wspólne dla konfiguratora (przeglądarka) i druk.py. Wartości z profili Bambu Studio
// (github.com/bambulab/BambuStudio, resources/profiles/BBL/machine/*.json) i danych producentów;
// Bambu Lab H3C – profil z Bambu Studio 02.09 (printable_area 330×320, wysokość 325, bez bed_exclude_area i
// wrapping_exclude_area; jedna głowica z magazynkiem dysz – printer_extruder_id 1, więc cały stół jak H2S; 2026-11-04).
// Bambu Lab A2L – profil Bambu Studio 02.09 (330×320×325, bez stref; 2026-11-04). Anycubic Kobra S1 (250³) i Kobra 3 Max
// (426×420×501; w wersji 1 paski 3 mm przy lewej i prawej krawędzi
// w bed_exclude_area, V2 bez nich) – profile Anycubic Slicer Next (resources/profiles/Anycubic, 2026-11-04).
// Elegoo Centauri Carbon (1 i 2 – te same wymiary) z OrcaSlicer: resources/profiles/Elegoo/machine/ECC*.
// Anycubic Kobra S1 Max – profil Anycubic (350×350×350); Snapmaker U1 – OrcaSlicer (printable_area 270×270,
// przesunięty o 0,5/1 mm – bez znaczenia przy centrowaniu); LightMake L4 – producent: „Max. Usable Print Area”
// Qidi Q2 – profil Qidi Studio (QIDITECH/QIDIStudio, resources/profiles/Q Series): 270×270×256, strefa X 0–11 / Y 0–16
// z przodu po lewej (bed_exclude_area), nazwa drukarki w profilu „Q2 0.4 nozzle” (zgłoszenie nr 6).
// 354×370 mm, wysokość 386 mm (prośba DocBiga, zgłoszenie nr 4; profil L4 w slicerze ma stół 394×394 z miejscem
// na głowice). U1 i L4 mają po 4 głowice – traktowane jak jedna (wspólny obszar).
//   bed     = [szer., gł.] całego stołu (printable_area) – jego środek to punkt, na który slicer centruje import
//   area    = [x0, y0, x1, y1] – obszar, w którym układamy części (H2D/H2C: przyjęte 325×300 na środku stołu)
//   area_max = opcjonalny większy obszar (H2D/H2C: pełna głębokość stołu 320 mm) – tylko dla pojedynczej części,
//             która nie mieści się w area; dostaje własną płytę i ostrzeżenie zamiast „za duża”
//   h       = wysokość druku (mm)
//   exclude = strefy zakazane (bed_exclude_area) – nigdy nie kładziemy tam części
//   wrap    = strefy wykrywania owijania (wrapping_exclude_area) – omijane, gdy się da (błąd tylko przy włączonym wykrywaniu)
//   note    = podpowiedź wyświetlana w konfiguratorze i w plyty.txt
//   nozzle  = left/right: wariant jednej dyszy – w slicerze trzeba przypisać filament do tej dyszy
//   bambu   = projekt Bambu Studio ze wszystkimi płytami (druk.py: zapisz_projekt): model i nazwy profili systemowych
//             (drukarka 0.4, proces 0.20mm Standard, PLA Basic, TPU 95A HF – z resources/profiles/BBL, Bambu Studio 02.08),
//             extruders/extruder_type – dwie dysze; area = obszar układania w projekcie (bez centrowania, H2D/H2C: wspólny
//             zasięg obu dysz 300×300), area_max = duża część na osobnej płycie, filamenty ręcznie na lewą dyszę;
//             forki Bambu Studio: slicer (nazwa), version (ich numeracja), plik (nazwa projektu) – np. Anycubic Slicer Next
//
// Bambu Studio przy imporcie 3MF spoza Bambu przesuwa całą grupę tak, by środek jej bryły otaczającej wypadł
// na środku stołu (Plater.cpp: center_instances_around_point(bed_center)), więc druk.py zapisuje płyty już
// wyśrodkowane. H2D/H2C: przyjęty obszar układania 325×300 mm na środku stołu (zasięg jednej dyszy to 325 mm,
// 300 mm głębokości omija strefę przy tylnej krawędzi). Po imporcie część może wejść w pas jednej dyszy –
// wtedy wystarczy przesunąć grupę o kilkanaście mm w slicerze.
window.VAULT_PRINTERS = {
  "h2s":     { "name": "Bambu Lab H2S", "bed": [340, 320], "area": [0, 0, 340, 320], "h": 340, "exclude": [], "wrap": [[172.3, 302, 232.5, 322]], "bambu": {"model": "Bambu Lab H2S", "printer": "Bambu Lab H2S 0.4 nozzle", "process": "0.20mm Standard @BBL H2S", "pla": "Bambu PLA Basic @BBL H2S", "tpu": "Bambu TPU 95A HF @BBL H2S"} },
  "h2d":     { "note": "Obszar 325×300 to zasięg jednej dyszy – szeroka płyta może po imporcie zachodzić na pas jednej dyszy; wtedy przesuń całą grupę w bok o kilkanaście mm albo przypisz filament do odpowiedniej dyszy.", "name": "Bambu Lab H2D", "bed": [350, 320], "area": [12.5, 10, 337.5, 310], "area_max": [12.5, 0, 337.5, 320], "h": 320, "exclude": [], "wrap": [[145, 310, 256, 326]], "bambu": {"model": "Bambu Lab H2D", "printer": "Bambu Lab H2D 0.4 nozzle", "process": "0.20mm Standard @BBL H2D", "pla": "Bambu PLA Basic @BBL H2D", "tpu": "Bambu TPU 95A HF @BBL H2D 0.4 nozzle", "extruder_type": ["Direct Drive", "Direct Drive"], "extruders": ["0x0,325x0,325x320,0x320", "25x0,350x0,350x320,25x320"], "area": [25, 10, 325, 310], "area_max": [0, 0, 325, 320]} },
  "h2c":     { "note": "Obszar 325×300 to zasięg jednej dyszy – szeroka płyta może po imporcie zachodzić na pas jednej dyszy; wtedy przesuń całą grupę w bok o kilkanaście mm albo przypisz filament do odpowiedniej dyszy.", "name": "Bambu Lab H2C", "bed": [330, 320], "area": [2.5, 10, 327.5, 310], "area_max": [2.5, 0, 327.5, 320], "h": 320, "exclude": [], "wrap": [[145, 310, 251, 326]], "bambu": {"model": "Bambu Lab H2C", "printer": "Bambu Lab H2C 0.4 nozzle", "process": "0.20mm Standard @BBL H2C", "pla": "Bambu PLA Basic @BBL H2C", "tpu": "Bambu TPU 95A HF @BBL H2C 0.4 nozzle", "extruder_type": ["Direct Drive", "Direct Drive"], "extruders": ["0x0,325x0,325x320,0x320", "25x0,330x0,330x320,25x320"], "area": [25, 10, 325, 310], "area_max": [0, 0, 325, 320]} },
  "h3c":     { "name": "Bambu Lab H3C", "bed": [330, 320], "area": [0, 0, 330, 320], "h": 325, "exclude": [], "wrap": [], "bambu": {"model": "Bambu Lab H3C", "printer": "Bambu Lab H3C 0.4 nozzle", "process": "0.20mm Standard @BBL H3C", "pla": "Bambu PLA Basic @BBL H3C", "tpu": "Bambu TPU 95A HF @BBL H3C"} },
  "a2l":     { "name": "Bambu Lab A2L", "bed": [330, 320], "area": [0, 0, 330, 320], "h": 325, "exclude": [], "wrap": [], "bambu": {"model": "Bambu Lab A2L", "printer": "Bambu Lab A2L 0.4 nozzle", "process": "0.20mm Standard @BBL A2L", "pla": "Bambu PLA Basic @BBL A2L 0.4 nozzle", "tpu": "Bambu TPU 95A HF @BBL A2L"} },
  "x2d":     { "name": "Bambu Lab X2D – obie dysze", "bed": [256, 256], "area": [20.5, 0, 256, 256], "h": 256, "exclude": [], "wrap": [], "bambu": {"model": "Bambu Lab X2D", "printer": "Bambu Lab X2D 0.4 nozzle", "process": "0.20mm Standard @BBL X2D", "pla": "Bambu PLA Basic @BBL X2D 0.4 nozzle", "tpu": "Bambu TPU 95A HF @BBL X2D 0.4 nozzle", "extruder_type": ["Direct Drive", "Bowden"], "extruders": ["0x0,256x0,256x256,0x256", "20.5x0,256x0,256x256,20.5x256"], "area": [20.5, 0, 256, 256]} },
  "x2d_l":   { "nozzle": "left", "name": "Bambu Lab X2D – tylko lewa dysza", "bed": [256, 256], "area": [0, 0, 256, 256], "h": 261, "exclude": [], "wrap": [], "bambu": {"model": "Bambu Lab X2D", "printer": "Bambu Lab X2D 0.4 nozzle", "process": "0.20mm Standard @BBL X2D", "pla": "Bambu PLA Basic @BBL X2D 0.4 nozzle", "tpu": "Bambu TPU 95A HF @BBL X2D 0.4 nozzle", "extruder_type": ["Direct Drive", "Bowden"], "extruders": ["0x0,256x0,256x256,0x256", "20.5x0,256x0,256x256,20.5x256"]} },
  "x1":      { "name": "Bambu Lab X1 / P1", "bed": [256, 256], "area": [0, 0, 256, 256], "h": 250, "exclude": [[0, 0, 18, 28]], "wrap": [], "bambu": {"model": "Bambu Lab X1 Carbon", "printer": "Bambu Lab X1 Carbon 0.4 nozzle", "process": "0.20mm Standard @BBL X1C", "pla": "Bambu PLA Basic @BBL X1C", "tpu": "Bambu TPU 95A HF @BBL X1C"} },
  "p2s":     { "name": "Bambu Lab P2S", "bed": [256, 256], "area": [0, 0, 256, 256], "h": 256, "exclude": [], "wrap": [[153, 235, 216, 256]], "bambu": {"model": "Bambu Lab P2S", "printer": "Bambu Lab P2S 0.4 nozzle", "process": "0.20mm Standard @BBL P2S", "pla": "Bambu PLA Basic @BBL P2S", "tpu": "Bambu TPU 95A HF @BBL P2S"} },
  "a1":      { "name": "Bambu Lab A1", "bed": [256, 256], "area": [0, 0, 256, 256], "h": 256, "exclude": [], "wrap": [], "bambu": {"model": "Bambu Lab A1", "printer": "Bambu Lab A1 0.4 nozzle", "process": "0.20mm Standard @BBL A1", "pla": "Bambu PLA Basic @BBL A1", "tpu": "Bambu TPU 95A HF @BBL A1"} },
  "a1mini":  { "name": "Bambu Lab A1 mini", "bed": [180, 180], "area": [0, 0, 180, 180], "h": 180, "exclude": [], "wrap": [], "bambu": {"model": "Bambu Lab A1 mini", "printer": "Bambu Lab A1 mini 0.4 nozzle", "process": "0.20mm Standard @BBL A1M", "pla": "Bambu PLA Basic @BBL A1M", "tpu": "Bambu TPU 95A HF @BBL A1M"} },
  "coreone": { "name": "Prusa Core One", "bed": [250, 220], "area": [0, 0, 250, 220], "h": 270, "exclude": [], "wrap": [] },
  "mk4":     { "name": "Prusa MK4", "bed": [250, 210], "area": [0, 0, 250, 210], "h": 220, "exclude": [], "wrap": [] },
  "ecc":     { "name": "Elegoo Centauri Carbon / Carbon 2", "bed": [256, 256], "area": [0, 0, 256, 256], "h": 256, "exclude": [[246, 0, 256, 20]], "wrap": [] },
  "s1max":   { "name": "Anycubic Kobra S1 Max", "bed": [350, 350], "area": [0, 0, 350, 350], "h": 350, "exclude": [], "wrap": [], "bambu": {"slicer": "Anycubic Slicer Next", "version": "2.0.0.0", "plik": "projekt_anycubic", "model": "Anycubic Kobra S1 Max", "printer": "Anycubic Kobra S1 Max 0.4 nozzle", "process": "0.20mm Standard @Anycubic Kobra S1 Max 0.4 nozzle", "pla": "Anycubic PLA @Anycubic Kobra S1 Max 0.4 nozzle", "tpu": "Anycubic TPU 95A @Anycubic Kobra S1 Max 0.4 nozzle"} },
  "s1":      { "name": "Anycubic Kobra S1", "bed": [250, 250], "area": [0, 0, 250, 250], "h": 250, "exclude": [], "wrap": [], "bambu": {"slicer": "Anycubic Slicer Next", "version": "2.0.0.0", "plik": "projekt_anycubic", "model": "Anycubic Kobra S1", "printer": "Anycubic Kobra S1 0.4 nozzle", "process": "0.20mm Standard @Anycubic Kobra S1 0.4 nozzle", "pla": "Anycubic PLA @Anycubic Kobra S1 0.4 nozzle", "tpu": "Anycubic TPU @Anycubic Kobra S1 0.4 nozzle"} },
  "k3max":   { "name": "Anycubic Kobra 3 Max", "bed": [426, 420], "area": [3, 0, 423, 420], "h": 501, "exclude": [[0, 0, 3, 420], [423, 0, 426, 420]], "wrap": [], "bambu": {"slicer": "Anycubic Slicer Next", "version": "2.0.0.0", "plik": "projekt_anycubic", "model": "Anycubic Kobra 3 Max", "printer": "Anycubic Kobra 3 Max 0.4 nozzle", "process": "0.20mm Standard @Anycubic Kobra 3 Max 0.4 nozzle", "pla": "Anycubic PLA @Anycubic Kobra 3 Max 0.4 nozzle", "tpu": "Anycubic TPU @Anycubic Kobra 3 Max 0.4 nozzle"} },
  "k3maxv2": { "name": "Anycubic Kobra 3 Max V2", "bed": [426, 420], "area": [0, 0, 426, 420], "h": 501, "exclude": [], "wrap": [], "bambu": {"slicer": "Anycubic Slicer Next", "version": "2.0.0.0", "plik": "projekt_anycubic", "model": "Anycubic Kobra 3 Max V2", "printer": "Anycubic Kobra 3 Max V2 0.4 nozzle", "process": "0.20mm Standard @Anycubic Kobra 3 Max V2 0.4 nozzle", "pla": "Anycubic PLA @Anycubic Kobra 3 Max V2 0.4 nozzle", "tpu": "Anycubic TPU @Anycubic Kobra 3 Max V2 0.4 nozzle"} },
  "q2":      { "name": "Qidi Q2", "bed": [270, 270], "area": [0, 0, 270, 270], "h": 256, "exclude": [[0, 0, 11, 16]], "wrap": [], "bambu": {"slicer": "Qidi Studio", "version": "02.00.00.00", "plik": "projekt_qidi", "model": "Q2", "printer": "Q2 0.4 nozzle", "process": "0.20mm Standard @Q2", "pla": "QIDI PLA Basic @Qidi Q2 0.4 nozzle", "tpu": "QIDI TPU 95A-HF @Qidi Q2 0.4 nozzle"} },
  "u1":      { "name": "Snapmaker U1", "bed": [270, 270], "area": [0, 0, 270, 270], "h": 270, "exclude": [], "wrap": [] },
  "l4":      { "name": "LightMake L4", "bed": [354, 370], "area": [0, 0, 354, 370], "h": 386, "exclude": [], "wrap": [] }
};
