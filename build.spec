# build.spec — PyInstaller para empaquetar VTA como ejecutable (.exe / .app)
#
# USO:
#   pip install pyinstaller
#   pyinstaller build.spec
#
# El ejecutable queda en:  dist/VTA/VTA.exe  (Windows)
#                          dist/VTA/VTA       (macOS/Linux)

import sys
import os

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('assets',          'assets'),
        ('vehicle_photos',  'vehicle_photos'),
        ('exports',         'exports'),
    ],
    hiddenimports=[
        'customtkinter',
        'PIL',
        'PIL._tkinter_finder',
        'matplotlib',
        'matplotlib.backends.backend_tkagg',
        'numpy',
        'openpyxl',
        'sqlite3',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='VTA',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,          # Sin ventana de consola
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    # icon='assets/icon.ico',   # Descomenta y agrega un .ico para Windows
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='VTA',
)
