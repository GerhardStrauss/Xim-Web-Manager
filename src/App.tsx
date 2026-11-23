import { useState, useEffect, useRef } from 'react';
import { Bluetooth, Settings, Gamepad2, Mouse, Keyboard, Plus, Upload, Download, Trash2, Cpu, Menu, X, Star, LogOut, ChevronUp, ChevronDown, Usb, HelpCircle, ShieldCheck, Zap, Activity, Smartphone } from 'lucide-react';
import { XimProfile, Binding } from './types';
import { auth, db } from './lib/firebase';
import { handleFirestoreError, OperationType } from './lib/firebase-errors';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, onSnapshot, setDoc, doc, deleteDoc, getDocs } from 'firebase/firestore';
import Login from './Login';
import { ximService, XimInputEvent } from './services/ximService';
import { HardwareTroubleshooterModal } from './components/HardwareTroubleshooterModal';
import { FlashHardwareModal } from './components/FlashHardwareModal';
import { AndroidApkModal } from './components/AndroidApkModal';

const DEFAULT_CURVE = Array.from({ length: 21 }, (_, i) => Math.min(100, i * 5));

const DEFAULT_PC_CONTROLS: Record<string, Record<string, string>> = {
  'Grand Theft Auto V': {
    'Move Forward': 'W',
    'Move Back': 'S',
    'Move Left': 'A',
    'Move Right': 'D',
    'Sprint/Pedal': 'Shift',
    'Jump/Climb': 'Space',
    'Enter Vehicle': 'F',
    'Reload/Melee': 'R',
    'Take Cover': 'Q',
    'Aim': 'Right Mouse',
    'Shoot': 'Left Mouse',
    'Weapon Wheel': 'Tab',
    'Stealth Mode': 'Ctrl',
    'Look Behind': 'C'
  },
  'Assassin\'s Creed Origins': {
    'Move Forward': 'W',
    'Move Back': 'S',
    'Move Left': 'A',
    'Move Right': 'D',
    'Sprint/Mount/Dismount': 'Shift',
    'Parkour Up': 'Alt',
    'Parkour Down': 'C',
    'Interact': 'E',
    'Light Attack': 'Left Mouse',
    'Heavy Attack': 'Shift',
    'Aim Bow': 'Right Mouse',
    'Shoot Bow': 'Left Mouse',
    'Assassinate/Interact': 'F',
    'Dodge': 'Space',
    'Lock On': 'Middle Mouse'
  },
  'Shadow of Mordor': {
    'Move Forward': 'W',
    'Move Back': 'S',
    'Move Left': 'A',
    'Move Right': 'D',
    'Stealth': 'Shift',
    'Interact/Drain': 'E',
    'Attack': 'Left Mouse',
    'Counter': 'Right Mouse',
    'Evade/Sprint': 'Space',
    'Wraith Vision': 'V',
    'Bow/Throw Dagger': 'Right Mouse',
    'Shoot Bow': 'Left Mouse',
    'Lock On': 'Middle Mouse'
  },
  'Star Wars Jedi: Fallen Order': {
    'Move Forward': 'W',
    'Move Back': 'S',
    'Move Left': 'A',
    'Move Right': 'D',
    'Jump': 'Space',
    'Attack': 'Left Mouse',
    'Parry/Block': 'Right Mouse',
    'Evade': 'Alt',
    'Force Push': '2',
    'Force Pull': '3',
    'Slow': '1',
    'Heal': 'Q',
    'Interact': 'E',
    'Target/Lock on': 'Middle Mouse'
  }
};

const DEFAULT_PC_SECONDARY_CONTROLS: Record<string, Record<string, string>> = {
  'Grand Theft Auto V': {
    'Aircraft Throttle Up': 'W',
    'Aircraft Throttle Down': 'S',
    'Aircraft Yaw Left': 'A',
    'Aircraft Yaw Right': 'D',
    'Aircraft Roll Left': 'Numpad 4',
    'Aircraft Roll Right': 'Numpad 6',
    'Aircraft Pitch Forward': 'L Shift',
    'Aircraft Pitch Back': 'Numpad 5',
    'Aircraft Fire': 'L Ctrl',
    'Aircraft Target Left': 'Numpad 7',
    'Aircraft Target Right': 'Numpad 9',
    'Toggle Landing Gear': '2',
    'Aircraft Grappling Hook / VTOL Mode': 'E',
    'Toggle Aircraft Weapon Camera': 'Numpad -',
    'Override Aircraft Mouse Control (Hold)': 'Numpad .'
  }
};

const DEFAULT_CONSOLE_SECONDARY_CONTROLS: Record<string, Record<string, Record<string, string>>> = {
  'Grand Theft Auto V': {
    'Xbox One': {
      'Aircraft Throttle Up': 'RT',
      'Aircraft Throttle Down': 'LT',
      'Aircraft Yaw Left': 'LB',
      'Aircraft Yaw Right': 'RB',
      'Aircraft Roll Left': 'L-STICK LEFT',
      'Aircraft Roll Right': 'L-STICK RIGHT',
      'Aircraft Pitch Forward': 'L-STICK UP',
      'Aircraft Pitch Back': 'L-STICK DOWN',
      'Aircraft Fire': 'A',
      'Aircraft Target Left': 'LB',
      'Aircraft Target Right': 'RB',
      'Toggle Landing Gear': 'L3',
      'Aircraft Grappling Hook / VTOL Mode': 'D-PAD RIGHT',
      'Toggle Aircraft Weapon Camera': 'R3',
      'Override Aircraft Mouse Control (Hold)': 'R-STICK RIGHT'
    }
  }
};

const DEFAULT_CONSOLE_CONTROLS: Record<string, Record<string, Record<string, string>>> = {
  'Grand Theft Auto V': {
    'Xbox One': {
      'Move Forward': 'L-Stick Up',
      'Move Back': 'L-Stick Down',
      'Move Left': 'L-Stick Left',
      'Move Right': 'L-Stick Right',
      'Sprint/Pedal': 'A',
      'Jump/Climb': 'X',
      'Enter Vehicle': 'Y',
      'Reload/Melee': 'B',
      'Take Cover': 'RB',
      'Aim': 'LT',
      'Shoot': 'RT',
      'Weapon Wheel': 'LB',
      'Stealth Mode': 'LS',
      'Look Behind': 'RS'
    },
    'PS4': {
      'Move Forward': 'L-Stick Up',
      'Move Back': 'L-Stick Down',
      'Move Left': 'L-Stick Left',
      'Move Right': 'L-Stick Right',
      'Sprint/Pedal': 'Cross',
      'Jump/Climb': 'Square',
      'Enter Vehicle': 'Triangle',
      'Reload/Melee': 'Circle',
      'Take Cover': 'R1',
      'Aim': 'L2',
      'Shoot': 'R2',
      'Weapon Wheel': 'L1',
      'Stealth Mode': 'L3',
      'Look Behind': 'R3'
    },
    'Xbox 360': {
      'Move Forward': 'L-Stick Up',
      'Move Back': 'L-Stick Down',
      'Move Left': 'L-Stick Left',
      'Move Right': 'L-Stick Right',
      'Sprint/Pedal': 'A',
      'Jump/Climb': 'X',
      'Enter Vehicle': 'Y',
      'Reload/Melee': 'B',
      'Take Cover': 'RB',
      'Aim': 'LT',
      'Shoot': 'RT',
      'Weapon Wheel': 'LB',
      'Stealth Mode': 'LS',
      'Look Behind': 'RS'
    },
    'PS3': {
      'Move Forward': 'L-Stick Up',
      'Move Back': 'L-Stick Down',
      'Move Left': 'L-Stick Left',
      'Move Right': 'L-Stick Right',
      'Sprint/Pedal': 'Cross',
      'Jump/Climb': 'Square',
      'Enter Vehicle': 'Triangle',
      'Reload/Melee': 'Circle',
      'Take Cover': 'R1',
      'Aim': 'L2',
      'Shoot': 'R2',
      'Weapon Wheel': 'L1',
      'Stealth Mode': 'L3',
      'Look Behind': 'R3'
    }
  },
  'Assassin\'s Creed Origins': {
    'Xbox One': {
      'Move Forward': 'L-Stick Up',
      'Move Back': 'L-Stick Down',
      'Move Left': 'L-Stick Left',
      'Move Right': 'L-Stick Right',
      'Sprint/Mount/Dismount': 'LS',
      'Parkour Up': 'A',
      'Parkour Down': 'B',
      'Interact': 'Y',
      'Light Attack': 'RB',
      'Heavy Attack': 'RT',
      'Aim Bow': 'LT',
      'Shoot Bow': 'RT',
      'Assassinate/Interact': 'Y',
      'Dodge': 'X',
      'Lock On': 'RS'
    }
  },
  'Shadow of Mordor': {
    'Xbox One': {
      'Move Forward': 'L-Stick Up',
      'Move Back': 'L-Stick Down',
      'Move Left': 'L-Stick Left',
      'Move Right': 'L-Stick Right',
      'Stealth': 'RT',
      'Interact/Drain': 'B',
      'Attack': 'X',
      'Counter': 'Y',
      'Evade/Sprint': 'A',
      'Wraith Vision': 'LB',
      'Bow/Throw Dagger': 'LT',
      'Shoot Bow': 'RT',
      'Lock On': 'RS'
    }
  },
  'Star Wars Jedi: Fallen Order': {
    'Xbox One': {
      'Move Forward': 'L-Stick Up',
      'Move Back': 'L-Stick Down',
      'Move Left': 'L-Stick Left',
      'Move Right': 'L-Stick Right',
      'Jump': 'A',
      'Attack': 'X',
      'Parry/Block': 'LB',
      'Evade': 'B',
      'Force Push': 'RT',
      'Force Pull': 'LT',
      'Slow': 'RB',
      'Heal': 'D-Pad Up',
      'Interact': 'RS',
      'Target/Lock on': 'RS'
    }
  }
};

const MOCK_PROFILE_BASE = {
  id: 'gta-1',
  game: 'Grand Theft Auto V',
  console: 'Xbox One' as const,
  hip: { sensitivity: 25.0, synchronize: 'Default' as const, smoothing: 3, yxRatio: 1.0, steadyAim: 0, boost: 200, curve: DEFAULT_CURVE },
  ads: { sensitivity: 15.0, synchronize: 'Default' as const, smoothing: 0, yxRatio: 1.0, steadyAim: 0, boost: 0, curve: DEFAULT_CURVE },
  createdAt: Date.now()
};

const generateDefaultBindingsList = (game: string, consoleType: string, isSecondary = false): Binding[] => {
  const consoleControls = isSecondary ? DEFAULT_CONSOLE_SECONDARY_CONTROLS[game]?.[consoleType] : DEFAULT_CONSOLE_CONTROLS[game]?.[consoleType];
  const pcControls = isSecondary ? DEFAULT_PC_SECONDARY_CONTROLS[game] : DEFAULT_PC_CONTROLS[game];
  
  const bindings: Binding[] = [];
  
  if (pcControls) {
    Object.keys(pcControls).forEach((action, index) => {
      const consoleBtn = consoleControls ? consoleControls[action] : 'Unbound';
      const pcKey = pcControls[action];
      if (pcKey) {
        bindings.push({
          id: `bind-${isSecondary?'sec':'pri'}-${Date.now()}-${index}`,
          actionName: action,
          consoleButton: consoleBtn || 'Unbound',
          pcKey: pcKey
        });
      }
    });
  }
  
  return bindings;
};

const generateDefaultBindings = (game: string, consoleType: string) => {
  return {
    primary: generateDefaultBindingsList(game, consoleType, false),
    secondary: generateDefaultBindingsList(game, consoleType, true)
  };
};

const MOCK_PROFILE: XimProfile = {
  ...MOCK_PROFILE_BASE,
  bindings: generateDefaultBindings('Grand Theft Auto V', 'Xbox One')
};

const MOCK_PROFILE2: XimProfile = {
  id: 'aco-1',
  game: 'Assassin\'s Creed Origins',
  console: 'Xbox One',
  hip: { sensitivity: 20.0, synchronize: 'Default' as const, smoothing: 2, yxRatio: 1.0, steadyAim: 0, boost: 100, curve: DEFAULT_CURVE },
  ads: { sensitivity: 12.0, synchronize: 'Default' as const, smoothing: 1, yxRatio: 1.0, steadyAim: 0, boost: 0, curve: DEFAULT_CURVE },
  bindings: generateDefaultBindings('Assassin\'s Creed Origins', 'Xbox One'),
  createdAt: Date.now()
};

const MOCK_PROFILE3: XimProfile = {
  id: 'som-1',
  game: 'Shadow of Mordor',
  console: 'Xbox One',
  hip: { sensitivity: 18.0, synchronize: 'Default' as const, smoothing: 1, yxRatio: 1.0, steadyAim: 0, boost: 0, curve: DEFAULT_CURVE },
  ads: { sensitivity: 10.0, synchronize: 'Default' as const, smoothing: 0, yxRatio: 1.0, steadyAim: 0, boost: 0, curve: DEFAULT_CURVE },
  bindings: generateDefaultBindings('Shadow of Mordor', 'Xbox One'),
  createdAt: Date.now()
};

const MOCK_PROFILE4: XimProfile = {
  id: 'fo-1',
  game: 'Star Wars Jedi: Fallen Order',
  console: 'Xbox One',
  hip: { sensitivity: 22.0, synchronize: 'Default' as const, smoothing: 2, yxRatio: 1.0, steadyAim: 0, boost: 0, curve: DEFAULT_CURVE },
  ads: { sensitivity: 12.0, synchronize: 'Default' as const, smoothing: 1, yxRatio: 1.0, steadyAim: 0, boost: 0, curve: DEFAULT_CURVE },
  bindings: generateDefaultBindings('Star Wars Jedi: Fallen Order', 'Xbox One'),
  createdAt: Date.now()
};

export default function App() {
  const [diagnosticsEnabled, setDiagnosticsEnabled] = useState(() => localStorage.getItem('xim_debug') === 'true');
  const [deviceState, setDeviceState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showTroubleshooterModal, setShowTroubleshooterModal] = useState(false);
  const [showFlashModal, setShowFlashModal] = useState(false);
  const [showAndroidApkModal, setShowAndroidApkModal] = useState(false);
  const [showSidebarOptionsMenu, setShowSidebarOptionsMenu] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(() => {
    if (localStorage.getItem('xim_standalone_mode') === 'true') return true;
    const isCapacitorNative =
      typeof window !== 'undefined' &&
      (Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
        Boolean((window as any).Capacitor) ||
        Boolean((window as any).bluetoothSerial) ||
        window.location.hostname === 'localhost' ||
        window.location.protocol === 'capacitor:' ||
        window.location.protocol === 'file:');
    return isCapacitorNative;
  });
  const [profiles, setProfiles] = useState<XimProfile[]>(() => {
    try {
      const saved = localStorage.getItem('xim_local_profiles');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse local profiles:', e);
    }
    return [MOCK_PROFILE, MOCK_PROFILE2, MOCK_PROFILE3, MOCK_PROFILE4];
  });
  const [activeProfileId, setActiveProfileId] = useState<string>('gta-1');
  const [activeTab, setActiveTab] = useState<'HIP' | 'ADS' | 'BUTTONS'>('HIP');
  const [activeBindingTab, setActiveBindingTab] = useState<'primary' | 'secondary'>('primary');
  const [activeBindingCapture, setActiveBindingCapture] = useState<{ id: string, actionName: string, tempKey: string, group: 'primary' | 'secondary' } | null>(null);
  const [keyboardLayout, setKeyboardLayout] = useState<'main' | 'numpad'>('main');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [fadeSplash, setFadeSplash] = useState(false);
  const gamepadRef = useRef<number | null>(null);

  useEffect(() => {
    (window as any).ximDebug = diagnosticsEnabled;
    localStorage.setItem('xim_debug', diagnosticsEnabled ? 'true' : 'false');
  }, [diagnosticsEnabled]);

  useEffect(() => {
    if (activeBindingCapture && deviceState === 'connected') {
      ximService.startInputCapture();
    }
  }, [activeBindingCapture, deviceState]);

  // Gamepad listener for mapping
  useEffect(() => {
    if (!activeBindingCapture) return;

    let previousButtons: boolean[] = [];

    const scanGamepads = () => {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (!gp) continue;

        gp.buttons.forEach((button, index) => {
          if (button.pressed && !previousButtons[index]) {
            // Button just pressed
            setActiveBindingCapture(prev => prev ? { ...prev, tempKey: `GP_BTN_${index}` } : null);
          }
          previousButtons[index] = button.pressed;
        });
      }
      gamepadRef.current = requestAnimationFrame(scanGamepads);
    };

    gamepadRef.current = requestAnimationFrame(scanGamepads);
    return () => {
      if (gamepadRef.current) cancelAnimationFrame(gamepadRef.current);
    };
  }, [activeBindingCapture]);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadeSplash(true);
    }, 1500);

    const removeTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  const [user, setUser] = useState<User | null | undefined>(undefined);

  // Persist profiles to localStorage whenever they change so Android APK works 100% offline without Firebase Auth
  useEffect(() => {
    try {
      localStorage.setItem('xim_local_profiles', JSON.stringify(profiles));
    } catch (e) {
      console.warn('Could not save profiles to localStorage:', e);
    }
  }, [profiles]);

  useEffect(() => {
    // Re-check after Cordova/Capacitor deviceready fires on Android APK
    const onDeviceReady = () => {
      if ((window as any).bluetoothSerial || (window as any).Capacitor) {
        setIsOfflineMode(true);
      }
    };
    document.addEventListener('deviceready', onDeviceReady, false);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => {
      document.removeEventListener('deviceready', onDeviceReady, false);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const pathForOnSnapshot = `users/${user.uid}/configs`;
    const q = query(collection(db, pathForOnSnapshot));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // If empty, initialize with default profiles into Firestore
        const defaultProfiles = [MOCK_PROFILE, MOCK_PROFILE2, MOCK_PROFILE3, MOCK_PROFILE4].map(p => ({ ...p, userId: user.uid }));
        defaultProfiles.forEach(async p => {
           try {
              await setDoc(doc(db, pathForOnSnapshot, p.id), p);
           } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `${pathForOnSnapshot}/${p.id}`);
           }
        });
        setProfiles(defaultProfiles);
      } else {
        const fetchedProfiles = snapshot.docs.map(doc => doc.data() as XimProfile);
        setProfiles(fetchedProfiles);
        if (fetchedProfiles.length > 0 && !fetchedProfiles.some(p => p.id === activeProfileId)) {
          setActiveProfileId(fetchedProfiles[0].id);
        }
      }
    }, (error) => {
       handleFirestoreError(error, OperationType.GET, pathForOnSnapshot);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!activeBindingCapture) return;

    // Listen to XIM Hardware
    const handleHardwareInput = (event: XimInputEvent) => {
      setActiveBindingCapture(prev => prev ? { ...prev, tempKey: String(event.code) } : null);
    };
    
    ximService.addListener(handleHardwareInput);
    ximService.startListening();

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      // More standard formatting for mouse buttons or modifier keys might be needed later, 
      // but matching the previous code structure for now:
      let keyName = e.code.replace('Key', '').replace('Digit', '');
      if (e.code === 'Space') keyName = 'Space';
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keyName = 'Shift';
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') keyName = 'Ctrl';
      if (e.code === 'AltLeft' || e.code === 'AltRight') keyName = 'Alt';
      
      setActiveBindingCapture(prev => prev ? { ...prev, tempKey: keyName } : null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      ximService.removeListener(handleHardwareInput);
      ximService.stopListening();
    };
  }, [activeBindingCapture]);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];

  useEffect(() => {
    if (deviceState === 'connected' && activeProfile) {
      const slotIdx = profiles.findIndex(p => p.id === activeProfile.id);
      ximService.syncProfileToHardware(activeProfile, slotIdx >= 0 ? slotIdx : 0).then(synced => {
        if (synced) {
          setSyncFeedback(`Synced to XIM (${activeProfile.game})`);
          const t = setTimeout(() => setSyncFeedback(null), 3000);
          return () => clearTimeout(t);
        }
      });
    }
  }, [activeProfileId, deviceState, activeProfile?.color]);

  const saveProfileToDb = async (profile: XimProfile) => {
    if (!user) return;
    try {
      await setDoc(doc(db, `users/${user.uid}/configs`, profile.id), profile);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/configs/${profile.id}`);
    }
  };

  const createProfile = async () => {
    const newProfile: XimProfile = {
      id: Math.random().toString(36).substring(7),
      game: 'Grand Theft Auto V',
      console: 'Xbox One',
      hip: { ...MOCK_PROFILE.hip },
      ads: { ...MOCK_PROFILE.ads },
      bindings: generateDefaultBindings('Grand Theft Auto V', 'Xbox One'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId: user?.uid || 'local-android-user',
      isFavorite: false
    };
    setProfiles(prev => [newProfile, ...prev]);
    setActiveProfileId(newProfile.id);
    if (user) {
      try {
        await setDoc(doc(db, `users/${user.uid}/configs`, newProfile.id), newProfile);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/configs/${newProfile.id}`);
      }
    }
  };

  const updateActiveProfile = async (updates: Partial<XimProfile>) => {
    if (!activeProfile) return;
    
    let newBindings = activeProfile.bindings;
    if (updates.game && updates.game !== activeProfile.game) {
      newBindings = generateDefaultBindings(updates.game, activeProfile.console);
      updates.bindings = newBindings;
    } else if (updates.console && updates.console !== activeProfile.console) {
      newBindings = generateDefaultBindings(activeProfile.game, updates.console as string);
      updates.bindings = newBindings;
    }
    
    const updatedProfile = { ...activeProfile, ...updates, updatedAt: Date.now() };
    // Optimistic update (also saved automatically to localStorage)
    setProfiles(profiles.map(p => p.id === activeProfile.id ? updatedProfile : p));
    if (user) {
      await saveProfileToDb(updatedProfile);
    }
  };

  const updateSettings = (mode: 'hip' | 'ads', setting: string, value: any) => {
    const updatedSection = { ...activeProfile[mode], [setting]: value };
    updateActiveProfile({ [mode]: updatedSection });
  };
  
  const updateBindingField = (bindingId: string, field: keyof Binding, value: string, group: 'primary' | 'secondary') => {
    const updatedBindings = activeProfile.bindings[group].map(b => 
      b.id === bindingId ? { ...b, [field]: value } : b
    );
    updateActiveProfile({ bindings: { ...activeProfile.bindings, [group]: updatedBindings } });
  };

  const removeBinding = (bindingId: string, group: 'primary' | 'secondary') => {
    const updatedBindings = activeProfile.bindings[group].filter(b => b.id !== bindingId);
    updateActiveProfile({ bindings: { ...activeProfile.bindings, [group]: updatedBindings } });
  };

  const addNewBinding = (group: 'primary' | 'secondary') => {
    const newBinding: Binding = {
      id: `bind-${Date.now()}`,
      actionName: 'New Action',
      consoleButton: 'Unbound',
      pcKey: 'Unbound'
    };
    updateActiveProfile({ bindings: { ...activeProfile.bindings, [group]: [...activeProfile.bindings[group], newBinding] } });
  };

  const processBluetoothConnection = async () => {
    try {
      setDeviceState('connecting');
      if (!(navigator as any).bluetooth) {
        alert("Web Bluetooth is not supported in this browser or environment. You can still use this app as an offline profile manager.");
        setDeviceState('disconnected');
        setShowScanModal(false);
        return;
      }
      
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ximService.getCustomBleServiceUuids()
      });

      setShowScanModal(false); 
      
      const diag = await ximService.connectBluetooth(device);
      
      setDeviceName(diag.deviceName || device.name || "XIM4 Device");
      setDeviceState('connected');
      
      device.addEventListener('gattserverdisconnected', () => {
        setDeviceState('disconnected');
        setDeviceName(null);
      });
      
    } catch (err) {
      console.warn(err);
      setDeviceState('disconnected');
      setShowScanModal(false);
    }
  };

  const processSerialConnection = async () => {
    try {
      setDeviceState('connecting');
      const diag = await ximService.connectSerial(true);
      setDeviceName(diag.deviceName || "XIM4 Bluetooth SPP");
      setDeviceState('connected');
      setShowScanModal(false);
    } catch (err: any) {
      console.warn(err);
      setDeviceState('disconnected');
      setShowScanModal(false);
    }
  };

  const processWebUSBConnection = async () => {
    try {
      setDeviceState('connecting');
      const diag = await ximService.connectWebUSB();
      setDeviceName(diag.deviceName || "XIM4 USB Direct");
      setDeviceState('connected');
      setShowScanModal(false);
    } catch (err: any) {
      console.warn(err);
      setDeviceState('disconnected');
      setShowScanModal(false);
    }
  };

  const processHIDConnection = async () => {
    try {
      setDeviceState('connecting');
      const name = await ximService.connectHID();
      if (name) {
        setDeviceName(name);
        setDeviceState('connected');
      } else {
        setDeviceState('disconnected');
      }
      setShowScanModal(false);
    } catch (err) {
      console.warn(err);
      setDeviceState('disconnected');
      setShowScanModal(false);
    }
  };

  if (user === undefined && !isOfflineMode) return null; // Still checking auth state

  if (!user && !isOfflineMode && !showSplash) {
    return (
      <Login
        onContinueOffline={() => {
          localStorage.setItem('xim_standalone_mode', 'true');
          setIsOfflineMode(true);
        }}
      />
    );
  }

  const sortedProfiles = [...profiles].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    if (a.isFavorite && b.isFavorite) {
      return a.game.localeCompare(b.game);
    }
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Splash Screen */}
      {showSplash && (
        <div className={`fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center transition-opacity duration-500 ease-in-out ${fadeSplash ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="w-32 h-32 md:w-48 md:h-48 relative animate-[pulse_2s_ease-in-out_infinite]">
            <img src="/xim-logo.png" alt="XIM Web Manager Logo" className="w-full h-full object-contain" />
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 bg-[#08090a] md:bg-transparent z-50 md:z-10 flex flex-col flex-shrink-0 p-4 md:p-6 w-[280px] md:w-80 md:pr-0 transform transition-transform duration-300 md:relative md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="pb-4 border-b border-white/10 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 bg-cyan-500 rounded-sm flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)] shrink-0">
                <Cpu className="text-black" size={20} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col">
                <h1 className="font-mono tracking-tighter text-lg uppercase text-white m-0 leading-none truncate">XIM <span className="text-cyan-400">WEB</span></h1>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold mt-1">
                  <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-cyan-500 shrink-0"></span>
                  MANAGER
                </div>
              </div>
            </div>
            
            <button className="md:hidden text-slate-400 hover:text-white transition-colors p-1" onClick={() => setMobileMenuOpen(false)}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2 flex flex-col gap-4 py-4 md:mt-2 custom-scrollbar">
          {activeProfile && (
            <div className="flex items-center justify-between bg-black/20 rounded pl-3 border border-cyan-500/30 pr-1 py-1">
              <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Console</span>
              <select 
                value={activeProfile.console}
                onChange={(e) => updateActiveProfile({ console: e.target.value as any })}
                className="bg-cyan-500/10 text-cyan-500 text-[9px] font-mono uppercase px-2 py-1 rounded tracking-widest border border-cyan-500/20 outline-none cursor-pointer"
              >
                <option className="bg-[#08090a]">PS4</option>
                <option className="bg-[#08090a]">Xbox One</option>
                <option className="bg-[#08090a]">PS3</option>
                <option className="bg-[#08090a]">Xbox 360</option>
                <option className="bg-[#08090a]">PC</option>
              </select>
            </div>
          )}
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-slate-400 border-l-2 border-cyan-500 pl-3 font-bold m-0">Config Library</h2>
          </div>
          
          <div className="space-y-3">
            {sortedProfiles.map(p => (
              <div 
                key={p.id} 
                onClick={() => setActiveProfileId(p.id)}
                className={`relative overflow-hidden rounded-lg flex flex-col gap-1 cursor-pointer transition-all border ${activeProfileId === p.id ? 'border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.15)] bg-slate-900' : 'border-white/10 hover:border-white/30 bg-slate-950'}`}
              >
                {/* Thumbnail Background */}
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                  <img 
                    src={p.game === 'Grand Theft Auto V' ? '/gta-banner.jpg' : 
                         (p.game === "Assassin's Creed Origins" ? '/assassins%20creed%20origins-banner.jpg' : 
                         (p.game === "Shadow of Mordor" ? '/middle%20earth%20-%20shadow%20of%20mordor-banner.jpg' : 
                         (p.game === "Star Wars Jedi: Fallen Order" ? '/star%20wars%20jedi%20-%20fallen%20order-banner.jpg' : 
                         'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&q=80&w=600&h=300')))} 
                    alt={p.game}
                    referrerPolicy="no-referrer"
                    className={`w-full h-full object-cover contrast-125 saturate-50 transition-opacity duration-500 ${activeProfileId === p.id ? 'opacity-60' : 'opacity-50'}`}
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t transition-opacity duration-500 ${activeProfileId === p.id ? 'from-[#020617] via-[#020617]/70 to-transparent blend-multiply' : 'from-[#020617] via-[#020617]/90 to-[#020617]/60'}`}></div>
                </div>

                {/* Content */}
                <div className="relative z-10 px-4 pt-16 pb-4 pointer-events-none">
                  {p.isFavorite && (
                    <div className="absolute top-3 right-3 z-20">
                      <Star size={12} className="fill-yellow-400 text-yellow-400 drop-shadow-md" />
                    </div>
                  )}
                  <div className={`font-bold text-sm tracking-tight drop-shadow-md ${activeProfileId === p.id ? 'text-white' : 'text-slate-300'}`}>
                    {p.game}
                  </div>
                  <div className={`text-[9px] uppercase tracking-widest font-bold flex items-center gap-1 drop-shadow mt-0.5 ${activeProfileId === p.id ? 'text-cyan-400' : 'text-slate-500'}`}>
                    <Gamepad2 size={10} /> {p.console} {activeProfileId === p.id && '- Active'}
                    {p.color && <div className="w-2 h-2 rounded-full ml-auto" style={{ backgroundColor: p.color }}></div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <button onClick={createProfile} className="w-full py-4 border border-dashed border-white/10 rounded-lg text-slate-500 hover:text-slate-300 text-[10px] uppercase tracking-[0.2em] font-bold bg-white/5 transition-colors mt-auto">
            + New Config
          </button>
        </div>
        
        <div className="pt-3 border-t border-white/10 relative">
           {showSidebarOptionsMenu && (
             <>
               <div
                 className="fixed inset-0 z-30"
                 onClick={() => setShowSidebarOptionsMenu(false)}
               />
               <div className="absolute bottom-full left-0 right-0 mb-2.5 p-3 bg-[#0c0d10]/95 backdrop-blur-xl border border-cyan-500/40 rounded-xl shadow-[0_-10px_40px_rgba(0,0,0,0.85)] z-40 flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
                 <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                   <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-400 font-bold flex items-center gap-1.5">
                     <Settings size={11} className="text-cyan-400" />
                     Hardware &amp; App Options
                   </span>
                   <button
                     onClick={() => setShowSidebarOptionsMenu(false)}
                     className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                   >
                     <X size={13} />
                   </button>
                 </div>

                 {/* 1. Connect Hardware */}
                 <button 
                   onClick={() => {
                     setShowSidebarOptionsMenu(false);
                     if (deviceState !== 'connected') {
                       setShowScanModal(true);
                     }
                   }}
                   className={`w-full py-3 text-[10px] rounded-lg flex items-center justify-center gap-2 uppercase tracking-widest font-bold transition-all ${deviceState === 'connected' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 cursor-default' : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white'}`}
                 >
                   <Bluetooth size={14} className={deviceState === 'connecting' ? 'animate-pulse' : ''} />
                   {deviceState === 'connected' ? 'HARDWARE CONNECTED' : deviceState === 'connecting' ? 'PAIRING...' : 'CONNECT HARDWARE'}
                 </button>
                 
                 {/* 2. Xbox Setup & Troubleshooter */}
                 <button
                   onClick={() => {
                     setShowSidebarOptionsMenu(false);
                     setShowTroubleshooterModal(true);
                   }}
                   className="w-full py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-[9px] text-cyan-400 font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                 >
                   <HelpCircle size={13} />
                   <span>Xbox Setup &amp; Troubleshooter</span>
                 </button>

                 {/* 3. Flash Profile to XIM4 */}
                 <button
                   onClick={() => {
                     setShowSidebarOptionsMenu(false);
                     setShowFlashModal(true);
                   }}
                   className="w-full py-2.5 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500/30 hover:to-blue-600/30 border border-cyan-500/40 rounded-lg text-[9px] text-cyan-300 font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                 >
                   <Zap size={13} className="text-cyan-400" />
                   <span>Flash Profile to XIM4</span>
                 </button>

                 {/* 4. Download Android APK (.zip) */}
                 <button
                   onClick={() => {
                     setShowSidebarOptionsMenu(false);
                     setShowAndroidApkModal(true);
                   }}
                   className="w-full py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 rounded-lg text-[9px] text-emerald-300 font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.12)]"
                 >
                   <Smartphone size={13} className="text-emerald-400" />
                   <span>{ximService.isNativeAndroidApp() ? 'Native Android SPP Active' : 'Download Android APK (.zip)'}</span>
                 </button>

                 {/* 5. Diagnostics Toggle & Connected Device Status */}
                 {deviceName && deviceState === 'connected' ? (
                   <div className="text-center pt-1 space-y-2 border-t border-white/10">
                     <div className="text-[9px] text-cyan-400 font-mono tracking-widest uppercase">
                       {deviceName}
                     </div>

                     <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                       <div className="flex items-center justify-between mb-1">
                          <span className="text-[8px] text-slate-400 uppercase tracking-widest font-bold">Diagnostics</span>
                          <button 
                            onClick={() => setDiagnosticsEnabled(!diagnosticsEnabled)}
                            className={`text-[8px] border px-3 py-1 rounded transition-colors uppercase font-black ${diagnosticsEnabled ? 'bg-cyan-500 border-cyan-500 text-black' : 'text-slate-400 border-white/20 hover:bg-white/10'}`}
                          >
                            {diagnosticsEnabled ? 'ON' : 'OFF'}
                          </button>
                       </div>
                       <p className="text-[8px] text-slate-500 leading-tight text-left">
                         {diagnosticsEnabled ? 'Check F12 console for raw HID data' : 'Enable to troubleshoot mapping'}
                       </p>
                     </div>

                     <button 
                        onClick={() => { 
                          ximService.disconnect();
                          setDeviceState('disconnected'); 
                          setDeviceName(null); 
                        }}
                        className="w-full py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[8px] text-red-500 hover:bg-red-500/20 transition-colors uppercase tracking-widest font-bold"
                      >
                       Disconnect XIM
                     </button>
                   </div>
                 ) : (
                   <div className="flex items-center justify-between px-2.5 bg-white/5 py-2 rounded-lg border border-white/10">
                      <span className="text-[8px] text-slate-400 uppercase tracking-widest font-bold">Diagnostics</span>
                      <button 
                        onClick={() => setDiagnosticsEnabled(!diagnosticsEnabled)}
                        className={`text-[8px] border px-3 py-1 rounded transition-colors uppercase font-black ${diagnosticsEnabled ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'text-slate-400 border-white/20 hover:bg-white/10'}`}
                      >
                        {diagnosticsEnabled ? 'ACTIVE' : 'INACTIVE'}
                      </button>
                   </div>
                 )}
               </div>
             </>
           )}

           <button
             onClick={() => setShowSidebarOptionsMenu(prev => !prev)}
             className={`w-full py-3.5 px-4 rounded-lg text-[10px] uppercase tracking-[0.2em] font-bold flex items-center justify-between transition-all border ${
               showSidebarOptionsMenu
                 ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                 : 'bg-white/5 hover:bg-white/10 text-slate-200 border-cyan-500/30 hover:border-cyan-500/50'
             }`}
           >
             <span className="flex items-center gap-2">
               <Settings size={14} className={showSidebarOptionsMenu ? 'text-black' : 'text-cyan-400'} />
               <span>Options</span>
               {deviceState === 'connected' && (
                 <span
                   className={`w-2 h-2 rounded-full ${
                     showSidebarOptionsMenu ? 'bg-black' : 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)]'
                   }`}
                   title={`Connected: ${deviceName || 'XIM4'}`}
                 />
               )}
             </span>
             {showSidebarOptionsMenu ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
           </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-2 md:p-6 flex flex-col overflow-hidden w-full">
        <section className="flex-1 bg-[#0c0d10] border border-cyan-500/40 rounded-xl flex flex-col relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          
          {/* Top bar / Header */}
          <div className="min-h-24 py-4 md:py-0 border-b border-cyan-500/20 flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-8 shrink-0 relative z-10 bg-black/20 gap-4">
            <div className="flex flex-row items-center gap-3 w-full md:w-auto">
              <button className="md:hidden text-cyan-500 hover:text-cyan-400 p-1 bg-cyan-500/10 rounded border border-cyan-500/20" onClick={() => setMobileMenuOpen(true)}>
                <Menu size={20} />
              </button>
              <div className="flex flex-col gap-1 md:gap-2 w-full min-w-0">
                <div className="flex items-center justify-between md:justify-start gap-2 w-full">
                  <input 
                    type="text" 
                    value={activeProfile.game}
                    onChange={(e) => updateActiveProfile({ game: e.target.value })}
                    className="bg-transparent border-none text-xl md:text-2xl font-bold tracking-tighter focus:outline-none text-white placeholder-slate-600 m-0 p-0 w-full min-w-0 truncate"
                    placeholder="Game Name"
                  />
                </div>
                <div className="flex gap-4 items-center mt-1 md:mt-0">
                  <p className="text-slate-500 text-[8px] md:text-[9px] font-mono uppercase tracking-widest flex items-center">Active Configuration</p>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-500 hover:text-white transition-colors text-[8px] md:text-[9px] font-mono uppercase tracking-widest">
                     Hotkey:
                     <button
                           className="text-cyan-400 font-bold bg-white/5 border border-white/10 px-1.5 py-0.5 rounded outline-none hover:bg-white/10"
                           onClick={() => setActiveBindingCapture({ id: 'config-hotkey', actionName: 'Config Hotkey', tempKey: activeProfile.hotkey || 'None', group: 'primary' })}
                     >{activeProfile.hotkey || 'None'}</button>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-500 hover:text-white transition-colors text-[8px] md:text-[9px] font-mono uppercase tracking-widest whitespace-nowrap">
                     Color:
                     <div className="relative w-4 h-4 rounded overflow-hidden shadow">
                       <input type="color" value={activeProfile.color || '#ff0000'} onChange={(e) => updateActiveProfile({ color: e.target.value })} className="absolute -inset-2 w-8 h-8 cursor-pointer" />
                     </div>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] items-center">
              {syncFeedback && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 animate-pulse shrink-0">
                  <Activity size={12} />
                  <span>{syncFeedback}</span>
                </div>
              )}

              <button 
                onClick={() => setShowFlashModal(true)}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-[9px] uppercase tracking-widest px-3 md:px-4 py-2.5 md:py-2 rounded flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all whitespace-nowrap"
                title="Flash Smart Translator and Keybinds directly to XIM4 Memory Slot"
              >
                <Zap size={14} className="fill-black" />
                <span>FLASH TO XIM4</span>
              </button>

              <button 
                onClick={() => setShowTroubleshooterModal(true)}
                className="bg-cyan-500/10 border border-cyan-500/30 rounded text-[9px] uppercase font-bold tracking-widest px-3 md:px-4 py-2.5 md:py-2 flex items-center gap-1.5 hover:bg-cyan-500/20 text-cyan-400 transition-colors whitespace-nowrap"
                title="Open Xbox and XIM Hardware Troubleshooter"
              >
                <HelpCircle size={14} /> <span className="hidden sm:inline">SETUP GUIDE</span>
              </button>

              <button 
                onClick={() => updateActiveProfile({ isFavorite: !activeProfile.isFavorite })}
                className={`bg-white/5 border border-white/10 rounded text-[9px] uppercase font-bold tracking-widest px-3 md:px-4 py-2.5 md:py-2 flex items-center gap-2 hover:bg-white/10 transition-colors whitespace-nowrap ${activeProfile.isFavorite ? 'text-yellow-400' : 'text-slate-300'}`} 
                title="Favorite"
              >
                <Star size={14} className={activeProfile.isFavorite ? 'fill-yellow-400' : ''} /> <span className="hidden sm:inline">FAVOURITE</span>
              </button>
              <button 
                className="bg-white/5 border border-white/10 rounded text-red-400 hover:text-red-300 hover:bg-red-900/20 px-3 md:px-4 py-2.5 md:py-2 flex items-center gap-2 md:ml-1 transition-colors shrink-0"
                onClick={async () => {
                  if (profiles.length <= 1) return;
                  const remaining = profiles.filter(p => p.id !== activeProfile.id);
                  setProfiles(remaining);
                  setActiveProfileId(remaining[0].id);
                  if (user) {
                    try {
                      await deleteDoc(doc(db, `users/${user.uid}/configs`, activeProfile.id));
                    } catch(e) {
                      handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/configs/${activeProfile.id}`);
                    }
                  }
                }}
              >
                <Trash2 size={14} />
              </button>
              {user && (
                <button 
                  className="bg-white/5 border border-white/10 rounded text-slate-400 hover:text-slate-300 hover:bg-white/10 px-3 md:px-4 py-2.5 md:py-2 flex items-center gap-2 md:ml-1 transition-colors shrink-0"
                  onClick={() => {
                    localStorage.removeItem('xim_standalone_mode');
                    setIsOfflineMode(false);
                    signOut(auth);
                  }}
                  title="Log Out"
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-white/5 shrink-0 bg-transparent relative z-10 px-2 md:px-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
            {(['HIP', 'ADS', 'BUTTONS'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 md:px-8 py-4 text-[9px] md:text-[10px] uppercase font-bold tracking-[0.2em] flex items-center gap-2 relative transition-colors whitespace-nowrap ${
                  activeTab === tab ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab === 'HIP' ? <Mouse size={14} /> : tab === 'ADS' ? <Settings size={14} /> : <Keyboard size={14} />}
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                )}
              </button>
            ))}
          </div>

        {/* Setting Content Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 w-full custom-scrollbar">
          <div className="w-full max-w-5xl mx-auto flex h-full">
            {activeTab === 'BUTTONS' ? (
              <div className="w-full flex flex-col gap-8">
                <div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4">
                    <div className="flex flex-col gap-2">
                       <h2 className="text-xl font-bold tracking-tight text-white m-0 leading-none">
                          {activeBindingTab === 'primary' 
                            ? (activeProfile.game === 'Grand Theft Auto V' ? 'On Foot Controls' : 'Primary Controls') 
                            : (activeProfile.game === 'Grand Theft Auto V' ? 'Airplane Controls' : 'Secondary Controls')}
                       </h2>
                       <label className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/70 font-bold">Key Mapping (KBM)</label>
                    </div>
                    
                    <div className="flex items-center gap-1 bg-black/40 border border-white/10 p-1 rounded-lg">
                      <button 
                        onClick={() => setActiveBindingTab('primary')}
                        className={`px-4 py-2 rounded text-[10px] uppercase font-bold tracking-widest transition-colors ${activeBindingTab === 'primary' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white'}`}
                      >
                        Primary
                      </button>
                      <button 
                        onClick={() => setActiveBindingTab('secondary')}
                        className={`px-4 py-2 rounded text-[10px] uppercase font-bold tracking-widest transition-colors ${activeBindingTab === 'secondary' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'text-slate-400 hover:text-white'}`}
                      >
                        Secondary
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                    {activeBindingTab === 'secondary' && (
                      <div className="p-3 bg-cyan-900/20 border border-cyan-500/30 rounded-lg flex flex-col gap-2 group hover:border-cyan-500/50 transition-colors">
                        <label className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold leading-snug">ACTIVATION KEY</label>
                        <div className="flex items-center gap-1.5 sm:gap-2 w-full mt-auto">
                           <span className="text-[10px] uppercase font-bold text-white bg-slate-800 border border-white/5 shadow-sm px-1.5 sm:px-2 py-1.5 rounded text-center tracking-wider outline-none min-w-[2rem] transition-all flex-[4_1_0%]">
                             ACTIVATE
                           </span>
                           <span className="text-[10px] sm:text-xs text-slate-600 shrink-0">→</span>
                           <input 
                             className="bg-black/40 border border-cyan-500/30 rounded px-1.5 sm:px-2 py-1.5 text-center text-[9px] sm:text-[10px] text-cyan-400 font-mono font-bold outline-none focus:border-cyan-500 hover:border-cyan-500/80 uppercase cursor-pointer min-w-[2rem] transition-all flex-[4_1_0%]"
                             value={activeProfile.secondaryActivationKey || 'UNBOUND'}
                             readOnly
                             onClick={() => setActiveBindingCapture({ id: 'activation-key', actionName: 'Secondary Activation Key', tempKey: activeProfile.secondaryActivationKey || 'UNBOUND', group: 'secondary' })}
                           />
                        </div>
                      </div>
                    )}
                    {activeProfile.bindings[activeBindingTab].map((binding) => (
                      <div key={binding.id} className="p-3 bg-slate-900/50 border border-white/10 rounded-lg flex flex-col gap-2 group hover:border-white/20 transition-colors">
                        <textarea 
                          className="text-[10px] uppercase tracking-widest text-cyan-500 font-bold bg-transparent border-none outline-none w-full placeholder:text-slate-600 focus:text-cyan-400 transition-colors resize-none overflow-hidden m-0 p-0 leading-snug"
                          style={{ minHeight: '2.5em', height: '2.5em', wordBreak: 'break-word' }}
                          value={binding.actionName}
                          onChange={(e) => updateBindingField(binding.id, 'actionName', e.target.value, activeBindingTab)}
                          placeholder="ACTION NAME"
                        />
                        <div className="flex items-center gap-1.5 sm:gap-2 w-full mt-auto">
                           <input 
                             className="text-[9px] sm:text-[10px] uppercase font-bold text-white bg-slate-800 border border-white/5 shadow-sm px-1.5 sm:px-2 py-1.5 rounded text-center tracking-wider outline-none focus:border-cyan-500/50 min-w-[2rem] transition-all"
                             style={{ flex: `${Math.max(4, binding.consoleButton.length * 1.1)} 1 0%` }}
                             value={binding.consoleButton}
                             onChange={(e) => updateBindingField(binding.id, 'consoleButton', e.target.value, activeBindingTab)}
                           />
                           <span className="text-[10px] sm:text-xs text-slate-600 shrink-0">→</span>
                           <input 
                             className="bg-black/40 border border-white/5 rounded px-1.5 sm:px-2 py-1.5 text-center text-[9px] sm:text-[10px] text-cyan-400 font-mono font-bold outline-none focus:border-cyan-500/50 hover:border-cyan-500/30 uppercase cursor-pointer min-w-[2rem] transition-all"
                             style={{ flex: `${Math.max(4, binding.pcKey.length)} 1 0%` }}
                             value={binding.pcKey}
                             readOnly
                             onClick={() => setActiveBindingCapture({ id: binding.id, actionName: binding.actionName, tempKey: binding.pcKey, group: activeBindingTab })}
                           />
                           <button 
                             onClick={() => removeBinding(binding.id, activeBindingTab)}
                             className="text-slate-600 hover:text-red-400 transition-colors p-1 shrink-0 ml-auto"
                             title="Remove Mapping"
                           >
                              <Trash2 size={12} className="sm:w-3.5 sm:h-3.5" />
                           </button>
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => addNewBinding(activeBindingTab)}
                      className="p-3 border border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center gap-1 bg-white/5 hover:bg-white/10 transition-colors text-slate-400 group min-h-[4rem]"
                    >
                      <Plus size={16} className="group-hover:text-cyan-400 transition-colors" />
                      <span className="text-[9px] font-bold uppercase tracking-widest group-hover:text-cyan-400 transition-colors">Add Mapping</span>
                    </button>
                  </div>
                </div>

                {(activeBindingTab === 'primary' ? DEFAULT_PC_CONTROLS[activeProfile.game] : DEFAULT_PC_SECONDARY_CONTROLS[activeProfile.game]) && (
                  <div className="pt-8 border-t border-white/10">
                    <h3 className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/70 font-bold mb-4">PC Default Controls Reference</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                       {Object.entries(activeBindingTab === 'primary' ? DEFAULT_PC_CONTROLS[activeProfile.game] : DEFAULT_PC_SECONDARY_CONTROLS[activeProfile.game]).map(([action, key]) => (
                         <div key={action} className="px-4 py-3 bg-white/5 border border-white/5 rounded-lg flex flex-col gap-1 opacity-70 hover:opacity-100 transition-opacity">
                            <span className="text-[9px] uppercase tracking-wider text-cyan-400 font-bold">{action}</span>
                            <span className="text-xs text-white font-mono font-bold uppercase">{key}</span>
                         </div>
                       ))}
                    </div>
                  </div>
                )}

                {activeProfile.console !== 'PC' && (activeBindingTab === 'primary' ? DEFAULT_CONSOLE_CONTROLS[activeProfile.game]?.[activeProfile.console] : DEFAULT_CONSOLE_SECONDARY_CONTROLS[activeProfile.game]?.[activeProfile.console]) && (
                  <div className="pt-8 border-t border-white/10">
                    <h3 className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/70 font-bold mb-4">{activeProfile.console} Default Controls Reference</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                       {Object.entries((activeBindingTab === 'primary' ? DEFAULT_CONSOLE_CONTROLS[activeProfile.game]?.[activeProfile.console] : DEFAULT_CONSOLE_SECONDARY_CONTROLS[activeProfile.game]?.[activeProfile.console]) || {}).map(([action, key]) => (
                         <div key={action} className="px-4 py-3 bg-white/5 border border-white/5 rounded-lg flex flex-col gap-1 opacity-70 hover:opacity-100 transition-opacity">
                            <span className="text-[9px] uppercase tracking-wider text-cyan-400 font-bold">{action}</span>
                            <span className="text-xs text-white font-mono font-bold uppercase">{key}</span>
                         </div>
                       ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
                {/* Aim Settings Column */}
                <div className="space-y-6">
                    <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mb-4">Core Parameters</h3>
                    <div className="bg-black/20 p-5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-[10px] uppercase tracking-[0.2em] text-cyan-500 font-bold">Sensitivity Value</label>
                            <div className="flex items-center group relative bg-slate-900/40 rounded-lg p-1 px-2 border border-white/5 hover:border-cyan-500/30 transition-all">
                                <input 
                                    type="number"
                                    min="0" step="0.01"
                                    value={activeProfile[activeTab.toLowerCase() as 'hip'|'ads'].sensitivity}
                                    onChange={(e) => updateSettings(activeTab.toLowerCase() as 'hip'|'ads', 'sensitivity', parseFloat(e.target.value) || 0)}
                                    className="bg-transparent border-none text-cyan-400 font-mono text-3xl font-light focus:outline-none text-right w-24 md:w-36 py-0 pl-0 pr-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all"
                                />
                                <div className="flex flex-col items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => updateSettings(activeTab.toLowerCase() as 'hip'|'ads', 'sensitivity', Math.max(0, parseFloat((activeProfile[activeTab.toLowerCase() as 'hip'|'ads'].sensitivity + 0.1).toFixed(2))))}
                                        className="text-slate-400 hover:text-cyan-400 active:scale-125 transition-all p-0.5"
                                    >
                                        <ChevronUp size={18} strokeWidth={3} />
                                    </button>
                                    <button 
                                        onClick={() => updateSettings(activeTab.toLowerCase() as 'hip'|'ads', 'sensitivity', Math.max(0, parseFloat((activeProfile[activeTab.toLowerCase() as 'hip'|'ads'].sensitivity - 0.1).toFixed(2))))}
                                        className="text-slate-400 hover:text-cyan-400 active:scale-125 transition-all p-0.5"
                                    >
                                        <ChevronDown size={18} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <input 
                          type="range" 
                          min="0.1" max="100" step="0.1"
                          value={activeProfile[activeTab.toLowerCase() as 'hip'|'ads'].sensitivity}
                          onChange={(e) => updateSettings(activeTab.toLowerCase() as 'hip'|'ads', 'sensitivity', parseFloat(e.target.value))}
                          className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#121418] border border-white/5 p-4 rounded-lg flex flex-col gap-2">
                           <label className="text-[9px] uppercase text-slate-500 tracking-widest">
                             Sync Pattern
                           </label>
                           <select 
                             value={activeProfile[activeTab.toLowerCase() as 'hip'|'ads'].synchronize}
                             onChange={(e) => updateSettings(activeTab.toLowerCase() as 'hip'|'ads', 'synchronize', e.target.value)}
                             className="bg-black/50 text-white font-mono text-sm border border-white/10 rounded p-2 outline-none"
                           >
                             <option>Off</option>
                             <option>Default</option>
                             <option>Common</option>
                             <option>Slow</option>
                           </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#121418] border border-white/5 p-4 rounded-lg flex flex-col gap-2">
                           <label className="text-[9px] uppercase text-slate-500 tracking-widest flex justify-between">
                             <span>Smoothing</span>
                             <span className="text-white font-mono">{activeProfile[activeTab.toLowerCase() as 'hip'|'ads'].smoothing}</span>
                           </label>
                           <input 
                             type="range" 
                             min="0" max="20"
                             value={activeProfile[activeTab.toLowerCase() as 'hip'|'ads'].smoothing}
                             onChange={(e) => updateSettings(activeTab.toLowerCase() as 'hip'|'ads', 'smoothing', parseInt(e.target.value))}
                             className="w-full accent-slate-400 mt-2"
                           />
                        </div>

                        <div className="bg-[#121418] border border-white/5 p-4 rounded-lg flex flex-col gap-2">
                           <label className="text-[9px] uppercase text-slate-500 tracking-widest flex justify-between">
                             <span>YX Ratio</span>
                             <span className="text-white font-mono">{activeProfile[activeTab.toLowerCase() as 'hip'|'ads'].yxRatio?.toFixed(2) || '1.00'}</span>
                           </label>
                           <input 
                             type="range" 
                             min="0.5" max="2.0" step="0.01"
                             value={activeProfile[activeTab.toLowerCase() as 'hip'|'ads'].yxRatio || 1.0}
                             onChange={(e) => updateSettings(activeTab.toLowerCase() as 'hip'|'ads', 'yxRatio', parseFloat(e.target.value))}
                             className="w-full accent-slate-400 mt-2"
                           />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#121418] border border-white/5 p-4 rounded-lg flex flex-col gap-2">
                           <label className="text-[9px] uppercase text-slate-500 tracking-widest flex justify-between">
                             <span>Boost</span>
                             <span className="text-white font-mono">{activeProfile[activeTab.toLowerCase() as 'hip'|'ads'].boost || 0}</span>
                           </label>
                           <input 
                             type="range" 
                             min="0" max="1000" step="10"
                             value={activeProfile[activeTab.toLowerCase() as 'hip'|'ads'].boost || 0}
                             onChange={(e) => updateSettings(activeTab.toLowerCase() as 'hip'|'ads', 'boost', parseInt(e.target.value))}
                             className="w-full accent-slate-400 mt-2"
                           />
                        </div>

                        <div className="bg-[#121418] border border-white/5 p-4 rounded-lg flex flex-col justify-center gap-3">
                           <label className="flex items-center gap-2 cursor-pointer group">
                             <input type="checkbox" checked={activeProfile[activeTab.toLowerCase() as 'hip'|'ads'].invertVertical || false} onChange={(e) => updateSettings(activeTab.toLowerCase() as 'hip'|'ads', 'invertVertical', e.target.checked)} className="accent-cyan-500" />
                             <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold group-hover:text-white transition-colors">Invert Vertical</span>
                           </label>
                           <label className="flex items-center gap-2 cursor-pointer group">
                             <input type="checkbox" checked={activeProfile[activeTab.toLowerCase() as 'hip'|'ads'].leftStick || false} onChange={(e) => updateSettings(activeTab.toLowerCase() as 'hip'|'ads', 'leftStick', e.target.checked)} className="accent-cyan-500" />
                             <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold group-hover:text-white transition-colors">Left Stick Aim</span>
                           </label>
                        </div>
                    </div>

                    {activeTab === 'ADS' && (
                        <div className="bg-cyan-900/10 border border-cyan-500/20 p-4 rounded-lg mt-4">
                           <h4 className="text-[9px] uppercase tracking-widest text-cyan-500 font-bold mb-3 flex items-center justify-between">
                             <span>Activation</span>
                             <label className="flex items-center gap-2 cursor-pointer group normal-case">
                               <input type="checkbox" checked={activeProfile.ads.inheritButtons || true} onChange={(e) => updateSettings('ads', 'inheritButtons', e.target.checked)} className="accent-cyan-500" />
                               <span className="text-[8px] uppercase tracking-widest text-slate-400 group-hover:text-cyan-400 transition-colors">Inherit Primary</span>
                             </label>
                           </h4>
                           <div className="grid grid-cols-2 gap-4">
                               <div className="flex flex-col gap-2">
                                  <label className="text-[8px] uppercase text-slate-500 tracking-widest">Activation Key</label>
                                  <input 
                                     type="text" 
                                     className="bg-black/40 border border-white/10 rounded px-3 py-2 text-[10px] text-cyan-400 font-mono focus:border-cyan-500 outline-none uppercase cursor-pointer"
                                     value={activeProfile.ads?.activationKey || 'None'}
                                     readOnly
                                     onClick={() => setActiveBindingCapture({ id: 'ads-activation-key', actionName: 'ADS Activation', tempKey: activeProfile.ads?.activationKey || 'None', group: 'primary' })}
                                  />
                               </div>
                               <div className="flex flex-col gap-2">
                                  <label className="text-[8px] uppercase text-slate-500 tracking-widest flex justify-between">
                                    <span>Delay (ms)</span>
                                    <span className="text-white font-mono">{activeProfile.ads?.activationDelay || 0}</span>
                                  </label>
                                  <input 
                                     type="range" 
                                     min="0" max="1000" step="10"
                                     value={activeProfile.ads?.activationDelay || 0}
                                     onChange={(e) => updateSettings('ads', 'activationDelay', parseInt(e.target.value))}
                                     className="w-full accent-cyan-500 mt-2"
                                  />
                               </div>
                           </div>
                        </div>
                    )}
                </div>

                {/* Aim Curve Column */}
                <div className="flex flex-col h-full space-y-4">
                    <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold">Ballistic Response Curve</h3>
                    <div className="bg-[#090a0c] border border-white/10 rounded-lg p-5 flex flex-col flex-1 min-h-[250px]">
                      <div className="flex-1 bg-black/50 border border-white/5 rounded relative overflow-hidden flex items-end">
                          <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 opacity-20 pointer-events-none">
                            {Array.from({ length: 16 }).map((_, i) => (
                              <div key={i} className="border-r border-t border-white/20" />
                            ))}
                          </div>
                          <div className="absolute inset-0 flex items-end opacity-80">
                            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                               <path 
                                d={`M0,100 ${activeProfile[activeTab.toLowerCase() as 'hip'|'ads'].curve.map((val, idx) => `L${(idx*100/20)},${100 - val}`).join(' ')} L100,100 Z`}
                                fill="rgba(6,182,212,0.1)"
                               />
                              <polyline 
                                points={activeProfile[activeTab.toLowerCase() as 'hip'|'ads'].curve.map((val, idx) => `${(idx*100/20)},${100 - val}`).join(' ')} 
                                fill="none" 
                                stroke="#06b6d4" 
                                strokeWidth="1.5"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-[10px] uppercase tracking-widest text-cyan-500/50 font-bold bg-black/40 px-3 py-1 rounded backdrop-blur-sm">View Only</span>
                          </div>
                      </div>
                      
                      <div className="mt-4 flex gap-3">
                          <button className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 py-2.5 rounded text-[9px] uppercase font-bold text-slate-300 tracking-widest transition-colors">Edit Curve</button>
                          <button onClick={() => {
                             const curveStr = `>>> XIM4 START Paste >>>\n${btoa(JSON.stringify(activeProfile[activeTab.toLowerCase() as 'hip'|'ads'].curve))}\n<<< XIM4 END Paste <<<`;
                             navigator.clipboard.writeText(curveStr);
                             alert("Curve copied to clipboard!");
                          }} className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 py-2.5 rounded text-[9px] uppercase font-bold text-slate-300 tracking-widest transition-colors">Copy Code</button>
                          <button onClick={() => {
                             navigator.clipboard.readText().then(text => {
                                if (text.includes(">>> XIM4 START Paste >>>")) {
                                   try {
                                      const base64Str = text.split(">>> XIM4 START Paste >>>")[1].split("<<< XIM4 END Paste <<<")[0].trim();
                                      const curve = JSON.parse(atob(base64Str));
                                      if (Array.isArray(curve) && curve.length === 21) {
                                         updateSettings(activeTab.toLowerCase() as 'hip'|'ads', 'curve', curve);
                                         alert("Curve imported successfully!");
                                      } else {
                                         alert("Invalid curve data format.");
                                      }
                                   } catch(e) {
                                      alert("Failed to parse curve.");
                                   }
                                } else {
                                   alert("No valid curve data found in clipboard.");
                                }
                             });
                          }} className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 py-2.5 rounded text-[9px] uppercase font-bold text-slate-300 tracking-widest transition-colors">Paste Code</button>
                      </div>
                    </div>
                </div>

              </div>
            )}
          </div>
        </div>
        </section>
      </div>

      {/* Input Capture Modal */}
      {activeBindingCapture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 md:p-4 overflow-hidden">
          <div className="bg-[#0c0d10] border border-cyan-500/30 rounded-xl p-4 md:p-6 lg:p-8 max-w-2xl w-full max-h-[98vh] shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col items-center overflow-y-auto custom-scrollbar">
            <div className="text-center mb-4">
              <h3 className="text-cyan-500 text-[10px] uppercase tracking-[0.2em] font-bold mb-1">Listening for input...</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Press your hardware key, or tap a key below to map <br />
                <span className="font-bold text-white text-base">"{activeBindingCapture.actionName}"</span>
              </p>
            </div>

            {deviceState === 'connected' && (
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded p-2 mb-4 w-full text-center">
                <span className="text-[9px] text-cyan-400 uppercase tracking-widest block font-bold">Hardware Capture Active</span>
                <span className="text-[10px] text-cyan-500/70 leading-tight block truncate md:whitespace-normal">
                  Signals from {deviceName} enabled.
                </span>
              </div>
            )}
            
            <div className="w-20 h-20 md:w-24 md:h-24 border-2 border-dashed border-cyan-500/50 rounded-lg flex items-center justify-center mb-4 bg-cyan-500/5 relative overflow-hidden shrink-0">
               <span className="text-lg md:text-xl text-white font-mono font-bold relative z-10">{activeBindingCapture.tempKey}</span>
               <div className="absolute inset-0 border-2 border-cyan-400 rounded-lg animate-ping opacity-[0.15]"></div>
            </div>

            {/* On-Screen Keyboard */}
            <div className="w-full mb-4 select-none flex flex-col items-center overflow-x-auto pb-4 custom-scrollbar shrink-0">
              <div className="flex bg-white/5 rounded-t-lg p-1 gap-1 mb-0 border-b border-white/5 w-fit self-start ml-2 md:ml-4">
                <button onClick={() => setKeyboardLayout('main')} className={`px-4 py-2 text-[10px] rounded tracking-wider uppercase font-bold transition-colors ${keyboardLayout === 'main' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}>Main</button>
                <button onClick={() => setKeyboardLayout('numpad')} className={`px-4 py-2 text-[10px] rounded tracking-wider uppercase font-bold transition-colors ${keyboardLayout === 'numpad' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}>Numpad</button>
              </div>
              <div className="flex flex-col gap-1 w-full bg-black/40 p-2 md:p-3 rounded-lg border border-white/5 overflow-x-auto custom-scrollbar">
                 {keyboardLayout === 'main' ? (
                   <div className="min-w-[540px] flex flex-col gap-1 px-1">
                     {/* Row 1 */}
                     <div className="flex justify-center gap-1">
                        {['Esc','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'].map(k => (
                          <button key={k} onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: k } : null)} className="flex-1 min-w-[32px] py-2 px-0.5 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[9px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">{k}</button>
                        ))}
                     </div>
                     {/* Row 2 */}
                     <div className="flex justify-center gap-1">
                        {['~','1','2','3','4','5','6','7','8','9','0','-','=','Backspace'].map(k => (
                          <button key={k} onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: k } : null)} className="flex-1 min-w-[32px] py-3.5 px-0.5 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[10px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50 block truncate">{k === 'Backspace' ? 'Bksp' : k}</button>
                        ))}
                     </div>
                     {/* Row 3 */}
                     <div className="flex justify-center gap-1">
                        <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Tab' } : null)} className="min-w-[44px] py-3.5 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[10px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50 flex-[1.5]">Tab</button>
                        {['Q','W','E','R','T','Y','U','I','O','P','[',']','\\'].map(k => (
                          <button key={k} onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: k } : null)} className="flex-1 min-w-[32px] py-3.5 px-0.5 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[10px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">{k}</button>
                        ))}
                     </div>
                     {/* Row 4 */}
                     <div className="flex justify-center gap-1">
                        <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Caps' } : null)} className="min-w-[44px] py-3.5 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[10px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50 flex-[2]">Caps</button>
                        {['A','S','D','F','G','H','J','K','L',';',"'",'Enter'].map(k => (
                          <button key={k} onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: k } : null)} className={`${k === 'Enter' ? 'flex-[2] min-w-[54px]' : 'flex-1 min-w-[32px]'} py-3.5 px-0.5 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[10px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50 block truncate`}>{k}</button>
                        ))}
                     </div>
                     {/* Row 5 */}
                     <div className="flex justify-center gap-1">
                        <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Shift' } : null)} className="min-w-[54px] py-3.5 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[10px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50 flex-[2.5]">Shift</button>
                        {['Z','X','C','V','B','N','M',',','.','/'].map(k => (
                          <button key={k} onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: k } : null)} className="flex-1 min-w-[32px] py-3.5 px-0.5 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[10px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">{k}</button>
                        ))}
                        <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Shift' } : null)} className="min-w-[54px] py-3.5 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[10px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50 flex-[2.5]">Shift</button>
                     </div>
                     {/* Row 6 */}
                     <div className="flex justify-center gap-1">
                        <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Ctrl' } : null)} className="min-w-[40px] flex-[1.5] py-3.5 px-0.5 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[10px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">Ctrl</button>
                        <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Win' } : null)} className="min-w-[40px] flex-[1.5] py-3.5 px-0.5 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[10px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">Win</button>
                        <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Alt' } : null)} className="min-w-[40px] flex-[1.5] py-3.5 px-0.5 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[10px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">Alt</button>
                        <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Space' } : null)} className="min-w-[100px] flex-[6] py-3.5 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[10px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">Space</button>
                        <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Alt' } : null)} className="min-w-[40px] flex-[1.5] py-3.5 px-0.5 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[10px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">Alt</button>
                        <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Fn' } : null)} className="min-w-[40px] flex-[1.5] py-3.5 px-0.5 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[10px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">Fn</button>
                        <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Ctrl' } : null)} className="min-w-[40px] flex-[1.5] py-3.5 px-0.5 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[10px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">Ctrl</button>
                     </div>
                     {/* Mouse Row */}
                     <div className="flex justify-center gap-1 mt-1 pt-2 border-t border-white/10">
                        {['Mouse L', 'Mouse M', 'Mouse R', 'Mouse 4', 'Mouse 5', 'Wheel Up', 'Wheel Down'].map(k => (
                          <button key={k} onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: k === 'Wheel Up' ? 'MWheel Up' : k === 'Wheel Down' ? 'MWheel Down' : k } : null)} className="flex-1 min-w-[54px] md:min-w-[60px] md:flex-1 py-3 px-1 bg-cyan-500/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-cyan-500/20 rounded text-[9px] text-cyan-400 font-mono transition-colors hover:border-cyan-500/50 whitespace-nowrap">{k}</button>
                        ))}
                     </div>
                   </div>
                 ) : (
                   <div className="flex justify-center p-2 md:p-4">
                      <div className="grid grid-cols-4 gap-1.5 w-[200px]">
                         <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Numpad Lock' } : null)} className="col-span-1 py-4 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[9px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50 break-words leading-tight">Num<br/>Lk</button>
                         <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Numpad /' } : null)} className="col-span-1 py-4 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[14px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">/</button>
                         <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Numpad *' } : null)} className="col-span-1 py-4 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[14px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">*</button>
                         <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Numpad -' } : null)} className="col-span-1 py-4 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[14px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">-</button>
                         
                         <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Numpad 7' } : null)} className="col-span-1 py-4 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[12px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">7</button>
                         <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Numpad 8' } : null)} className="col-span-1 py-4 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[12px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">8</button>
                         <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Numpad 9' } : null)} className="col-span-1 py-4 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[12px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">9</button>
                         <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Numpad +' } : null)} className="col-span-1 row-span-2 py-4 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[14px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">+</button>

                         <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Numpad 4' } : null)} className="col-span-1 py-4 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[12px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">4</button>
                         <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Numpad 5' } : null)} className="col-span-1 py-4 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[12px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">5</button>
                         <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Numpad 6' } : null)} className="col-span-1 py-4 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[12px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">6</button>
                         
                         <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Numpad 1' } : null)} className="col-span-1 py-4 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[12px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">1</button>
                         <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Numpad 2' } : null)} className="col-span-1 py-4 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[12px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">2</button>
                         <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Numpad 3' } : null)} className="col-span-1 py-4 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[12px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">3</button>
                         <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Numpad Enter' } : null)} className="col-span-1 row-span-2 py-4 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[9px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">Enter</button>

                         <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Numpad 0' } : null)} className="col-span-2 py-4 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[12px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">0</button>
                         <button onClick={() => setActiveBindingCapture(prev => prev ? { ...prev, tempKey: 'Numpad .' } : null)} className="col-span-1 py-4 px-1 bg-white/5 hover:bg-cyan-500/20 active:bg-cyan-500/40 border border-white/10 rounded text-[14px] text-slate-300 font-mono transition-colors hover:border-cyan-500/50">.</button>
                      </div>
                   </div>
                 )}
              </div>
            </div>
            
            <div className="flex gap-4 w-full mt-auto">
              <button 
                 onClick={() => setActiveBindingCapture(null)}
                 className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] uppercase tracking-widest font-bold rounded transition-colors"
               >
                Cancel
              </button>
              <button 
                 onClick={() => {
                   if (activeBindingCapture.id === 'activation-key') {
                     updateActiveProfile({ secondaryActivationKey: activeBindingCapture.tempKey });
                   } else if (activeBindingCapture.id === 'config-hotkey') {
                     updateActiveProfile({ hotkey: activeBindingCapture.tempKey });
                   } else if (activeBindingCapture.id === 'ads-activation-key') {
                     updateActiveProfile({ ads: { ...activeProfile.ads, activationKey: activeBindingCapture.tempKey } });
                   } else {
                     updateBindingField(activeBindingCapture.id, 'pcKey', activeBindingCapture.tempKey, activeBindingCapture.group);
                   }
                   setActiveBindingCapture(null);
                 }}
                 className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-black text-[10px] uppercase tracking-widest font-bold rounded shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bluetooth Scan Modal */}
      {showScanModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-hidden">
          <div className="bg-[#0c0d10] border border-cyan-500/30 rounded-2xl p-5 sm:p-8 max-w-md w-full max-h-[90dvh] shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col items-center relative overflow-y-auto custom-scrollbar">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
            
            {/* Close Button top-right for easy mobile exit */}
            <button
              onClick={() => setShowScanModal(false)}
              className="absolute top-3.5 right-3.5 z-20 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            {/* Radar Animation */}
            <div className="relative w-24 h-24 sm:w-36 sm:h-36 flex items-center justify-center mb-4 sm:mb-6 mt-1 sm:mt-2 shrink-0 overflow-hidden rounded-full">
               <div className="absolute inset-0 rounded-full border border-cyan-500/10"></div>
               <div className="absolute inset-3 sm:inset-4 rounded-full border border-cyan-500/10"></div>
               <div className="absolute inset-6 sm:inset-8 rounded-full border border-cyan-500/20"></div>
               <div className="w-10 h-10 sm:w-12 sm:h-12 bg-cyan-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.6)] relative z-10">
                 <Bluetooth className="text-black animate-pulse" size={20} />
               </div>
               <div className="absolute inset-[-50%] animate-[spin_4s_linear_infinite] origin-center opacity-70 pointer-events-none" style={{ background: 'conic-gradient(from 0deg, transparent 0deg 270deg, rgba(6,182,212,0.4) 360deg)', borderRadius: '50%'}}></div>
            </div>

            <h2 className="text-lg sm:text-xl text-white font-mono uppercase tracking-widest font-bold mb-1.5 relative z-10 text-center drop-shadow-[0_0_10px_rgba(6,182,212,0.5)] shrink-0">Scanning nearby</h2>
            <p className="text-[10px] text-slate-400 text-center mb-5 sm:mb-6 uppercase tracking-[0.2em] relative z-10 leading-relaxed font-semibold shrink-0">
              Ensure your device is powered on.<br />
              <span className="text-white mt-0.5 block opacity-70 normal-case tracking-normal font-sans font-normal text-xs sm:text-sm">Press the pairing button until it flashes <span className="text-cyan-400 font-bold uppercase font-mono text-xs">CYAN</span>.</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 w-full relative z-10 shrink-0">
              <button 
                 onClick={processSerialConnection}
                 className="py-3 px-3 bg-cyan-500 hover:bg-cyan-400 text-black text-[10px] uppercase tracking-widest font-bold rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all flex flex-col justify-center items-center gap-0.5"
              >
                <div className="flex items-center gap-1.5">
                  <Bluetooth size={14} />
                  <span>Bluetooth Classic SPP</span>
                </div>
                <span className="text-[8px] text-black/80 normal-case tracking-normal font-semibold">Recommended for XIM4 (Write Enabled)</span>
              </button>

              <button 
                 onClick={processWebUSBConnection}
                 className="py-3 px-3 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-[10px] uppercase tracking-widest font-bold rounded-lg transition-all flex flex-col justify-center items-center gap-0.5"
              >
                <div className="flex items-center gap-1.5">
                  <Usb size={14} className="text-cyan-400" />
                  <span>USB-OTG / WebUSB</span>
                </div>
                <span className="text-[8px] text-cyan-400/70 normal-case tracking-normal font-normal">Direct Cable to Phone or PC</span>
              </button>

              <button 
                 onClick={processBluetoothConnection}
                 className="py-2.5 sm:py-3 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[10px] uppercase tracking-widest font-bold rounded-lg transition-all flex flex-col justify-center items-center gap-0.5"
              >
                <span>Web Bluetooth (BLE)</span>
                <span className="text-[8px] text-slate-500 normal-case tracking-normal font-normal">XIM APEX / BLE Read-Only</span>
              </button>

              <button 
                 onClick={() => setShowScanModal(false)}
                 className="py-2.5 sm:py-3 px-3 bg-black/40 hover:bg-white/5 border border-white/10 text-slate-400 text-[10px] uppercase tracking-widest font-bold rounded-lg transition-colors flex items-center justify-center"
              >
                Cancel
              </button>
            </div>

            {/* Native Android APK (.zip) Banner inside Scan Modal */}
            <div className="w-full mt-3 relative z-10 shrink-0">
              <button
                onClick={() => {
                  setShowScanModal(false);
                  setShowAndroidApkModal(true);
                }}
                className="w-full py-2.5 px-3 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 rounded-lg text-emerald-300 text-[10px] uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-2"
              >
                <Smartphone size={14} className="text-emerald-400 shrink-0" />
                <span>
                  {ximService.isNativeAndroidApp()
                    ? 'Native Android APK SPP Bridge Active'
                    : 'Get Native Android APK (.zip) for Bluetooth SPP'}
                </span>
              </button>
            </div>

            <div className="mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-white/5 w-full relative z-10 shrink-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Standalone XIM4 Web Connection Guide</p>
                <button 
                  onClick={() => {
                    setShowScanModal(false);
                    setShowTroubleshooterModal(true);
                  }}
                  className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider hover:underline whitespace-nowrap shrink-0"
                >
                  Xbox Setup Guide →
                </button>
              </div>
              <ul className="text-[10px] text-slate-400 space-y-1.5 sm:space-y-2 list-disc pl-4 opacity-80 leading-relaxed">
                <li><span className="text-white font-semibold">USB-OTG only showed your Controller?</span> Unplug your controller from Port 3, plug XIM4 into your phone, and press the <b>P button</b> during the rainbow boot sequence (or hold P while plugging in until <b>SOLID BLUE</b>) so XIM4 exposes its own USB Config Port (`0x2387`).</li>
                <li><span className="text-white font-semibold">Want Wireless Bluetooth Classic SPP on Android?</span> Tap <b>Get Native Android APK (.zip)</b> above to install the native Android APK with direct RFCOMM (`0x1101`) XIM4 flashing.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Hardware & Console Troubleshooter Modal */}
      <HardwareTroubleshooterModal 
        isOpen={showTroubleshooterModal}
        onClose={() => setShowTroubleshooterModal(false)}
        deviceState={deviceState}
        deviceName={deviceName}
      />

      {/* Hardware Memory Slot & Smart Translator Flasher Modal */}
      <FlashHardwareModal 
        isOpen={showFlashModal}
        onClose={() => setShowFlashModal(false)}
        profile={activeProfile}
        deviceState={deviceState}
        deviceName={deviceName}
        onConnectSerial={processSerialConnection}
        onConnectWebUSB={processWebUSBConnection}
        onConnectBLE={processBluetoothConnection}
        onOpenApkModal={() => setShowAndroidApkModal(true)}
        onFlashComplete={(slotIdx) => {
          setSyncFeedback(`Slot ${slotIdx + 1} Flashed & Active!`);
          setTimeout(() => setSyncFeedback(null), 4000);
        }}
      />

      {/* Native Android APK (.zip) Download & Cloud Build Modal */}
      <AndroidApkModal
        isOpen={showAndroidApkModal}
        onClose={() => setShowAndroidApkModal(false)}
        onConnectNativeSpp={processSerialConnection}
      />
    </div>
  );
}
