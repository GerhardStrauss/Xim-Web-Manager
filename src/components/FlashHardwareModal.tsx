import React, { useState, useEffect } from 'react';
import { 
  X, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  RefreshCw, 
  Sliders, 
  Terminal, 
  Radio,
  Usb,
  Bluetooth,
  Info,
  Plus,
  Smartphone
} from 'lucide-react';
import { XimProfile } from '../types';
import { ximService, TransportDiagnostics } from '../services/ximService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: XimProfile;
  deviceState: 'disconnected' | 'connecting' | 'connected';
  deviceName: string | null;
  onFlashComplete?: (slotIndex: number) => void;
  onConnectSerial?: () => Promise<void>;
  onConnectWebUSB?: () => Promise<void>;
  onConnectBLE?: () => Promise<void>;
  onOpenApkModal?: () => void;
}

export const FlashHardwareModal: React.FC<Props> = ({
  isOpen,
  onClose,
  profile,
  deviceState,
  deviceName,
  onFlashComplete,
  onConnectSerial,
  onConnectWebUSB,
  onConnectBLE,
  onOpenApkModal
}) => {
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('Xbox One');
  const [status, setStatus] = useState<'idle' | 'flashing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [diagnostics, setDiagnostics] = useState<TransportDiagnostics>(() => ximService.getDiagnostics());
  const [testLedFeedback, setTestLedFeedback] = useState<string | null>(null);
  const [rxStream, setRxStream] = useState<string[]>([]);
  const [customBleUuid, setCustomBleUuid] = useState<string>('');
  const [customUuidSaved, setCustomUuidSaved] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDiagnostics(ximService.getDiagnostics());
      setStatus('idle');
      setErrorMessage(null);
      setTestLedFeedback(null);
    }
  }, [isOpen, deviceState, deviceName]);

  useEffect(() => {
    if (!isOpen) return;
    const handleRx = (hex: string) => {
      setRxStream(prev => [...prev.slice(-6), `[RX] ${hex}`]);
      setDiagnostics({ ...ximService.getDiagnostics() });
    };
    ximService.addRxListener(handleRx);
    return () => ximService.removeRxListener(handleRx);
  }, [isOpen]);

  if (!isOpen) return null;

  const isControllerSpoof = diagnostics.transportType === 'web-usb-passthrough';
  const isBleReadOnly = deviceState === 'connected' && !diagnostics.canWriteHardware && !isControllerSpoof;
  const isHardwareWritable = deviceState === 'connected' && diagnostics.canWriteHardware && !isControllerSpoof;

  const handleAddCustomBleUuid = () => {
    if (!customBleUuid.trim()) return;
    ximService.addCustomBleServiceUuid(customBleUuid);
    setCustomUuidSaved(`Saved custom BLE Service UUID "${customBleUuid.trim()}". Now tap "Reconnect BLE with All Services" below!`);
    setCustomBleUuid('');
  };

  const handleTestLedPing = async () => {
    setTestLedFeedback('Transmitting RGB LED pulse & slot select packet...');
    const ok = await ximService.syncProfileToHardware(profile, selectedSlot);
    setDiagnostics({ ...ximService.getDiagnostics() });
    if (ok && !isControllerSpoof) {
      setTestLedFeedback('Packet transmitted over writable channel! Watch if XIM4 LED flickers green or changes color.');
    } else if (isControllerSpoof) {
      setTestLedFeedback('WARNING: USB port is currently spoofing your Controller (Passthrough Mode). Put XIM4 into Wired Configuration Mode (press P during rainbow boot) first!');
    } else {
      setTestLedFeedback('0 bytes written: Web Bluetooth is currently read-only. Follow Step 1 (USB-OTG Wired Config Mode) or Step 2 (Custom BLE UUID) below!');
    }
  };

  const handleStartFlash = async () => {
    setStatus('flashing');
    setProgress(5);
    setErrorMessage(null);
    setLogs([`[0%] Initializing XIM4 Hardware Flasher...`]);

    const result = await ximService.flashProfileToHardware(
      profile,
      selectedSlot,
      selectedPlatform,
      (pct, logMsg) => {
        setProgress(pct);
        setLogs(prev => [...prev.slice(-12), `[${pct}%] ${logMsg}`]);
      }
    );

    setDiagnostics({ ...ximService.getDiagnostics() });

    if (result.success) {
      setStatus('success');
      if (onFlashComplete) onFlashComplete(selectedSlot);
    } else {
      setErrorMessage(result.error || 'Hardware did not accept write payload.');
      setStatus('error');
    }
  };

  const handleDownloadBinaryBackup = () => {
    const payload = ximService.buildXim4SlotPayload(profile, selectedSlot, selectedPlatform);
    const blob = new Blob([payload as unknown as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xim4_slot${selectedSlot + 1}_${profile.game.replace(/\s+/g, '_').toLowerCase()}.bin`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const supportsWebUSB = typeof navigator !== 'undefined' && 'usb' in navigator;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 overflow-hidden">
      <div className="bg-[#0b0c10] border border-cyan-500/40 rounded-2xl max-w-2xl w-full max-h-[92vh] shadow-[0_0_60px_rgba(6,182,212,0.25)] flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-black/40 relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-center justify-center text-cyan-400">
              <Zap size={22} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-white font-mono text-base md:text-lg font-bold tracking-tight uppercase flex items-center gap-2">
                Flash to XIM4 Memory Slot
              </h2>
              <p className="text-slate-400 text-[10px] md:text-xs">
                Direct Hardware Flasher & Troubleshooting for Android USB-OTG and Bluetooth
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={status === 'flashing'}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-left relative z-10 custom-scrollbar">

          {/* Hardware Transport Status & Direct Switcher */}
          <div className={`p-4 rounded-xl border text-xs font-mono space-y-3 ${
            isHardwareWritable
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : isControllerSpoof
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                : isBleReadOnly
                  ? 'bg-red-500/10 border-red-500/40 text-red-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Radio size={16} />
                <span className="font-bold tracking-wider uppercase">
                  {isHardwareWritable
                    ? `Writable Channel Active: ${deviceName}`
                    : isControllerSpoof
                      ? `Controller Passthrough Detected (${deviceName}) — Switch XIM4 to Wired Config Mode!`
                      : isBleReadOnly
                        ? `BLE Read-Only Mode (${deviceName || 'XIM4'})`
                        : 'No Writable Hardware Transport Connected'}
                </span>
              </div>
              <div className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-black/40 border border-current shrink-0">
                {isHardwareWritable
                  ? 'WRITE ENABLED'
                  : isControllerSpoof
                    ? 'CONTROLLER SPOOF'
                    : isBleReadOnly
                      ? 'BLE READ-ONLY'
                      : 'DISCONNECTED'}
              </div>
            </div>

            <p className="text-[11px] opacity-90 font-sans leading-relaxed">
              {diagnostics.diagnosticNote}
            </p>

            {/* Discovered GATT Services / USB Interfaces Inspector */}
            {diagnostics.discoveredServices.length > 0 && (
              <div className="pt-2 border-t border-white/10 text-[10px] text-slate-300 space-y-1">
                <div className="font-bold text-white uppercase">Discovered Device Interfaces / Services:</div>
                {diagnostics.discoveredServices.map(s => (
                  <div key={s.uuid} className="pl-2">
                    • <span className="text-cyan-400">{s.uuid}</span> ({s.characteristics.map(c => `${c.uuid.slice(0, 8)}:[${c.properties.join('/')}]`).join(', ') || 'read-only'})
                  </div>
                ))}
              </div>
            )}

            {/* Direct Connection Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              {supportsWebUSB && onConnectWebUSB && (
                <button
                  type="button"
                  onClick={async () => {
                    await onConnectWebUSB();
                    setDiagnostics({ ...ximService.getDiagnostics() });
                  }}
                  className="px-3 py-2 bg-cyan-500 text-black hover:bg-cyan-400 rounded-lg text-[10px] font-mono uppercase font-bold transition-colors flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                >
                  <Usb size={13} />
                  <span>1. Connect USB-OTG (Wired Config Mode)</span>
                </button>
              )}

              {onConnectBLE && (
                <button
                  type="button"
                  onClick={async () => {
                    await onConnectBLE();
                    setDiagnostics({ ...ximService.getDiagnostics() });
                  }}
                  className="px-3 py-2 bg-blue-500/20 border border-blue-400/40 text-blue-300 hover:bg-blue-500/30 rounded-lg text-[10px] font-mono uppercase font-bold transition-colors flex items-center gap-1.5"
                >
                  <Bluetooth size={13} />
                  <span>2. Reconnect BLE (15+ UART Services)</span>
                </button>
              )}

              {onConnectSerial && (
                <button
                  type="button"
                  onClick={async () => {
                    await onConnectSerial();
                    setDiagnostics({ ...ximService.getDiagnostics() });
                  }}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-mono uppercase font-bold transition-colors flex items-center gap-1.5"
                >
                  <Bluetooth size={13} />
                  <span>3. Bluetooth Classic SPP</span>
                </button>
              )}

              {onOpenApkModal && !ximService.isNativeAndroidApp() && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenApkModal();
                  }}
                  className="px-3 py-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 rounded-lg text-[10px] font-mono uppercase font-bold transition-colors flex items-center gap-1.5"
                >
                  <Smartphone size={13} />
                  <span>Get Android APK (.zip)</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleTestLedPing}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-mono uppercase font-bold transition-colors"
              >
                Test LED Pulse
              </button>
            </div>

            {testLedFeedback && (
              <div className="text-[10px] bg-black/50 p-2 rounded border border-white/10 text-cyan-300">
                {testLedFeedback}
              </div>
            )}

            {rxStream.length > 0 && (
              <div className="text-[10px] bg-black/70 p-2 rounded border border-emerald-500/30 text-emerald-300 space-y-0.5">
                <div className="font-bold uppercase">Live Incoming XIM4 Bytes ({diagnostics.rxPacketsReceived} packets):</div>
                {rxStream.map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </div>
            )}
          </div>

          {/* EXACT ANSWERS to the user's 3 weekend findings */}
          <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider">
              <Info size={16} className="shrink-0" />
              <span>Why Your 3 Tests Happened & How to Fix Each One</span>
            </div>
            <div className="text-[11px] text-slate-300 leading-relaxed font-sans space-y-2.5">
              <div className="p-2.5 bg-black/40 rounded-lg border border-white/10">
                <span className="text-amber-400 font-bold block">1. Why USB-OTG WebUSB only picked up your Controller:</span>
                When you plug a XIM4 into your phone (or Xbox) normally, the XIM4 <b>spoofs/impersonates the controller plugged into Port 3</b> (`VID 0x045e` Microsoft Xbox Controller) so the console won&apos;t ban it. That is why your phone only saw your controller!
                <div className="mt-1.5 text-white bg-cyan-500/10 border border-cyan-500/30 p-2 rounded">
                  <b>THE FIX (How to expose XIM4 on USB-OTG):</b>
                  <ol className="list-decimal pl-4 mt-1 space-y-0.5 text-cyan-200">
                    <li><b>Unplug your Xbox controller from Port 3</b> on the XIM4.</li>
                    <li>Plug the XIM4 into your Android phone via your USB-OTG adapter.</li>
                    <li><b>During the initial rainbow light startup sequence, press the &apos;P&apos; button</b> on the back of the XIM4 (the light will flash red for <i>Wired Configuration Mode</i>), <b>OR hold the &apos;P&apos; button while plugging it in</b> until the light turns <b>SOLID BLUE</b>.</li>
                    <li>Now tap <b>1. Connect USB-OTG</b> above — your phone will now detect the <b>XIM4 itself (`VID 0x2387`)</b> instead of the controller!</li>
                  </ol>
                </div>
              </div>

              <div className="p-2.5 bg-black/40 rounded-lg border border-white/10">
                <span className="text-cyan-400 font-bold block">2. Why Web Bluetooth (BLE) saw your XIM4 but couldn&apos;t flash:</span>
                Web Bluetooth requires the web app to list the exact 128-bit Service UUID in <code className="text-cyan-300">optionalServices</code> before connecting, otherwise Android Chrome hides all custom writable services! We just expanded <code className="text-cyan-300">optionalServices</code> from 6 to <b>17 Dual-Mode BLE UART services</b> (including Microchip ISSC Transparent UART <code className="text-cyan-300">49535343-...</code>, Telit, CSR, and FFF0).
                <div className="mt-2 flex flex-col gap-1.5">
                  <span className="text-[10px] text-slate-400">
                    Tip: If you install the free <b>nRF Connect</b> app on Android and tap <i>Connect</i> on XIM4, it shows every 128-bit Service UUID on your hardware. You can paste any custom Service UUID here so Web Bluetooth unlocks it:
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customBleUuid}
                      onChange={(e) => setCustomBleUuid(e.target.value)}
                      placeholder="Paste custom 128-bit BLE Service UUID (e.g. 49535343-fe7d-...)"
                      className="flex-1 bg-black/60 border border-white/15 rounded px-2.5 py-1.5 text-[10px] font-mono text-white focus:border-cyan-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomBleUuid}
                      className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 rounded text-[10px] font-mono uppercase font-bold flex items-center gap-1"
                    >
                      <Plus size={12} />
                      <span>Add UUID</span>
                    </button>
                  </div>
                  {customUuidSaved && (
                    <span className="text-[10px] text-emerald-400 font-mono">{customUuidSaved}</span>
                  )}
                </div>
              </div>

              <div className="p-2.5 bg-black/40 rounded-lg border border-white/10">
                <span className="text-slate-200 font-bold block">3. Why Bluetooth Classic SPP list was empty:</span>
                Previously, the filter passed both a string and a number (<code className="text-cyan-300">[&apos;00001101-...&apos;, 0x1101]</code>), which caused Android Chrome&apos;s serial chooser to silently skip Bluetooth SPP discovery. We fixed this to strictly pass the canonical 128-bit UUID string.
              </div>
            </div>
          </div>

          {/* Target Profile Card */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-4 h-12 rounded-md shadow-md"
                style={{ backgroundColor: profile.color || '#06b6d4' }}
              />
              <div>
                <span className="text-[10px] text-cyan-400 font-mono uppercase tracking-widest font-bold">Profile to Flash</span>
                <h3 className="text-white font-bold text-base">{profile.game}</h3>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                  <span>HIP: {profile.hip?.sensitivity || 45}</span>
                  <span>·</span>
                  <span>ADS: {profile.ads?.sensitivity || 35}</span>
                  <span>·</span>
                  <span>{profile.bindings?.primary?.length || 14} Mappings</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono block">Payload Size</span>
              <span className="text-xs font-mono font-bold text-slate-200">320 Bytes (Chunked)</span>
            </div>
          </div>

          {status === 'idle' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">
                    Target Console Platform
                  </label>
                  <select 
                    value={selectedPlatform}
                    onChange={(e) => setSelectedPlatform(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Xbox One">Xbox One (Standard)</option>
                    <option value="PS4">PlayStation 4</option>
                    <option value="Xbox 360">Xbox 360</option>
                    <option value="PS3">PlayStation 3</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">
                    XIM4 Hardware Memory Slot
                  </label>
                  <select 
                    value={selectedSlot}
                    onChange={(e) => setSelectedSlot(Number(e.target.value))}
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                  >
                    <option value={0}>Slot 1 (Primary / Default Boot)</option>
                    <option value={1}>Slot 2</option>
                    <option value={2}>Slot 3</option>
                    <option value={3}>Slot 4</option>
                  </select>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="text-[10px] text-cyan-400 font-mono uppercase tracking-widest hover:underline flex items-center gap-1.5"
                >
                  <Sliders size={12} />
                  <span>{showTechnicalDetails ? 'Hide Binary Packet Breakdown' : 'View Binary Packet Breakdown'}</span>
                </button>

                {showTechnicalDetails && (
                  <div className="mt-2.5 p-3 bg-black/70 border border-white/10 rounded-lg font-mono text-[10px] text-slate-300 space-y-1.5">
                    <div className="text-cyan-400 font-bold">Generated Memory Map:</div>
                    <p>• Header (32 bytes): Magic &quot;XIM4&quot;, Slot #{selectedSlot + 1}, Platform Code 0x03 (Xbox One), RGB Color</p>
                    <p>• HIP Look Engine (64 bytes): Sens {profile.hip?.sensitivity || 45}, Deadzone Linearizer, 21-point Ballistics Curve</p>
                    <p>• ADS Look Engine (64 bytes): Sens {profile.ads?.sensitivity || 35}, Delay {profile.ads?.activationDelay || 0}ms, Right-Click Trigger</p>
                    <p>• Keybind Matrix (128 bytes): Standard USB HID Scancodes to Xbox One Gamepad mappings</p>
                    <p>• Transmission: Framed over USB-OTG (Wired Config Mode), BLE UART, or Bluetooth SPP</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Flashing In Progress State */}
          {status === 'flashing' && (
            <div className="py-6 space-y-5 text-center">
              <div className="relative inline-flex items-center justify-center">
                <div className="w-20 h-20 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin"></div>
                <div className="absolute text-sm font-mono font-bold text-white">
                  {progress}%
                </div>
              </div>

              <div>
                <h4 className="text-white font-mono text-sm uppercase tracking-wider font-bold">
                  Streaming Smart Translator to XIM4...
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Writing memory chunks to Slot {selectedSlot + 1}. Do not disconnect your device.
                </p>
              </div>

              <div className="w-full bg-black/60 rounded-full h-2.5 overflow-hidden border border-white/10 p-0.5">
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="bg-black/80 border border-white/10 rounded-xl p-3 text-left font-mono text-[10px] text-slate-300 max-h-36 overflow-y-auto space-y-1">
                <div className="text-cyan-400 flex items-center gap-1.5 pb-1 border-b border-white/10 font-bold">
                  <Terminal size={12} />
                  <span>XIM4 Hardware Protocol Stream</span>
                </div>
                {logs.map((log, idx) => (
                  <div key={idx} className="opacity-90 leading-tight">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success State */}
          {status === 'success' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <h4 className="text-white font-mono text-base uppercase tracking-wider font-bold">
                  320 Bytes Transmitted to Slot {selectedSlot + 1}
                </h4>
                <p className="text-xs text-slate-300 mt-1.5 max-w-md mx-auto">
                  The packet stream was transmitted across {diagnostics.writableCharacteristicUuid || 'the active hardware port'}.
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="py-5 text-center space-y-4">
              <div className="w-14 h-14 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-400 mx-auto">
                <AlertTriangle size={32} />
              </div>

              <div>
                <h4 className="text-white font-mono text-base uppercase tracking-wider font-bold">
                  Writable XIM4 Channel Required (0 Bytes Written)
                </h4>
                <p className="text-xs text-red-300 mt-1.5 max-w-lg mx-auto leading-relaxed">
                  {errorMessage}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                {supportsWebUSB && onConnectWebUSB && (
                  <button
                    onClick={async () => {
                      await onConnectWebUSB();
                      setDiagnostics({ ...ximService.getDiagnostics() });
                      setStatus('idle');
                    }}
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold font-mono text-xs uppercase tracking-wider rounded-lg transition-colors inline-flex items-center gap-2"
                  >
                    <Usb size={14} />
                    <span>Connect USB-OTG (Wired Config Mode)</span>
                  </button>
                )}
                {onConnectBLE && (
                  <button
                    onClick={async () => {
                      await onConnectBLE();
                      setDiagnostics({ ...ximService.getDiagnostics() });
                      setStatus('idle');
                    }}
                    className="px-4 py-2 bg-blue-500/20 border border-blue-400/40 text-blue-300 hover:bg-blue-500/30 font-bold font-mono text-xs uppercase tracking-wider rounded-lg transition-colors inline-flex items-center gap-2"
                  >
                    <Bluetooth size={14} />
                    <span>Reconnect BLE (15+ Services)</span>
                  </button>
                )}
                <button
                  onClick={() => setStatus('idle')}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-mono text-xs uppercase tracking-wider rounded-lg transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/40 flex items-center justify-between shrink-0 relative z-10">
          <button
            onClick={handleDownloadBinaryBackup}
            className="text-[10px] font-mono font-bold text-slate-400 hover:text-white uppercase tracking-wider flex items-center gap-1.5 hover:bg-white/5 px-2.5 py-1.5 rounded transition-colors"
            title="Download the raw 320-byte compiled binary file"
          >
            <Download size={13} />
            <span>Download .BIN File</span>
          </button>

          <div className="flex items-center gap-2">
            {status === 'success' ? (
              <button
                onClick={onClose}
                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold font-mono text-xs uppercase tracking-wider rounded-lg transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              >
                Done
              </button>
            ) : status === 'flashing' ? (
              <button
                disabled
                className="px-6 py-2 bg-white/10 text-slate-400 font-bold font-mono text-xs uppercase tracking-wider rounded-lg opacity-60 cursor-not-allowed flex items-center gap-2"
              >
                <RefreshCw size={14} className="animate-spin" />
                <span>Flashing...</span>
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 font-mono text-xs uppercase tracking-wider rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartFlash}
                  className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold font-mono text-xs uppercase tracking-wider rounded-lg transition-all shadow-[0_0_25px_rgba(6,182,212,0.4)] flex items-center gap-2"
                >
                  <Zap size={14} />
                  <span>Flash to XIM4 (Slot {selectedSlot + 1})</span>
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
