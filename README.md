# Konfigurator VAULT – wydania / releases

> **VAULT to system pojemników firmy [USSA Design](https://www.ussadesign.com/pages/vault).**
> Ten program **nie zawiera plików STL** – trzeba je **kupić u producenta**: https://www.ussadesign.com/pages/vault
>
> **VAULT is a storage system by [USSA Design](https://www.ussadesign.com/pages/vault).**
> This program **does not include the STL files** – you have to **buy them from the maker**: https://www.ussadesign.com/pages/vault

Program do konfiguracji wież z pojemników VAULT: lista plików STL z ilościami, elementy niedrukowane, szacunek czasu
i filamentu, płyty 3MF dla drukarki i wizualizacja 3D. Działa lokalnie na Windows, macOS i Linuxie, bez internetu.
To repozytorium zawiera tylko gotowe wydania.

## Instalacja

### Windows

1. Pobierz `instaluj.bat` z [najnowszego wydania](../../releases/latest) (`install.bat` to wersja angielska).
2. Uruchom go. Jeśli Windows pokaże „System Windows ochronił ten komputer”, kliknij *Więcej informacji* → *Uruchom mimo to*.
   Instalator sprawdzi Pythona (w razie braku zaproponuje instalację), pobierze program, zainstaluje numpy,
   utworzy skrót „Konfigurator VAULT” na pulpicie i uruchomi konfigurator.
3. W oknie „Pliki STL systemu VAULT” wskaż folder z rozpakowanymi plikami VAULT.

### macOS i Linux

W Terminalu wpisz jedno polecenie:

```sh
curl -fsSL https://github.com/rawel2/Vault-Konfigurator-wydania/releases/latest/download/install.sh | bash
```

Możesz też pobrać `install.sh` z [najnowszego wydania](../../releases/latest) i uruchomić `bash install.sh`.
Komunikaty są po polsku albo po angielsku według języka systemu. Instalator sprawdzi Pythona 3.9+ (na Linuxie
zaproponuje instalację menedżerem pakietów, na macOS otworzy python.org), zapyta o folder (domyślnie `~/VAULT`),
pobierze program i przygotuje numpy. Gdy systemowy Python nie pozwala doinstalować pakietów (Homebrew, nowe Ubuntu),
program tworzy prywatne środowisko `.venv` w swoim folderze. Skrót: `Konfigurator VAULT.command` na pulpicie (macOS)
albo wpis w menu aplikacji (Linux); program uruchamia też `./run.sh` w folderze `konfigurator`.
Na Linuxie okno wyboru folderu wymaga zenity albo tkintera (`sudo apt install python3-tk`) – bez nich ścieżkę wpisuje się ręcznie.

Pełna instrukcja: **`VAULT_instrukcja_PL.pdf`** w wydaniu. Aktualizacja: uruchom instalator ponownie – ustawienia zostają.

---

A configurator for VAULT storage towers: STL file list with quantities, hardware, print time and filament estimate,
3MF plates and a 3D view. Runs locally on Windows, macOS and Linux, offline. This repository holds only the releases.

## Installation

### Windows

1. Download `install.bat` (English installer) from the [latest release](../../releases/latest).
2. Run it. If Windows shows “Windows protected your PC”, click *More info* → *Run anyway*.
   It checks Python (offers to install it), downloads the program, installs numpy, creates the
   "VAULT Configurator" desktop shortcut and starts the configurator.
3. In the "VAULT STL files" window, point to the folder with the unpacked VAULT files.

### macOS and Linux

Type one command in Terminal:

```sh
curl -fsSL https://github.com/rawel2/Vault-Konfigurator-wydania/releases/latest/download/install.sh | bash
```

Or download `install.sh` from the [latest release](../../releases/latest) and run `bash install.sh`.
Messages are in Polish or English depending on the system language. The installer checks Python 3.9+ (on Linux it
offers to install it with the package manager, on macOS it opens python.org), asks for a folder (default `~/VAULT`),
downloads the program and prepares numpy. If the system Python does not allow installing packages (Homebrew, recent
Ubuntu), the program creates a private `.venv` environment in its folder. Shortcut: `VAULT Configurator.command` on the
desktop (macOS) or an entry in the applications menu (Linux); you can also start it with `./run.sh` in the
`konfigurator` folder. On Linux the folder picker needs zenity or tkinter (`sudo apt install python3-tk`); without
them, type the folder path.

Full manual: **`VAULT_manual_EN.pdf`** in the release. Update: run the installer again – your settings are kept.

## Narzędzia / Tools

- **VAULT STL repair** – naprawia za jednym razem błędy siatek całej biblioteki STL tą samą usługą Windows, której
  Bambu Studio używa w „Napraw model”, i zapisuje naprawioną kopię biblioteki (koniec pytań o naprawę przy każdym wczytaniu)
  / repairs the mesh errors of the whole STL library in one go with the same Windows service Bambu Studio uses for
  "Repair model" and writes a repaired copy of the library (no more repair prompts on every load):
  https://github.com/rawel2/vault-stl-repair (Windows 10/11, Python).

## Projekty społeczności / Community projects

- **Docker** – obraz od DocBiga, sam pobiera najnowsze wydanie (z niemieckim tłumaczeniem, także od DocBiga)
  / image by DocBig that pulls the latest release by itself (including the German translation, also by DocBig):
  https://github.com/DocBigs-Lab/vault-konfigurator-docker
  Serwer nie ma logowania – udostępniaj go tylko w zaufanej sieci (`VAULT_BIND`, `VAULT_HOSTS`).
  / The server has no login – share it only on a trusted network (`VAULT_BIND`, `VAULT_HOSTS`).

## Autorzy / Authors

- Autorzy programu / Program authors: **rawel2** i/and **Claude** (Anthropic).
- Licencja programu / Program licence: **MIT** ([LICENSE](LICENSE)); nie obejmuje materiałów USSA Design
  / does not cover USSA Design materials – [NOTICE.md](NOTICE.md).
- System VAULT, projekt, pliki STL i instrukcje PDF / design, STL files and PDF manuals: **© USSA Design**.
- Program nieoficjalny, niepowiązany z USSA Design. / Unofficial tool, not affiliated with USSA Design.
- Udostępniane za zgodą USSA Design (październik 2026); USSA Design nie odpowiada za program ani go nie wspiera.
  / Shared with the permission of USSA Design (October 2026); USSA Design is not responsible for the program and does not support it.
