# VAULT Configurator – releases

🇵🇱 [Wersja polska](README.pl.md)

> **VAULT is a storage system by [USSA Design](https://www.ussadesign.com/pages/vault).**
> This program **does not include the STL files** – you have to **buy them from the maker**: https://www.ussadesign.com/pages/vault

A configurator for VAULT storage towers: STL file list with quantities, hardware, print time and filament estimate,
3MF plates and a 3D view. Runs locally on Windows, macOS and Linux, offline. The program language can be switched
at the top of the page (English, Polski, Deutsch). This repository holds only the releases.

## Installation

### Windows

1. Download `install.bat` from the [latest release](../../releases/latest).
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
The installer checks Python 3.9+ (on Linux it offers to install it with the package manager, on macOS it opens
python.org), asks for the install folder (default `~/VAULT`), downloads the program and prepares numpy. If the system
Python does not allow installing packages (Homebrew, recent Ubuntu), the program creates a private `.venv` environment
in its folder; if the default Python is broken, it tries the other installed versions. Shortcut:
`VAULT Configurator.command` on the desktop (macOS) or an entry in the applications menu (Linux); you can also start
it with `./run.sh` in the `konfigurator` folder.

The folder with the VAULT STL files is chosen later, in the program ("VAULT STL files" window). On Linux the
"Choose folder…" button needs zenity or tkinter (`sudo apt install python3-tk`); without them, type the folder path.

### Manual and updates

Full manual: **`VAULT_manual_EN.pdf`** in the release. To update, click "Update" in the bar above the configurator,
or run the installer again – your settings are kept.

## Tools

- **VAULT STL repair** – repairs the mesh errors of the whole STL library in one go with the same Windows service
  Bambu Studio uses for "Repair model" and writes a repaired copy of the library (no more repair prompts on every load):
  https://github.com/rawel2/vault-stl-repair (Windows 10/11, Python).

## Community projects

- **Docker** – image by DocBig that pulls the latest release by itself (including the German translation, also by DocBig):
  https://github.com/DocBigs-Lab/vault-konfigurator-docker
  The server has no login – share it only on a trusted network (`VAULT_BIND`, `VAULT_HOSTS`).

## Authors

- Program authors: **rawel2** and **Claude** (Anthropic).
- Program licence: **MIT** ([LICENSE](LICENSE)); it does not cover USSA Design materials – [NOTICE.md](NOTICE.md).
- VAULT system, design, STL files and PDF manuals: **© USSA Design**.
- Unofficial tool, not affiliated with USSA Design.
- Shared with the permission of USSA Design (October 2026); USSA Design is not responsible for the program and does not support it.
