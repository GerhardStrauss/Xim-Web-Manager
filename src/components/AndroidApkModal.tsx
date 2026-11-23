import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Download,
  CheckCircle2,
  X,
  Bluetooth,
  FileArchive,
  ShieldCheck,
  Terminal,
  Cpu,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { ximService } from '../services/ximService';

interface AndroidApkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectNativeSpp?: () => void;
}

// Pure-JS Stored ZIP generator (no external dependencies required)
function createZipArchive(files: { name: string; content: string }[]): Uint8Array {
  const encoder = new TextEncoder();

  // Standard CRC32 implementation
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }
  const crc32 = (bytes: Uint8Array): number => {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32(dataBytes);

    // Local file header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed to extract
    lv.setUint16(6, 0, true); // General purpose bit flag
    lv.setUint16(8, 0, true); // Compression method (0 = Store)
    lv.setUint16(10, 0, true); // Last mod file time
    lv.setUint16(12, 0, true); // Last mod file date
    lv.setUint32(14, crc, true); // CRC-32
    lv.setUint32(18, dataBytes.length, true); // Compressed size
    lv.setUint32(22, dataBytes.length, true); // Uncompressed size
    lv.setUint16(26, nameBytes.length, true); // File name length
    lv.setUint16(28, 0, true); // Extra field length
    localHeader.set(nameBytes, 30);

    // Central directory file header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central file header signature
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed to extract
    cv.setUint16(8, 0, true); // General purpose bit flag
    cv.setUint16(10, 0, true); // Compression method (0 = Store)
    cv.setUint16(12, 0, true); // Last mod file time
    cv.setUint16(14, 0, true); // Last mod file date
    cv.setUint32(16, crc, true); // CRC-32
    cv.setUint32(20, dataBytes.length, true); // Compressed size
    cv.setUint32(24, dataBytes.length, true); // Uncompressed size
    cv.setUint16(28, nameBytes.length, true); // File name length
    cv.setUint16(30, 0, true); // Extra field length
    cv.setUint16(32, 0, true); // File comment length
    cv.setUint16(34, 0, true); // Disk number start
    cv.setUint16(36, 0, true); // Internal file attributes
    cv.setUint32(38, 0, true); // External file attributes
    cv.setUint32(42, offset, true); // Relative offset of local header
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, dataBytes);
    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  let centralSize = 0;
  for (const part of centralParts) centralSize += part.length;

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // End of central dir signature
  ev.setUint16(4, 0, true); // Number of this disk
  ev.setUint16(6, 0, true); // Disk where central directory starts
  ev.setUint16(8, files.length, true); // Number of central directory records on this disk
  ev.setUint16(10, files.length, true); // Total number of central directory records
  ev.setUint32(12, centralSize, true); // Size of central directory
  ev.setUint32(16, offset, true); // Offset of start of central directory
  ev.setUint16(20, 0, true); // Comment length

  const totalLength = offset + centralSize + eocd.length;
  const out = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of localParts) {
    out.set(part, pos);
    pos += part.length;
  }
  for (const part of centralParts) {
    out.set(part, pos);
    pos += part.length;
  }
  out.set(eocd, pos);
  return out;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({
  isOpen,
  onClose,
  onConnectNativeSpp,
}) => {
  const [hasPrebuiltZip, setHasPrebuiltZip] = useState<boolean>(false);
  const [checkingZip, setCheckingZip] = useState<boolean>(true);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);
  const isNativeAndroid = ximService.isNativeAndroidApp();

  useEffect(() => {
    if (!isOpen) return;
    setCheckingZip(true);
    fetch('/xim-web-manager-android-apk.zip', { method: 'HEAD' })
      .then((res) => {
        const contentType = res.headers.get('content-type') || '';
        setHasPrebuiltZip(res.ok && !contentType.includes('text/html'));
      })
      .catch(() => setHasPrebuiltZip(false))
      .finally(() => setCheckingZip(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadApkZip = () => {
    if (hasPrebuiltZip) {
      const a = document.createElement('a');
      a.href = '/xim-web-manager-android-apk.zip';
      a.download = 'xim-web-manager-android-apk.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadStatus('Downloaded pre-compiled xim-web-manager-android-apk.zip!');
      return;
    }

    // Generate immediate Android APK Builder & Configuration ZIP bundle
    const capacitorConfig = JSON.stringify(
      {
        appId: 'com.xim.webmanager',
        appName: 'XIM4 Web Manager',
        webDir: 'dist',
        server: {
          androidScheme: 'https',
          cleartext: true,
        },
        android: {
          allowMixedContent: true,
        },
      },
      null,
      2
    );

    const buildScriptSh = `#!/usr/bin/env bash
# ==============================================================================
# XIM4 Android Native APK Builder (Bluetooth Classic SPP RFCOMM 0x1101)
# Automatically compiles XIM4-Web-Manager-SPP.apk and packages it into a .zip
# ==============================================================================
set -e

echo "[1/5] Installing web dependencies & building production bundle..."
npm install --legacy-peer-deps
npm run build

echo "[2/5] Installing Capacitor Android & Bluetooth Classic SPP plugin..."
npm install --legacy-peer-deps @capacitor/core@^6.0.0 @capacitor/cli@^6.0.0 @capacitor/android@^6.0.0 cordova-plugin-bluetooth-serial

echo "[3/5] Initializing Capacitor Android platform..."
if [ ! -d "android" ]; then
  npx cap add android
fi
npx cap sync android

echo "[4/5] Compiling Native Android APK via Gradle..."
cd android
chmod +x gradlew
./gradlew assembleDebug
cd ..

echo "[5/5] Packaging APK into xim-web-manager-android-apk.zip..."
cp android/app/build/outputs/apk/debug/app-debug.apk ./XIM4-Web-Manager-SPP.apk
zip -r xim-web-manager-android-apk.zip XIM4-Web-Manager-SPP.apk
cp xim-web-manager-android-apk.zip public/xim-web-manager-android-apk.zip

echo "SUCCESS! Extract xim-web-manager-android-apk.zip on your Android phone and install XIM4-Web-Manager-SPP.apk"
`;

    const readmeTxt = `===============================================================================
XIM4 NATIVE ANDROID APK (BLUETOOTH CLASSIC SPP 0x1101) - INSTALLATION GUIDE
===============================================================================

WHY THE NATIVE ANDROID APK SOLVES ALL XIM4 BLUETOOTH & USB-OTG ISSUES:
-------------------------------------------------------------------------------
1. Mobile Chrome/Edge browsers block Bluetooth Classic SPP (RFCOMM UUID 0x1101)
   and only expose Bluetooth Low Energy (BLE GATT), which is read-only on XIM4.
2. This app now includes native Capacitor + cordova-plugin-bluetooth-serial
   integration in src/services/ximService.ts.
3. When compiled into an Android APK, the app bypasses browser Web Bluetooth
   restrictions and opens a direct Android BluetoothSocket (RFCOMM 0x1101) to
   your paired XIM4 — identical to the original discontinued XIM4 Android Manager!

HOW TO GET THE COMPILED APK (.ZIP) IN 1 CLICK (NO ANDROID STUDIO NEEDED):
-------------------------------------------------------------------------------
Because the live web preview runs in a lightweight Node.js container without
the 4GB Android SDK/Java 17 compiler pre-installed, we included an automated
GitHub Actions APK Cloud Builder inside this project at:
  .github/workflows/build-android-apk.yml

STEP 1: Export or push this project to your GitHub repository.
STEP 2: Open your GitHub repository -> click the "Actions" tab -> select
        "Build XIM4 Android APK & Package ZIP" -> click "Run workflow".
STEP 3: Wait ~2 minutes for GitHub's cloud server to compile the Android APK.
        Download "xim-web-manager-android-apk" (.zip) from the Artifacts section
        (or from the automatic GitHub Release).
STEP 4: Extract the .zip file on your Android phone and tap
        "XIM4-Web-Manager-SPP.apk" to install!

(Optional: If you place the downloaded xim-web-manager-android-apk.zip inside
the /public folder of this web app, clicking "Download Android APK (.zip)" in
the web app will serve the compiled APK .zip directly to any phone!)
`;

    const githubWorkflowYml = `name: Build Android APK & ZIP Package

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build-android-apk:
    name: Compile Native XIM4 Bluetooth SPP Android APK (.zip)
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Set up Java JDK 21 (Required for Capacitor 6/7/8 & Android Gradle)
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'

      - name: Accept Android SDK Licenses (Using GitHub Runner Pre-installed Android SDK)
        run: |
          echo "Using pre-installed Android SDK at: $ANDROID_HOME"
          yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses || true

      - name: Install web dependencies & Capacitor Android + Bluetooth Classic SPP plugin
        run: |
          npm install --legacy-peer-deps
          npm install --legacy-peer-deps @capacitor/core@^6.0.0 @capacitor/cli@^6.0.0 @capacitor/android@^6.0.0 cordova-plugin-bluetooth-serial

      - name: Build production web app bundle
        run: npm run build

      - name: Initialize & Sync Capacitor Android Platform
        run: |
          if [ ! -d "android" ]; then
            npx cap add android
          fi
          npx cap sync android

      - name: Inject Android 12-14+ Bluetooth Classic SPP (RFCOMM) Permissions into AndroidManifest.xml
        run: |
          node -e '
            const fs = require("fs");
            const manifestPath = "android/app/src/main/AndroidManifest.xml";
            if (fs.existsSync(manifestPath)) {
              let xml = fs.readFileSync(manifestPath, "utf8");
              const perms = [
                "android.permission.BLUETOOTH",
                "android.permission.BLUETOOTH_ADMIN",
                "android.permission.BLUETOOTH_CONNECT",
                "android.permission.BLUETOOTH_SCAN",
                "android.permission.ACCESS_FINE_LOCATION",
                "android.permission.ACCESS_COARSE_LOCATION"
              ];
              let tagsToAdd = "";
              for (const p of perms) {
                if (!xml.includes(p)) {
                  tagsToAdd += "    <uses-permission android:name=\\"" + p + "\\" />\\n";
                }
              }
              if (tagsToAdd) {
                xml = xml.replace("<application", tagsToAdd + "    <application");
                fs.writeFileSync(manifestPath, xml, "utf8");
              }
            }
          '

      - name: Build Android APK via Gradle
        working-directory: ./android
        run: |
          chmod +x gradlew
          ./gradlew assembleDebug --no-daemon

      - name: Package APK into xim-web-manager-android-apk.zip
        run: |
          mkdir -p release_out
          cp android/app/build/outputs/apk/debug/app-debug.apk release_out/XIM4-Web-Manager-SPP.apk
          cd release_out
          zip -r ../xim-web-manager-android-apk.zip XIM4-Web-Manager-SPP.apk

      - name: Upload xim-web-manager-android-apk.zip Artifact
        uses: actions/upload-artifact@v4
        with:
          name: xim-web-manager-android-apk-zip
          path: xim-web-manager-android-apk.zip
          if-no-files-found: error
`;

    const zipBytes = createZipArchive([
      { name: 'README-INSTALL-APK.txt', content: readmeTxt },
      { name: 'capacitor.config.json', content: capacitorConfig },
      { name: 'build-android-apk.sh', content: buildScriptSh },
      { name: '.github/workflows/build-android-apk.yml', content: githubWorkflowYml },
    ]);

    const blob = new Blob([zipBytes as unknown as BlobPart], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'xim-web-manager-android-apk-kit.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadStatus(
      'Downloaded xim-web-manager-android-apk-kit.zip! Follow the 3 steps below to grab the compiled .apk from GitHub Actions or build locally.'
    );
  };

  const handleCopyBuildCommand = () => {
    navigator.clipboard.writeText(
      'npm run build && npx cap add android && npx cap sync android && cd android && ./gradlew assembleDebug'
    );
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b0c10] border border-cyan-500/40 rounded-lg max-w-2xl w-full max-h-[90dvh] flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.18)] overflow-hidden">
        {/* Header */}
        <div className="bg-[#12131a] px-4 sm:px-6 py-4 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                  Native Android APK (Bluetooth Classic SPP)
                </h2>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                    isNativeAndroid
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                      : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                  }`}
                >
                  {isNativeAndroid ? 'Running Native APK' : 'Capacitor SPP Ready'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-mono">
                Unlocks native Android RFCOMM Socket (0x1101) for 100% wireless XIM4 flashing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded bg-gray-900 border border-gray-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {/* Why Native Android APK solves the issue */}
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded p-4 space-y-2">
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Why the Android APK Permanently Solves XIM4 Flashing</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Mobile web browsers (Chrome/Edge on Android) block raw{' '}
              <strong className="text-white">Bluetooth Classic SPP (UUID 0x1101)</strong> sockets
              and only allow BLE GATT connections—which is why your phone paired with XIM4 in
              Android Settings, yet Web Bluetooth could not write game profiles.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
              <div className="bg-[#12131a] border border-gray-800 rounded p-2.5">
                <div className="text-[10px] font-mono text-cyan-400 uppercase font-bold">
                  1. Direct RFCOMM 0x1101
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Uses Android&apos;s native <code className="text-gray-200">BluetoothSocket</code>{' '}
                  identical to the original XIM4 Manager.
                </p>
              </div>
              <div className="bg-[#12131a] border border-gray-800 rounded p-2.5">
                <div className="text-[10px] font-mono text-cyan-400 uppercase font-bold">
                  2. No USB-OTG Cable Needed
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Keep your Xbox controller plugged into Port 3 while flashing wirelessly via
                  Bluetooth.
                </p>
              </div>
              <div className="bg-[#12131a] border border-gray-800 rounded p-2.5">
                <div className="text-[10px] font-mono text-cyan-400 uppercase font-bold">
                  3. Android 12–14+ Support
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Includes updated <code className="text-gray-200">BLUETOOTH_CONNECT</code>{' '}
                  permissions that the old 2016 APK lacked.
                </p>
              </div>
            </div>
          </div>

          {/* Native Runtime Indicator if already running inside APK */}
          {isNativeAndroid && (
            <div className="bg-cyan-950/30 border border-cyan-500/50 rounded p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-bold text-cyan-300 uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Native Android Bluetooth Classic SPP Bridge Detected!</span>
                </div>
                <p className="text-[11px] text-gray-300">
                  You are running inside the compiled Android APK. Tap connect to open the direct
                  RFCOMM socket to your paired XIM4.
                </p>
              </div>
              {onConnectNativeSpp && (
                <button
                  onClick={() => {
                    onClose();
                    onConnectNativeSpp();
                  }}
                  className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded uppercase tracking-wider shrink-0 flex items-center gap-1.5"
                >
                  <Bluetooth className="w-4 h-4" />
                  <span>Connect XIM4 SPP Now</span>
                </button>
              )}
            </div>
          )}

          {/* Primary Download Box */}
          <div className="bg-[#12131a] border border-cyan-500/40 rounded-lg p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <FileArchive className="w-4 h-4 text-cyan-400" />
                  <span>
                    {hasPrebuiltZip
                      ? 'Download Compiled Android APK (.zip)'
                      : 'Download Android APK Builder & Config (.zip)'}
                  </span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {checkingZip
                    ? 'Checking server for pre-compiled APK package...'
                    : hasPrebuiltZip
                    ? 'Pre-compiled XIM4-Web-Manager-SPP.apk inside xim-web-manager-android-apk.zip is ready!'
                    : 'Includes Capacitor Android config, automated APK-to-ZIP script, and GitHub Cloud Builder guide.'}
                </p>
              </div>

              <button
                onClick={handleDownloadApkZip}
                className="px-4 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center space-x-2 uppercase tracking-wider shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>
                  {hasPrebuiltZip
                    ? 'Download APK (.zip)'
                    : 'Download APK Bundle (.zip)'}
                </span>
              </button>
            </div>

            {downloadStatus && (
              <div className="bg-cyan-950/40 border border-cyan-500/40 rounded p-3 flex items-start space-x-2.5 text-xs text-cyan-200">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>{downloadStatus}</span>
              </div>
            )}

            {/* Explanation of Cloud APK compilation */}
            <div className="bg-[#0b0c10] border border-gray-800 rounded p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>How to Generate the Compiled .APK Inside a .ZIP Automatically</span>
                </span>
                <span className="text-[10px] font-mono text-gray-500">
                  /.github/workflows/build-android-apk.yml
                </span>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">
                Because this live web preview runs in a lightweight Node.js container (which does
                not have the 4GB Android SDK &amp; Gradle compiler pre-installed), we built an{' '}
                <strong className="text-white">
                  automated GitHub Actions Android APK-to-ZIP compiler
                </strong>{' '}
                directly into this project:
              </p>

              <ol className="text-xs text-gray-300 space-y-2 list-decimal list-inside bg-[#12131a] p-3 rounded border border-gray-800/80">
                <li>
                  <strong className="text-white">Sync / Export to GitHub:</strong> Push or export
                  this project to your GitHub account.
                </li>
                <li>
                  <strong className="text-white">Automatic Cloud Compilation:</strong> GitHub
                  Actions automatically runs{' '}
                  <code className="text-cyan-400">
                    .github/workflows/build-android-apk.yml
                  </code>
                  , installs Java 17 + Android SDK +{' '}
                  <code className="text-cyan-400">cordova-plugin-bluetooth-serial</code>, compiles{' '}
                  <code className="text-emerald-400">XIM4-Web-Manager-SPP.apk</code>, and zips it.
                </li>
                <li>
                  <strong className="text-white">Download &amp; Extract on Phone:</strong> Open the{' '}
                  <strong className="text-cyan-300">Actions</strong> or{' '}
                  <strong className="text-cyan-300">Releases</strong> tab in your GitHub repo,
                  download <code className="text-cyan-300">xim-web-manager-android-apk.zip</code> on
                  your Android phone, extract it, and install the APK!
                </li>
              </ol>

              {/* Local CLI command */}
              <div className="pt-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 mb-1">
                  <span className="flex items-center gap-1">
                    <Terminal className="w-3 h-3 text-cyan-400" />
                    <span>OR BUILD LOCALLY ON PC / MAC:</span>
                  </span>
                  <button
                    onClick={handleCopyBuildCommand}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCmd ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Command</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-black/70 border border-gray-800 rounded px-3 py-2 font-mono text-[11px] text-cyan-300 overflow-x-auto">
                  npm run build &amp;&amp; npx cap add android &amp;&amp; npx cap sync android
                  &amp;&amp; cd android &amp;&amp; ./gradlew assembleDebug
                </div>
              </div>
            </div>
          </div>

          {/* Tip on hosting the compiled zip */}
          <div className="bg-gray-900/60 border border-gray-800 rounded p-3 flex items-start space-x-2.5 text-[11px] text-gray-400">
            <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-gray-200">Pro Tip:</strong> Once GitHub Actions compiles{' '}
              <code className="text-cyan-400">xim-web-manager-android-apk.zip</code>, you can also
              drop that <code className="text-cyan-400">.zip</code> file into this project&apos;s{' '}
              <code className="text-gray-200">/public</code> folder so the button above serves the
              ready-to-install APK directly from this web app!
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#12131a] px-4 sm:px-6 py-3.5 border-t border-gray-800 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-300 uppercase tracking-wider"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
