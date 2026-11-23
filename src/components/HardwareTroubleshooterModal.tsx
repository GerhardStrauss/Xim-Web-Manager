import React, { useState } from 'react';
import { 
  X, 
  HelpCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Gamepad2, 
  Mouse, 
  Keyboard, 
  Zap, 
  ShieldCheck, 
  Activity, 
  Info,
  ChevronRight,
  Usb
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  deviceState: 'disconnected' | 'connecting' | 'connected';
  deviceName: string | null;
}

export const HardwareTroubleshooterModal: React.FC<Props> = ({
  isOpen,
  onClose,
  deviceState,
  deviceName
}) => {
  const [activeSection, setActiveSection] = useState<'xbox' | 'leds' | 'power' | 'test'>('xbox');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 overflow-hidden">
      <div className="bg-[#0c0d12] border border-cyan-500/40 rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-[0_0_60px_rgba(6,182,212,0.2)] flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-black/40 relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-center justify-center text-cyan-400">
              <HelpCircle size={20} />
            </div>
            <div>
              <h2 className="text-white font-mono text-base md:text-lg font-bold tracking-tight uppercase flex items-center gap-2">
                XIM & Console Hardware Troubleshooter
              </h2>
              <p className="text-slate-400 text-[10px] md:text-xs">
                Solve Xbox connection, port mapping, and unresponsive keyboard/mouse issues
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 bg-slate-950/60 px-6 gap-2 overflow-x-auto shrink-0 relative z-10">
          {[
            { id: 'xbox', label: '1. Xbox Setup Checklist', icon: Gamepad2 },
            { id: 'test', label: '2. Controller Test', icon: ShieldCheck },
            { id: 'leds', label: '3. LED Light Meaning', icon: Activity },
            { id: 'power', label: '4. Power & RGB Fix', icon: Zap }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`py-3 px-3.5 text-[11px] font-mono uppercase tracking-wider font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                  active 
                    ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={14} className={active ? 'text-cyan-400' : 'text-slate-500'} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10 custom-scrollbar">
          
          {/* SECTION 1: XBOX SETUP CHECKLIST */}
          {activeSection === 'xbox' && (
            <div className="space-y-6">
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-start gap-3.5">
                <Info size={20} className="text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 leading-relaxed">
                  <span className="font-bold text-white block mb-0.5">Why the keyboard/mouse doesn't respond on Xbox:</span>
                  The Xbox console requires an official Xbox controller to act as a <b>security pass-through key</b>. If the controller isn't properly authenticated through Port 3, the Xbox will completely ignore all inputs from the XIM.
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold">
                  Check XIM Hub Ports (Look at the dots on the USB hub):
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Port 1 */}
                  <div className="p-4 bg-slate-900/70 border border-white/10 rounded-xl flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                        PORT 1 ( · )
                      </span>
                      <Mouse size={16} className="text-cyan-400" />
                    </div>
                    <div className="text-sm font-bold text-white">Mouse Only</div>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Plug your USB gaming mouse into the port marked with <b>1 dot</b>.
                    </p>
                  </div>

                  {/* Port 2 */}
                  <div className="p-4 bg-slate-900/70 border border-white/10 rounded-xl flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                        PORT 2 ( ·· )
                      </span>
                      <Keyboard size={16} className="text-cyan-400" />
                    </div>
                    <div className="text-sm font-bold text-white">Keyboard Only</div>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Plug your USB keyboard (or Sony Nav controller) into the port marked with <b>2 dots</b>.
                    </p>
                  </div>

                  {/* Port 3 */}
                  <div className="p-4 bg-cyan-950/40 border border-cyan-500/40 rounded-xl flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-yellow-400 font-bold bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                        PORT 3 ( ··· )
                      </span>
                      <Gamepad2 size={16} className="text-yellow-400" />
                    </div>
                    <div className="text-sm font-bold text-white">Official Xbox Controller</div>
                    <p className="text-[11px] text-slate-300 leading-normal">
                      <b>CRITICAL:</b> Plug the official Xbox controller here. <b>Remove batteries first!</b>
                    </p>
                  </div>
                </div>

                {/* Step-by-step Connection Order */}
                <div className="mt-6 p-4 bg-black/40 border border-white/10 rounded-xl space-y-3">
                  <h4 className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">
                    Official Plug-in Sequence for Xbox:
                  </h4>
                  <ol className="space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                      <span><b>Turn ON your Xbox console</b> with the console's front power button.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                      <span><b>Remove batteries</b> from your Xbox controller to prevent it from turning on wirelessly.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                      <span>Connect Mouse (Port 1), Keyboard (Port 2), and Controller (Port 3) to the XIM hub.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[10px]">4</span>
                      <span>Plug the XIM USB cable into the Xbox. Watch for the rainbow boot sequence.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[10px]">5</span>
                      <span>The Xbox controller will vibrate and its Xbox Guide button will light up steady white.</span>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: CONTROLLER TEST */}
          {activeSection === 'test' && (
            <div className="space-y-5">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-3">
                <AlertTriangle size={20} className="text-yellow-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 leading-relaxed">
                  <span className="font-bold text-white block mb-0.5">The Quick Controller Passthrough Test:</span>
                  Before testing mouse or keyboard, verify if the wired controller itself is talking to the Xbox through the XIM.
                </div>
              </div>

              <div className="p-5 bg-slate-900/60 border border-white/10 rounded-xl space-y-4">
                <h4 className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">
                  Follow these 3 verification steps:
                </h4>

                <div className="space-y-3">
                  <div className="p-3.5 bg-black/40 rounded-lg border border-white/5 flex items-start gap-3">
                    <span className="font-mono text-cyan-400 font-bold text-sm">A.</span>
                    <div>
                      <div className="text-xs font-bold text-white">Check the Controller Guide Button Light</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Is the Xbox logo button on the controller plugged into Port 3 lit up solid white? If it's flashing or dark, the micro-USB cable is either loose or a "charge-only" cable that doesn't transfer data.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-black/40 rounded-lg border border-white/5 flex items-start gap-3">
                    <span className="font-mono text-cyan-400 font-bold text-sm">B.</span>
                    <div>
                      <div className="text-xs font-bold text-white">Press the Xbox Guide Button</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Pick up the controller (connected to Port 3) and press the Xbox Guide button or move the thumbsticks. Does the Xbox dashboard open?
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-black/40 rounded-lg border border-white/5 flex items-start gap-3">
                    <span className="font-mono text-cyan-400 font-bold text-sm">C.</span>
                    <div>
                      <div className="text-xs font-bold text-white">Outcome Diagnosis</div>
                      <p className="text-[11px] text-slate-400 mt-0.5 space-y-1">
                        <span>• <b>If the controller DOES NOT move the Xbox dashboard:</b> The XIM cannot talk to Xbox yet. Replace the micro-USB cable connecting controller to Port 3 with a verified data cable.</span><br/>
                        <span>• <b>If the controller DOES move the Xbox dashboard, BUT mouse & keyboard still do nothing:</b> Your XIM4's internal memory slot is empty (caused by a factory reset). The XIM requires a game's Smart Translator and button mapping table to convert keystrokes into Xbox signals. Click <b>&quot;FLASH TO XIM4&quot;</b> in this web app to write the Smart Translator directly into Slot 1!</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: LED LIGHT MEANINGS */}
          {activeSection === 'leds' && (
            <div className="space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold">
                XIM4 LED Color & Light Code Guide
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Breathing Red */}
                <div className="p-3.5 bg-red-950/20 border border-red-500/30 rounded-xl flex items-start gap-3">
                  <div className="w-3.5 h-3.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse shrink-0 mt-1"></div>
                  <div>
                    <div className="text-xs font-bold text-white">Breathing Red (or Profile Color)</div>
                    <div className="text-[10px] text-red-400 font-mono uppercase font-semibold">Normal Gaming Mode</div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      The XIM is active and running the current game profile (Hip Fire). This is the normal operating state.
                    </p>
                  </div>
                </div>

                {/* Flickering Green */}
                <div className="p-3.5 bg-green-950/20 border border-green-500/30 rounded-xl flex items-start gap-3">
                  <div className="w-3.5 h-3.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-ping shrink-0 mt-1"></div>
                  <div>
                    <div className="text-xs font-bold text-white">Flickering / Pulsing Green</div>
                    <div className="text-[10px] text-green-400 font-mono uppercase font-semibold">Bluetooth Active</div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Flashes green whenever your phone or web browser connects and communicates with the XIM Manager.
                    </p>
                  </div>
                </div>

                {/* Solid / Flashing Yellow */}
                <div className="p-3.5 bg-yellow-950/20 border border-yellow-500/30 rounded-xl flex items-start gap-3">
                  <div className="w-3.5 h-3.5 rounded-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)] shrink-0 mt-1"></div>
                  <div>
                    <div className="text-xs font-bold text-white">Solid or Flashing Yellow</div>
                    <div className="text-[10px] text-yellow-400 font-mono uppercase font-semibold">Power Fault / USB Sync Pause</div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Occurs when plugged into a PC in config mode, or if an attached RGB keyboard draws too much power.
                    </p>
                  </div>
                </div>

                {/* Solid Cyan */}
                <div className="p-3.5 bg-cyan-950/20 border border-cyan-500/30 rounded-xl flex items-start gap-3">
                  <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)] shrink-0 mt-1"></div>
                  <div>
                    <div className="text-xs font-bold text-white">Solid Cyan / Blue</div>
                    <div className="text-[10px] text-cyan-400 font-mono uppercase font-semibold">Firmware / Wired Manager Mode</div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Triggered when holding the 'P' button during plug-in to connect directly to PC via USB.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: POWER & RGB FIX */}
          {activeSection === 'power' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-900/70 border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">
                  <Zap size={16} />
                  RGB Gaming Keyboards & Power Limits
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Many modern gaming keyboards (Corsair, Razer Chroma, SteelSeries, Logitech G) have bright RGB backlights that draw over <b>500mA - 1000mA</b> of power. The console's USB port cannot supply enough power for the XIM, the controller, and an RGB keyboard simultaneously.
                </p>
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="text-xs font-bold text-white">Quick Fixes:</div>
                  <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc pl-4">
                    <li>Turn down or completely turn OFF your keyboard's RGB backlight using the onboard brightness shortcut key.</li>
                    <li>Plug an external <b>5V 2A–3A power adapter</b> (3.5mm x 1.35mm barrel jack) into the XIM4 power port if you want full RGB lighting.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/40 flex items-center justify-between shrink-0 relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
              Status: {deviceState === 'connected' ? `Connected (${deviceName || 'XIM'})` : 'Hardware Ready'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono uppercase font-bold tracking-widest rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
