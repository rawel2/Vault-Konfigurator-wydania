# Konfigurator VAULT – wydania

🇬🇧 [English version](README.md)

> **VAULT to system pojemników firmy [USSA Design](https://www.ussadesign.com/pages/vault).**
> Ten program **nie zawiera plików STL** – trzeba je **kupić u producenta**: https://www.ussadesign.com/pages/vault

Program do konfiguracji wież z pojemników VAULT: lista plików STL z ilościami, elementy niedrukowane, szacunek czasu
i filamentu, płyty 3MF dla drukarki i wizualizacja 3D. Działa lokalnie na Windows, macOS i Linuxie, bez internetu.
Język programu zmienia się u góry strony (Polski, English, Deutsch). To repozytorium zawiera tylko gotowe wydania.

## Instalacja

### Windows

1. Pobierz `instaluj.bat` z [najnowszego wydania](../../releases/latest).
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
Instalator sprawdzi Pythona 3.9+ (na Linuxie zaproponuje instalację menedżerem pakietów, na macOS otworzy python.org),
zapyta o folder instalacji (domyślnie `~/VAULT`), pobierze program i przygotuje numpy. Gdy systemowy Python nie pozwala
doinstalować pakietów (Homebrew, nowe Ubuntu), program tworzy prywatne środowisko `.venv` w swoim folderze; gdy domyślny
Python jest uszkodzony, próbuje innych zainstalowanych wersji. Skrót: `Konfigurator VAULT.command` na pulpicie (macOS)
albo wpis w menu aplikacji (Linux); program uruchamia też `./run.sh` w folderze `konfigurator`.

Folder z plikami STL VAULT wskazuje się później, w programie (okno „Pliki STL systemu VAULT”). Na Linuxie przycisk
„Wybierz folder…” wymaga zenity albo tkintera (`sudo apt install python3-tk`) – bez nich ścieżkę wpisuje się ręcznie.

### Instrukcja i aktualizacje

Pełna instrukcja: **`VAULT_instrukcja_PL.pdf`** w wydaniu. Aktualizacja: przycisk „Aktualizuj” na pasku nad
konfiguratorem albo ponowne uruchomienie instalatora – ustawienia zostają.

## Narzędzia

- **VAULT STL repair** – naprawia za jednym razem błędy siatek całej biblioteki STL tą samą usługą Windows, której
  Bambu Studio używa w „Napraw model”, i zapisuje naprawioną kopię biblioteki (koniec pytań o naprawę przy każdym
  wczytaniu): https://github.com/rawel2/vault-stl-repair (Windows 10/11, Python).

## Projekty społeczności

- **Docker** – obraz od DocBiga, sam pobiera najnowsze wydanie (z niemieckim tłumaczeniem, także od DocBiga):
  https://github.com/DocBigs-Lab/vault-konfigurator-docker
  Serwer nie ma logowania – udostępniaj go tylko w zaufanej sieci (`VAULT_BIND`, `VAULT_HOSTS`).

## Autorzy

- Autorzy programu: **rawel2** i **Claude** (Anthropic).
- Licencja programu: **MIT** ([LICENSE](LICENSE)); nie obejmuje materiałów USSA Design – [NOTICE.md](NOTICE.md).
- System VAULT, projekt, pliki STL i instrukcje PDF: **© USSA Design**.
- Program nieoficjalny, niepowiązany z USSA Design.
- Udostępniane za zgodą USSA Design (październik 2026); USSA Design nie odpowiada za program ani go nie wspiera.
