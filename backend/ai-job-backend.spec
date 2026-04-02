# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec file for AI Job Assistant Backend
# Usage: pyinstaller ai-job-backend.spec

import os

block_cipher = None

a = Analysis(
    ['app/main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('.env.example', '.'),   # Bundle .env.example for first-run bootstrap
    ],
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'app.routers.profile',
        'app.routers.jobs',
        'app.routers.cover_letters',
        'app.routers.tracker',
        'app.routers.job_boards',
        'app.routers.apply',
        'app.config',
        'app.database',
        'pydantic_settings',
        'sqlalchemy',
        'aiohttp',
        'beautifulsoup4',
        'reportlab',
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
    name='ai-job-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,   # Keep console for logging; Electron hides it anyway
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='ai-job-backend',
)
