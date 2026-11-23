export enum XimInputSource {
  KEYBOARD = 'keyboard',
  MOUSE = 'mouse',
  JOYSTICK = 'joystick'
}

export interface XimInputEvent {
  source: XimInputSource;
  code: string | number;
  value: number;
}

export interface DiscoveredServiceInfo {
  uuid: string;
  characteristics: {
    uuid: string;
    properties: string[];
  }[];
}

export interface NativePairedBluetoothDevice {
  name: string;
  address: string;
  id?: string;
  class?: number;
}

export interface TransportDiagnostics {
  transportType:
    | 'none'
    | 'native-android-spp'
    | 'web-serial-spp'
    | 'web-usb'
    | 'web-usb-passthrough'
    | 'web-hid'
    | 'ble-xim-writable'
    | 'ble-generic-readonly';
  deviceName: string | null;
  canWriteHardware: boolean;
  discoveredServices: DiscoveredServiceInfo[];
  writableCharacteristicUuid: string | null;
  notifyCharacteristicUuid: string | null;
  usbVendorId: number | null;
  usbProductId: number | null;
  rxPacketsReceived: number;
  lastRxHex: string | null;
  diagnosticNote: string;
}

export const XIM_ALL_OPTIONAL_BLE_SERVICES: string[] = [
  'generic_access',
  'generic_attribute',
  'device_information',
  'battery_service',
  'human_interface_device',
  '00001000-0000-1000-8000-00805f9b34fb',
  'bf283861-de8a-4467-8e65-9856f632320b',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000ffb0-0000-1000-8000-00805f9b34fb',
  '0000ffd0-0000-1000-8000-00805f9b34fb',
  '0000fefb-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '00005500-d102-11e1-9b23-00025b00a5a5',
  '00001101-0000-1000-8000-00805f9b34fb'
];

class XimService {
  private listeners: ((event: XimInputEvent) => void)[] = [];
  private rxListeners: ((hex: string, raw: Uint8Array) => void)[] = [];
  private isCapturing = false;

  private nativeAndroidConnected = false;
  private nativeAndroidAddress: string | null = null;

  private bluetoothServer: any = null;
  private bluetoothWriteChar: any = null;
  private bluetoothNotifyChar: any = null;

  private serialPort: any = null;
  private serialWriter: any = null;
  private serialReader: any = null;

  private usbDevice: any = null;
  private usbInterfaceNumber: number = 0;
  private usbOutEndpoint: number = 0;
  private usbInEndpoint: number = 0;
  private usbReadActive: boolean = false;

  private activeDevice: any = null;
  private activeReportId: number = 0;
  private heartbeatTimer: any = null;

  private transportDiagnostics: TransportDiagnostics = {
    transportType: 'none',
    deviceName: null,
    canWriteHardware: false,
    discoveredServices: [],
    writableCharacteristicUuid: null,
    notifyCharacteristicUuid: null,
    usbVendorId: null,
    usbProductId: null,
    rxPacketsReceived: 0,
    lastRxHex: null,
    diagnosticNote: 'No hardware connected.'
  };

  /**
   * Detects whether we are currently running inside the compiled Capacitor Android APK
   */
  public isNativeAndroidApp(): boolean {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    return !!(
      w.Capacitor?.isNativePlatform?.() ||
      w.Capacitor?.getPlatform?.() === 'android' ||
      w.bluetoothSerial
    );
  }

  public getDiagnostics(): TransportDiagnostics {
    return this.transportDiagnostics;
  }

  public addRxListener(callback: (hex: string, raw: Uint8Array) => void) {
    this.rxListeners.push(callback);
  }

  public removeRxListener(callback: (hex: string, raw: Uint8Array) => void) {
    this.rxListeners = this.rxListeners.filter(l => l !== callback);
  }

  private recordRxBytes(bytes: Uint8Array) {
    if (!bytes || bytes.length === 0) return;
    const hex = Array.from(bytes)
      .slice(0, 32)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    this.transportDiagnostics.rxPacketsReceived += 1;
    this.transportDiagnostics.lastRxHex = hex;
    this.rxListeners.forEach(cb => cb(hex, bytes));
  }

  addListener(callback: (event: XimInputEvent) => void) {
    this.listeners.push(callback);
  }

  removeListener(callback: (event: XimInputEvent) => void) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  startListening() {
    this.isCapturing = true;
    console.log('XIM Service: Started listening for inputs');
  }

  stopListening() {
    this.isCapturing = false;
    console.log('XIM Service: Stopped listening');
  }

  handleHardwareInput(event: XimInputEvent) {
    if (this.isCapturing) {
      this.listeners.forEach(l => l(event));
    }
  }

  public getCustomBleServiceUuids(): string[] {
    try {
      const saved = localStorage.getItem('xim_custom_ble_uuids');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.from(new Set([...XIM_ALL_OPTIONAL_BLE_SERVICES, ...parsed]));
    } catch {
      return XIM_ALL_OPTIONAL_BLE_SERVICES;
    }
  }

  public addCustomBleServiceUuid(uuid: string) {
    const clean = uuid.trim().toLowerCase();
    if (!clean) return;
    try {
      const saved = localStorage.getItem('xim_custom_ble_uuids');
      const parsed: string[] = saved ? JSON.parse(saved) : [];
      if (!parsed.includes(clean)) {
        parsed.push(clean);
        localStorage.setItem('xim_custom_ble_uuids', JSON.stringify(parsed));
      }
    } catch { /* ignore */ }
  }

  /**
   * 0. NATIVE ANDROID CAPACITOR APK TRANSPORT (cordova-plugin-bluetooth-serial):
   * Connects directly over Android OS BluetoothAdapter RFCOMM Socket (SPP UUID 00001101-0000-1000-8000-00805f9b34fb)
   * without any browser sandbox limitations.
   */
  public async listNativeAndroidPairedDevices(): Promise<NativePairedBluetoothDevice[]> {
    const btSerial = (window as any).bluetoothSerial;
    if (!btSerial) {
      throw new Error('Native Android Bluetooth Serial plugin is only available inside the compiled Android APK.');
    }
    return new Promise((resolve, reject) => {
      btSerial.list(
        (devices: NativePairedBluetoothDevice[]) => resolve(devices || []),
        (err: any) => reject(new Error(typeof err === 'string' ? err : 'Failed to list paired Bluetooth devices. Ensure Nearby Devices permission is allowed.'))
      );
    });
  }

  public async connectNativeAndroidSPP(targetMacOrAuto?: string): Promise<TransportDiagnostics> {
    const btSerial = (window as any).bluetoothSerial;
    if (!btSerial) {
      throw new Error(
        'Native Android RFCOMM socket is only available inside the Android APK. Download the Android APK (.zip) from this app, or use USB-OTG / Web Serial in the browser.'
      );
    }

    const devices = await this.listNativeAndroidPairedDevices();
    if (devices.length === 0) {
      throw new Error('No paired Bluetooth devices found. Pair your XIM4 in Android Bluetooth Settings first.');
    }

    // Automatically match XIM4 or use specified MAC address
    const ximDevice =
      (targetMacOrAuto && devices.find(d => d.address === targetMacOrAuto || d.id === targetMacOrAuto)) ||
      devices.find(d => (d.name || '').toUpperCase().includes('XIM')) ||
      devices[0];

    const address = ximDevice.address || ximDevice.id || '';
    if (!address) {
      throw new Error('Could not resolve Bluetooth MAC address for XIM4.');
    }

    await new Promise<void>((resolve, reject) => {
      btSerial.connect(
        address,
        () => resolve(),
        (err: any) => reject(new Error(typeof err === 'string' ? err : `RFCOMM connection to ${ximDevice.name} (${address}) failed.`))
      );
    });

    this.nativeAndroidConnected = true;
    this.nativeAndroidAddress = address;

    // Subscribe to raw byte notifications from the native Android RFCOMM socket
    if (typeof btSerial.subscribeRawData === 'function') {
      btSerial.subscribeRawData(
        (data: ArrayBuffer) => {
          const bytes = new Uint8Array(data);
          this.recordRxBytes(bytes);
          const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          this.debugLogReport(view, 0);
          this.parseReport(view, 0);
        },
        (err: any) => console.warn('Native SPP subscribeRawData error:', err)
      );
    }

    // Send initial wake/handshake over native RFCOMM socket
    await this.sendNativeAndroidCommand(new Uint8Array([0x01, 0x00]));

    this.transportDiagnostics = {
      transportType: 'native-android-spp',
      deviceName: `${ximDevice.name || 'XIM4'} (${address})`,
      canWriteHardware: true,
      discoveredServices: [
        {
          uuid: '00001101-0000-1000-8000-00805f9b34fb (Native Android RFCOMM)',
          characteristics: [
            { uuid: `MAC: ${address}`, properties: ['rfcomm-read', 'rfcomm-write', 'native-apk'] }
          ]
        }
      ],
      writableCharacteristicUuid: `Android Native RFCOMM Socket (${address})`,
      notifyCharacteristicUuid: `Android Native RFCOMM RX Stream`,
      usbVendorId: null,
      usbProductId: null,
      rxPacketsReceived: 0,
      lastRxHex: null,
      diagnosticNote: `Connected via Native Android APK Bluetooth Classic RFCOMM Socket (0x1101) to ${ximDevice.name} (${address}). Full hardware write & EEPROM flash enabled!`
    };

    return this.transportDiagnostics;
  }

  public async sendNativeAndroidCommand(payload: Uint8Array): Promise<boolean> {
    const btSerial = (window as any).bluetoothSerial;
    if (!btSerial || !this.nativeAndroidConnected) return false;
    return new Promise<boolean>((resolve) => {
      btSerial.write(
        payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength),
        () => resolve(true),
        (err: any) => {
          console.warn('Native Android SPP write error:', err);
          resolve(false);
        }
      );
    });
  }

  /**
   * 1. WEB SERIAL API (Bluetooth Classic SPP 0x1101 or USB Serial COM):
   * Automatically routes to Native Android SPP if running inside the Capacitor APK!
   */
  async connectSerial(useBluetoothSppFilter: boolean = true): Promise<TransportDiagnostics> {
    if ((window as any).bluetoothSerial) {
      return this.connectNativeAndroidSPP();
    }

    if (!('serial' in navigator)) {
      throw new Error(
        'Web Serial API is not enabled in this browser. Install our Native Android APK (.zip) for direct Bluetooth Classic SPP, or enable chrome://flags/#enable-experimental-web-platform-features in Chrome.'
      );
    }

    const SPP_UUID = '00001101-0000-1000-8000-00805f9b34fb';

    let port: any = null;
    if (useBluetoothSppFilter) {
      try {
        port = await (navigator as any).serial.requestPort({
          allowedBluetoothServiceClassIds: [SPP_UUID]
        });
      } catch (firstErr: any) {
        if (firstErr?.name === 'NotFoundError' || firstErr?.name === 'AbortError') {
          throw firstErr;
        }
        port = await (navigator as any).serial.requestPort();
      }
    } else {
      port = await (navigator as any).serial.requestPort();
    }

    await port.open({
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      flowControl: 'none'
    });

    this.serialPort = port;
    this.serialWriter = port.writable?.getWriter();

    const info = port.getInfo ? port.getInfo() : {};
    const isBt = !!info.bluetoothServiceClassId;
    const label = isBt
      ? 'XIM4 Bluetooth Classic SPP (0x1101)'
      : info.usbVendorId
        ? `XIM4 USB Serial (VID:0x${info.usbVendorId.toString(16)})`
        : 'XIM4 Serial RFCOMM / COM Port';

    if (port.readable) {
      this.readSerialLoop(port);
    }

    await this.sendSerialCommand(new Uint8Array([0x01, 0x00]));

    this.transportDiagnostics = {
      transportType: 'web-serial-spp',
      deviceName: label,
      canWriteHardware: true,
      discoveredServices: [
        {
          uuid: isBt ? SPP_UUID : 'USB-CDC-Serial',
          characteristics: [
            { uuid: 'RFCOMM-TX-RX', properties: ['read', 'write', 'stream-115200'] }
          ]
        }
      ],
      writableCharacteristicUuid: 'Bluetooth Classic SPP RFCOMM (0x1101) / Serial TX',
      notifyCharacteristicUuid: 'Bluetooth Classic SPP RFCOMM (0x1101) / Serial RX',
      usbVendorId: info.usbVendorId || null,
      usbProductId: info.usbProductId || null,
      rxPacketsReceived: 0,
      lastRxHex: null,
      diagnosticNote:
        'Connected over real Bluetooth Classic SPP / Serial port (115200 baud). Bidirectional byte stream to XIM4 is active and writable.'
    };

    return this.transportDiagnostics;
  }

  private async readSerialLoop(port: any) {
    try {
      this.serialReader = port.readable.getReader();
      while (true) {
        const { value, done } = await this.serialReader.read();
        if (done) break;
        if (value && value.length > 0) {
          this.recordRxBytes(value);
          const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
          this.debugLogReport(view, 1);
          this.parseReport(view, 1);
        }
      }
    } catch (e) {
      console.warn('Serial read loop ended:', e);
    } finally {
      if (this.serialReader) {
        try {
          this.serialReader.releaseLock();
        } catch { /* ignore */ }
        this.serialReader = null;
      }
    }
  }

  async sendSerialCommand(payload: Uint8Array): Promise<boolean> {
    if (!this.serialWriter) return false;
    try {
      await this.serialWriter.write(payload);
      return true;
    } catch (e) {
      console.warn('XIM Serial Write Error:', e);
      return false;
    }
  }

  /**
   * 2. DIRECT WIRED USB TRANSPORT (WebUSB API)
   */
  async connectWebUSB(): Promise<TransportDiagnostics> {
    if (!('usb' in navigator)) {
      throw new Error('WebUSB API is not supported in this browser. Use Google Chrome on Android (via USB-OTG adapter) or Desktop Chrome/Edge.');
    }

    const device = await (navigator as any).usb.requestDevice({
      filters: [
        { vendorId: 0x2387 },
        { vendorId: 0x16d0 },
        { vendorId: 0x045e },
        { vendorId: 0x054c }
      ]
    });

    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    const vid = device.vendorId;
    const pid = device.productId;
    const isControllerSpoof = vid === 0x045e || vid === 0x054c;

    let claimedInterface = -1;
    let outEp = -1;
    let inEp = -1;
    const discoveredUsbInterfaces: DiscoveredServiceInfo[] = [];

    const interfaces = device.configuration?.interfaces || [];
    for (const iface of interfaces) {
      const charList: { uuid: string; properties: string[] }[] = [];
      for (const alt of iface.alternates) {
        const epNames = (alt.endpoints || []).map(
          (ep: any) => `EP${ep.endpointNumber}_${ep.direction.toUpperCase()}_${ep.type}`
        );
        charList.push({
          uuid: `Class:0x${(alt.interfaceClass || 0).toString(16)} Sub:0x${(alt.interfaceSubclass || 0).toString(16)}`,
          properties: epNames.length ? epNames : ['control-only']
        });

        try {
          await device.claimInterface(iface.interfaceNumber);
          if (claimedInterface === -1) claimedInterface = iface.interfaceNumber;

          for (const ep of alt.endpoints || []) {
            if (ep.direction === 'out' && outEp === -1) {
              outEp = ep.endpointNumber;
              claimedInterface = iface.interfaceNumber;
            }
            if (ep.direction === 'in' && inEp === -1) {
              inEp = ep.endpointNumber;
            }
          }
        } catch (claimErr) {
          console.warn(`Could not claim USB interface ${iface.interfaceNumber}:`, claimErr);
        }
      }
      discoveredUsbInterfaces.push({
        uuid: `USB Interface #${iface.interfaceNumber}`,
        characteristics: charList
      });
    }

    this.usbDevice = device;
    this.usbInterfaceNumber = claimedInterface >= 0 ? claimedInterface : 0;
    this.usbOutEndpoint = outEp >= 0 ? outEp : 1;
    this.usbInEndpoint = inEp >= 0 ? inEp : 1;

    if (inEp !== -1) {
      this.startUsbReadLoop();
    }

    if (isControllerSpoof) {
      this.transportDiagnostics = {
        transportType: 'web-usb-passthrough',
        deviceName: `${device.productName || 'Controller'} (Passthrough Spoof Mode — VID:0x${vid.toString(16)})`,
        canWriteHardware: claimedInterface !== -1,
        discoveredServices: discoveredUsbInterfaces,
        writableCharacteristicUuid: claimedInterface !== -1 ? `Passthrough USB Interface #${this.usbInterfaceNumber} (EP OUT #${this.usbOutEndpoint})` : null,
        notifyCharacteristicUuid: inEp !== -1 ? `USB EP IN #${this.usbInEndpoint}` : null,
        usbVendorId: vid,
        usbProductId: pid,
        rxPacketsReceived: 0,
        lastRxHex: null,
        diagnosticNote:
          `WARNING: Your phone detected the Xbox/PlayStation Controller (VID 0x${vid.toString(16)}) instead of the XIM4 Configuration Engine! ` +
          `In normal boot mode, XIM4 disguises its USB port as your controller so the Xbox accepts it. ` +
          `To switch XIM4's USB port into Wired Configuration Mode (VID 0x2387): Unplug the controller from Port 3, plug XIM4 into your phone/PC, and press the 'P' button on the back of the XIM4 during the initial rainbow light sequence (or hold 'P' while plugging in until the light turns SOLID BLUE).`
      };
      return this.transportDiagnostics;
    }

    const writable = claimedInterface !== -1;
    this.transportDiagnostics = {
      transportType: 'web-usb',
      deviceName: device.productName || `XIM4 Config USB (VID:0x${vid.toString(16)} PID:0x${pid.toString(16)})`,
      canWriteHardware: writable,
      discoveredServices: discoveredUsbInterfaces,
      writableCharacteristicUuid: writable ? `WebUSB Interface #${this.usbInterfaceNumber} (EP OUT #${this.usbOutEndpoint})` : null,
      notifyCharacteristicUuid: inEp !== -1 ? `WebUSB EP IN #${this.usbInEndpoint}` : null,
      usbVendorId: vid,
      usbProductId: pid,
      rxPacketsReceived: 0,
      lastRxHex: null,
      diagnosticNote: writable
        ? `True XIM4 USB Configuration Interface active (VID:0x${vid.toString(16)} PID:0x${pid.toString(16)}, Interface #${this.usbInterfaceNumber}, OUT EP #${this.usbOutEndpoint}). Ready to flash!`
        : 'XIM4 USB device detected, but OS kernel driver held the interface.'
    };

    return this.transportDiagnostics;
  }

  private async startUsbReadLoop() {
    if (!this.usbDevice || this.usbReadActive) return;
    this.usbReadActive = true;
    try {
      while (this.usbDevice && this.usbDevice.opened && this.usbReadActive) {
        const res = await this.usbDevice.transferIn(this.usbInEndpoint, 64);
        if (res?.data && res.data.byteLength > 0) {
          const bytes = new Uint8Array(res.data.buffer, res.data.byteOffset, res.data.byteLength);
          this.recordRxBytes(bytes);
          this.debugLogReport(res.data, this.usbInEndpoint);
          this.parseReport(res.data, this.usbInEndpoint);
        }
      }
    } catch (e) {
      console.warn('WebUSB read loop stopped:', e);
    } finally {
      this.usbReadActive = false;
    }
  }

  async sendUsbCommand(payload: Uint8Array): Promise<boolean> {
    if (!this.usbDevice || !this.usbDevice.opened) return false;
    try {
      if (this.usbOutEndpoint > 0) {
        await this.usbDevice.transferOut(this.usbOutEndpoint, payload);
        return true;
      }
    } catch {
      // Fallback to USB vendor control transfer
    }
    try {
      await this.usbDevice.controlTransferOut(
        {
          requestType: 'vendor',
          recipient: 'interface',
          request: 0x09,
          value: 0x0200,
          index: this.usbInterfaceNumber
        },
        payload
      );
      return true;
    } catch (e) {
      console.warn('WebUSB Write Error:', e);
      return false;
    }
  }

  /**
   * 3. WEB BLUETOOTH (BLE GATT)
   */
  async connectBluetooth(device: any): Promise<TransportDiagnostics> {
    const server = await device.gatt?.connect();
    if (!server) throw new Error('Could not connect to GATT server');
    this.bluetoothServer = server;
    this.bluetoothWriteChar = null;
    this.bluetoothNotifyChar = null;

    const discoveredServices: DiscoveredServiceInfo[] = [];

    const STANDARD_READONLY_SERVICES = new Set([
      '00001800-0000-1000-8000-00805f9b34fb',
      '00001801-0000-1000-8000-00805f9b34fb',
      '0000180a-0000-1000-8000-00805f9b34fb',
      '0000180f-0000-1000-8000-00805f9b34fb'
    ]);

    try {
      let services: any[] = [];
      if (typeof server.getPrimaryServices === 'function') {
        try {
          services = await server.getPrimaryServices();
        } catch {
          const candidateServiceUuids = this.getCustomBleServiceUuids();
          for (const uuid of candidateServiceUuids) {
            try {
              const s = await server.getPrimaryService(uuid);
              if (s) services.push(s);
            } catch { /* ignore */ }
          }
        }
      }

      for (const service of services) {
        const sUuid = (service.uuid || '').toLowerCase();
        const charInfos: { uuid: string; properties: string[] }[] = [];

        try {
          const chars = await service.getCharacteristics();
          for (const c of chars) {
            const cUuid = (c.uuid || '').toLowerCase();
            const props: string[] = [];
            if (c.properties?.read) props.push('read');
            if (c.properties?.write) props.push('write');
            if (c.properties?.writeWithoutResponse) props.push('writeWithoutResponse');
            if (c.properties?.notify) props.push('notify');
            if (c.properties?.indicate) props.push('indicate');

            charInfos.push({ uuid: cUuid, properties: props });

            if (!STANDARD_READONLY_SERVICES.has(sUuid)) {
              if (!this.bluetoothWriteChar && (c.properties?.write || c.properties?.writeWithoutResponse)) {
                this.bluetoothWriteChar = c;
              }
              if (!this.bluetoothNotifyChar && (c.properties?.notify || c.properties?.indicate)) {
                this.bluetoothNotifyChar = c;
                try {
                  await c.startNotifications();
                  c.addEventListener('characteristicvaluechanged', (event: any) => {
                    const value = event.target.value;
                    if (value?.buffer) {
                      this.recordRxBytes(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
                    }
                    this.parseReport(value, 0);
                  });
                } catch { /* ignore */ }
              }
            }
          }
        } catch { /* ignore */ }

        discoveredServices.push({
          uuid: sUuid,
          characteristics: charInfos
        });
      }
    } catch (err) {
      console.warn('BLE Service Discovery warning:', err);
    }

    if (this.bluetoothWriteChar) {
      await this.sendBluetoothCommand(new Uint8Array([0x01, 0x00]));
      this.transportDiagnostics = {
        transportType: 'ble-xim-writable',
        deviceName: device.name || 'XIM BLE Device',
        canWriteHardware: true,
        discoveredServices,
        writableCharacteristicUuid: this.bluetoothWriteChar.uuid,
        notifyCharacteristicUuid: this.bluetoothNotifyChar?.uuid || null,
        usbVendorId: null,
        usbProductId: null,
        rxPacketsReceived: 0,
        lastRxHex: null,
        diagnosticNote: `Active BLE write channel found on characteristic ${this.bluetoothWriteChar.uuid}!`
      };
    } else {
      this.transportDiagnostics = {
        transportType: 'ble-generic-readonly',
        deviceName: device.name || 'XIM4 (BLE Read-Only)',
        canWriteHardware: false,
        discoveredServices,
        writableCharacteristicUuid: null,
        notifyCharacteristicUuid: null,
        usbVendorId: null,
        usbProductId: null,
        rxPacketsReceived: 0,
        lastRxHex: null,
        diagnosticNote:
          `Web Bluetooth connected to "${device.name || 'XIM4'}", but only read-only BLE services (${discoveredServices.map(s => s.uuid.slice(4, 8)).join(', ') || 'none'}) were exposed. ` +
          `Download our Native Android APK (.zip) for full Bluetooth Classic SPP (0x1101) support, OR use USB-OTG in XIM4 Wired Configuration Mode (unplug controller from Port 3 & press 'P' during rainbow boot).`
      };
    }

    return this.transportDiagnostics;
  }

  async sendBluetoothCommand(payload: Uint8Array): Promise<boolean> {
    if (!this.bluetoothWriteChar) return false;
    try {
      if (this.bluetoothWriteChar.writeValueWithoutResponse) {
        await this.bluetoothWriteChar.writeValueWithoutResponse(payload);
      } else if (this.bluetoothWriteChar.writeValue) {
        await this.bluetoothWriteChar.writeValue(payload);
      }
      return true;
    } catch (e) {
      console.warn('XIM Bluetooth Write Error:', e);
      return false;
    }
  }

  public async sendRawHardwarePacket(payload: Uint8Array): Promise<{ sent: boolean; transport: string; error?: string }> {
    if (this.nativeAndroidConnected && (window as any).bluetoothSerial) {
      const ok = await this.sendNativeAndroidCommand(payload);
      return {
        sent: ok,
        transport: `Native Android RFCOMM (${this.nativeAndroidAddress})`,
        error: ok ? undefined : 'Native Android RFCOMM write failed'
      };
    }
    if (this.serialWriter) {
      const ok = await this.sendSerialCommand(payload);
      return {
        sent: ok,
        transport: 'Bluetooth Classic SPP / Web Serial',
        error: ok ? undefined : 'Serial SPP write failed'
      };
    }
    if (this.usbDevice && this.usbDevice.opened) {
      const ok = await this.sendUsbCommand(payload);
      return {
        sent: ok,
        transport: `WebUSB Interface #${this.usbInterfaceNumber}`,
        error: ok ? undefined : 'WebUSB transferOut failed'
      };
    }
    if (this.bluetoothWriteChar) {
      const ok = await this.sendBluetoothCommand(payload);
      return {
        sent: ok,
        transport: 'BLE GATT Characteristic',
        error: ok ? undefined : 'BLE GATT write rejected'
      };
    }
    if (this.activeDevice) {
      const padded = new Uint8Array(64);
      padded.set(payload.subarray(0, 64));
      try {
        await this.activeDevice.sendReport(this.activeReportId, padded);
        return { sent: true, transport: `WebHID Report 0x${this.activeReportId.toString(16)}` };
      } catch {
        try {
          await this.activeDevice.sendFeatureReport(this.activeReportId, padded);
          return { sent: true, transport: `WebHID Feature Report 0x${this.activeReportId.toString(16)}` };
        } catch (fe: any) {
          return { sent: false, transport: 'WebHID', error: fe?.message || 'WebHID report rejected' };
        }
      }
    }
    return {
      sent: false,
      transport: 'None (BLE Read-Only)',
      error: 'No writable channel open.'
    };
  }

  async syncProfileToHardware(profile: any, slotIndex: number = 0): Promise<boolean> {
    let r = 0, g = 255, b = 255;
    if (profile.color && profile.color.startsWith('#') && profile.color.length === 7) {
      r = parseInt(profile.color.slice(1, 3), 16) || 0;
      g = parseInt(profile.color.slice(3, 5), 16) || 255;
      b = parseInt(profile.color.slice(5, 7), 16) || 255;
    }

    const slotCmd = new Uint8Array([0x58, 0x49, 0x4D, 0x34, 0x04, slotIndex & 0x0f, 0x0d, 0x0a]);
    const colorCmd = new Uint8Array([0x58, 0x49, 0x4D, 0x34, 0x08, r, g, b, 0x0d, 0x0a]);
    const rawColorCmd = new Uint8Array([0x08, r, g, b, slotIndex & 0x0f]);

    const res1 = await this.sendRawHardwarePacket(slotCmd);
    await new Promise(res => setTimeout(res, 20));
    const res2 = await this.sendRawHardwarePacket(colorCmd);
    await new Promise(res => setTimeout(res, 20));
    await this.sendRawHardwarePacket(rawColorCmd);

    return res1.sent && res2.sent;
  }

  public buildXim4SlotPayload(profile: any, slotIndex: number, platform: string = 'Xbox One'): Uint8Array {
    const payload = new Uint8Array(320);
    const view = new DataView(payload.buffer);

    payload[0] = 0x58; // 'X'
    payload[1] = 0x49; // 'I'
    payload[2] = 0x4D; // 'M'
    payload[3] = 0x34; // '4'
    payload[4] = slotIndex & 0x0F;

    const platformMap: Record<string, number> = {
      'Xbox One': 0x03,
      'PS4': 0x04,
      'Xbox 360': 0x01,
      'PS3': 0x02,
      'PC': 0x05
    };
    payload[5] = platformMap[platform] || 0x03;

    let r = 255, g = 0, b = 0;
    if (profile.color && profile.color.startsWith('#') && profile.color.length === 7) {
      r = parseInt(profile.color.slice(1, 3), 16) || 255;
      g = parseInt(profile.color.slice(3, 5), 16) || 0;
      b = parseInt(profile.color.slice(5, 7), 16) || 0;
    }
    payload[6] = r;
    payload[7] = g;
    payload[8] = b;

    const nameStr = (profile.game || 'Custom Game').slice(0, 15);
    for (let i = 0; i < 16; i++) {
      payload[9 + i] = i < nameStr.length ? nameStr.charCodeAt(i) : 0x00;
    }
    payload[25] = 0x01;
    payload[26] = 0x01;

    const hipOffset = 32;
    const hipSens = Math.min(65535, Math.round((profile.hip?.sensitivity ?? 45.0) * 100));
    view.setUint16(hipOffset, hipSens, true);
    payload[hipOffset + 2] = Math.round((profile.hip?.yxRatio ?? 1.0) * 100);
    payload[hipOffset + 3] = profile.hip?.smoothing ?? 4;
    view.setUint16(hipOffset + 4, profile.hip?.boost ?? 0, true);
    payload[hipOffset + 6] = profile.hip?.steadyAim ?? 0;

    const smartCurve = this.getSmartTranslatorCurve(profile.game || '', platform);
    for (let i = 0; i < 21; i++) {
      payload[hipOffset + 7 + i] = profile.hip?.curve?.[i] ?? smartCurve[i] ?? Math.min(100, i * 5);
    }

    const adsOffset = 96;
    const adsSens = Math.min(65535, Math.round((profile.ads?.sensitivity ?? 35.0) * 100));
    view.setUint16(adsOffset, adsSens, true);
    payload[adsOffset + 2] = Math.round((profile.ads?.yxRatio ?? 1.0) * 100);
    payload[adsOffset + 3] = profile.ads?.smoothing ?? 2;
    view.setUint16(adsOffset + 4, profile.ads?.boost ?? 0, true);
    view.setUint16(adsOffset + 6, profile.ads?.activationDelay ?? 0, true);
    payload[adsOffset + 8] = 0xF1;

    for (let i = 0; i < 21; i++) {
      payload[adsOffset + 9 + i] = profile.ads?.curve?.[i] ?? smartCurve[i] ?? Math.min(100, i * 5);
    }

    const mapOffset = 160;
    const bindingsList = profile.bindings?.primary || [];
    let bindIdx = 0;

    const HID_CODES: Record<string, number> = {
      'W': 0x1A, 'S': 0x16, 'A': 0x04, 'D': 0x07,
      'Space': 0x2C, 'R': 0x15, 'F': 0x09, 'C': 0x06, 'E': 0x08, 'Q': 0x14,
      'Tab': 0x2B, 'Shift': 0xE1, 'L Shift': 0xE1, 'Ctrl': 0xE0, 'L Ctrl': 0xE0,
      'Alt': 0xE2, 'L Alt': 0xE2, 'Escape': 0x29, 'Esc': 0x29, 'Enter': 0x28,
      '1': 0x1E, '2': 0x1F, '3': 0x20, '4': 0x21, 'V': 0x19, 'Z': 0x1D, 'X': 0x1B,
      'Left Mouse': 0xF0, 'Right Mouse': 0xF1, 'Middle Mouse': 0xF2,
      'Mouse L': 0xF0, 'Mouse R': 0xF1, 'Mouse M': 0xF2,
      'Mouse 4': 0xF3, 'Mouse 5': 0xF4, 'Wheel Up': 0xF5, 'Wheel Down': 0xF6
    };

    const CONSOLE_CODES: Record<string, number> = {
      'L-Stick Up': 0x20, 'Move Forward': 0x20,
      'L-Stick Down': 0x21, 'Move Back': 0x21,
      'L-Stick Left': 0x22, 'Move Left': 0x22,
      'L-Stick Right': 0x23, 'Move Right': 0x23,
      'A': 0x01, 'Jump/Climb': 0x01, 'Sprint/Pedal': 0x01, 'Cross': 0x01,
      'B': 0x02, 'Reload/Melee': 0x02, 'Dodge': 0x02, 'Circle': 0x02,
      'X': 0x03, 'Enter Vehicle': 0x03, 'Interact': 0x03, 'Square': 0x03,
      'Y': 0x04, 'Swap Weapon': 0x04, 'Triangle': 0x04,
      'LB': 0x05, 'Weapon Wheel': 0x05, 'Parry/Block': 0x05, 'L1': 0x05,
      'RB': 0x06, 'Take Cover': 0x06, 'Light Attack': 0x06, 'R1': 0x06,
      'LT': 0x07, 'Aim': 0x07, 'L2': 0x07,
      'RT': 0x08, 'Shoot': 0x08, 'Attack': 0x08, 'R2': 0x08,
      'LS': 0x09, 'L3': 0x09, 'Stealth Mode': 0x09,
      'RS': 0x0A, 'R3': 0x0A, 'Look Behind': 0x0A, 'Lock On': 0x0A,
      'Menu': 0x0C, 'Start': 0x0C,
      'View': 0x0B, 'Back': 0x0B
    };

    for (const b of bindingsList) {
      if (bindIdx >= 30) break;
      const hid = HID_CODES[b.pcKey] || (b.pcKey.length === 1 ? b.pcKey.toUpperCase().charCodeAt(0) : 0x00);
      const consoleBtn = CONSOLE_CODES[b.consoleButton] || CONSOLE_CODES[b.actionName] || 0x01;

      const recordOffset = mapOffset + (bindIdx * 4);
      payload[recordOffset] = hid;
      payload[recordOffset + 1] = consoleBtn;
      payload[recordOffset + 2] = 0x01;
      payload[recordOffset + 3] = 0x00;
      bindIdx++;
    }

    const stOffset = 288;
    payload[stOffset] = 0x01;
    payload[stOffset + 1] = 22;
    payload[stOffset + 2] = 100;
    payload[stOffset + 3] = 85;
    payload[stOffset + 4] = 0x58;
    payload[stOffset + 5] = 0x54;

    let checksum = 0;
    for (let i = 0; i < 318; i++) {
      checksum = (checksum + payload[i]) & 0xFFFF;
    }
    view.setUint16(318, checksum, true);

    return payload;
  }

  public getSmartTranslatorCurve(game: string, _platform: string = 'Xbox One'): number[] {
    const g = (game || '').toLowerCase();
    if (g.includes('gta') || g.includes('grand theft auto')) {
      return [0, 24, 29, 35, 41, 47, 53, 58, 63, 68, 73, 77, 81, 85, 89, 92, 94, 96, 98, 99, 100];
    } else if (g.includes('call of duty') || g.includes('cod') || g.includes('warzone')) {
      return [0, 14, 19, 25, 31, 37, 43, 49, 55, 61, 67, 72, 77, 82, 86, 90, 93, 96, 98, 99, 100];
    } else if (g.includes('assassin') || g.includes('creed')) {
      return [0, 20, 26, 32, 38, 44, 50, 56, 62, 68, 73, 78, 83, 87, 91, 94, 96, 98, 99, 100];
    } else {
      return [0, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 77, 82, 87, 91, 94, 96, 98, 99, 100];
    }
  }

  public async flashProfileToHardware(
    profile: any,
    slotIndex: number = 0,
    platform: string = 'Xbox One',
    onProgress?: (percent: number, log: string) => void
  ): Promise<{ success: boolean; bytesWritten: number; error?: string; isReadOnlyBle?: boolean }> {
    const notify = (p: number, msg: string) => {
      console.log(`[XIM Flash ${p}%] ${msg}`);
      if (onProgress) onProgress(p, msg);
    };

    try {
      notify(5, `Compiling ${platform} Smart Translator for ${profile.game}...`);
      const payload = this.buildXim4SlotPayload(profile, slotIndex, platform);

      if (this.transportDiagnostics.transportType === 'web-usb-passthrough') {
        const spoofErr =
          'Your phone is currently talking to the Xbox/PS4 Controller (Passthrough Mode), not the XIM4 Configuration Engine! Unplug your controller from Port 3, plug XIM4 into your phone, and press the P button on the back of XIM4 during the rainbow light sequence so XIM4 enters Wired Configuration Mode.';
        notify(100, spoofErr);
        return {
          success: false,
          bytesWritten: 0,
          error: spoofErr
        };
      }

      const isNativeAndroidWritable = this.nativeAndroidConnected && !!(window as any).bluetoothSerial;
      const isSerialWritable = !!this.serialWriter;
      const isWebUsbWritable = !!(this.usbDevice && this.usbDevice.opened);
      const isBluetoothWritable = !!this.bluetoothWriteChar;
      const isHidWritable = !!this.activeDevice;

      if (!isNativeAndroidWritable && !isSerialWritable && !isWebUsbWritable && !isBluetoothWritable && !isHidWritable) {
        const isBleReadOnly = this.transportDiagnostics.transportType === 'ble-generic-readonly';
        const reason = isBleReadOnly
          ? 'Connected via BLE Read-Only. Download our Native Android APK (.zip) for direct Bluetooth Classic SPP flashing, OR connect via USB-OTG in XIM4 Wired Configuration Mode.'
          : 'No writable XIM4 transport is open yet. Connect using Native Android APK Bluetooth SPP or USB-OTG (in XIM4 Wired Config Mode).';

        notify(100, `Hardware Write Blocked: ${reason}`);
        return {
          success: false,
          bytesWritten: 0,
          isReadOnlyBle: isBleReadOnly,
          error: reason
        };
      }

      const activeTransportName = isNativeAndroidWritable
        ? `Native Android APK RFCOMM (${this.nativeAndroidAddress})`
        : isSerialWritable
          ? 'Bluetooth Classic SPP (Web Serial RFCOMM)'
          : isWebUsbWritable
            ? `WebUSB Direct (VID:0x${(this.transportDiagnostics.usbVendorId || 0).toString(16)} Interface #${this.usbInterfaceNumber})`
            : isBluetoothWritable
              ? `BLE GATT (${this.bluetoothWriteChar.uuid})`
              : `WebHID (Report 0x${this.activeReportId.toString(16)})`;

      notify(15, `Opening ${activeTransportName} for Slot ${slotIndex + 1} write...`);

      const flashBeginCmd = new Uint8Array([0x58, 0x49, 0x4D, 0x34, 0x0A, 0x01, slotIndex & 0x0F, payload[5], 0x00]);
      const beginRes = await this.sendRawHardwarePacket(flashBeginCmd);
      if (!beginRes.sent) {
        throw new Error(beginRes.error || 'Hardware rejected Flash Begin packet (0x0A)');
      }

      await new Promise(r => setTimeout(r, 60));

      const CHUNK_SIZE = isNativeAndroidWritable || isSerialWritable || isWebUsbWritable ? 32 : 16;
      const totalChunks = Math.ceil(payload.length / CHUNK_SIZE);
      notify(25, `Streaming ${totalChunks} binary frames (${payload.length} bytes) over ${activeTransportName}...`);

      let bytesSent = 0;
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const slice = payload.subarray(start, Math.min(start + CHUNK_SIZE, payload.length));

        const chunkPacket = new Uint8Array(4 + slice.length);
        chunkPacket[0] = 0x0B;
        chunkPacket[1] = i;
        chunkPacket[2] = totalChunks;
        chunkPacket[3] = slice.length;
        chunkPacket.set(slice, 4);

        const chunkRes = await this.sendRawHardwarePacket(chunkPacket);
        if (!chunkRes.sent) {
          throw new Error(`Write failed at frame ${i + 1}/${totalChunks}: ${chunkRes.error}`);
        }

        bytesSent += slice.length;
        const pct = Math.round(25 + ((i + 1) / totalChunks) * 55);
        notify(pct, `Transmitted Frame ${i + 1}/${totalChunks} (${bytesSent}/${payload.length} bytes)...`);
        await new Promise(r => setTimeout(r, 25));
      }

      notify(85, 'Committing checksum to XIM4 EEPROM...');
      const commitCmd = new Uint8Array([0x58, 0x49, 0x4D, 0x34, 0x0C, slotIndex & 0x0F, payload[318], payload[319], 0x01]);
      const commitRes = await this.sendRawHardwarePacket(commitCmd);
      if (!commitRes.sent) {
        throw new Error(commitRes.error || 'Hardware rejected Flash Commit command (0x0C)');
      }

      await new Promise(r => setTimeout(r, 100));

      notify(95, 'Activating Slot & Sending LED Color Command...');
      await this.syncProfileToHardware(profile, slotIndex);

      notify(100, `Transmitted ${bytesSent} bytes via ${activeTransportName}.`);
      return { success: true, bytesWritten: bytesSent };
    } catch (err: any) {
      console.error('XIM Flash Error:', err);
      notify(100, `Flash Failed: ${err.message || 'Hardware transmission error'}`);
      return { success: false, bytesWritten: 0, error: err.message };
    }
  }

  async connectHID() {
    if (!('hid' in navigator)) {
      throw new Error('WebHID not supported in this browser.');
    }

    try {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

      const filters = [
        { vendorId: 0x16d0 },
        { vendorId: 9095 },
        { vendorId: 0x2387 },
        { vendorId: 0x045e },
        { vendorId: 0x054c },
        { vendorId: 0x057e },
        { vendorId: 0x1209 },
        { vendorId: 0x0eb7 }
      ];

      const devices = await (navigator as any).hid.requestDevice({ filters }).catch(() => []);

      if (devices.length > 0) {
        let mainProductName = '';

        for (const device of devices) {
          try {
            if (!device.opened) {
              await device.open();
            }

            mainProductName = mainProductName || device.productName;
            device.oninputreport = (e: any) => {
              if (e.data?.buffer) {
                this.recordRxBytes(new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength));
              }
              this.debugLogReport(e.data, e.reportId);
              this.parseReport(e.data, e.reportId);
            };

            await this.sendXimHandshake(device);
          } catch (devErr) {
            console.warn('Failed to open an interface:', devErr);
          }
        }

        const writable = !!this.activeDevice;
        this.transportDiagnostics = {
          transportType: 'web-hid',
          deviceName: mainProductName || 'XIM USB HID',
          canWriteHardware: writable,
          discoveredServices: [],
          writableCharacteristicUuid: writable ? `WebHID Report 0x${this.activeReportId.toString(16)}` : null,
          notifyCharacteristicUuid: 'WebHID Input Report',
          usbVendorId: null,
          usbProductId: null,
          rxPacketsReceived: 0,
          lastRxHex: null,
          diagnosticNote: writable
            ? `WebHID interface opened on Report 0x${this.activeReportId.toString(16)}.`
            : 'USB HID device opened, but no writable report responded.'
        };

        return mainProductName || 'XIM/Controller';
      }
      return null;
    } catch (err) {
      console.error('HID Connection Error:', err);
      throw err;
    }
  }

  disconnect() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.nativeAndroidConnected && (window as any).bluetoothSerial) {
      try {
        (window as any).bluetoothSerial.disconnect();
      } catch { /* ignore */ }
    }
    this.nativeAndroidConnected = false;
    this.nativeAndroidAddress = null;
    this.usbReadActive = false;
    if (this.usbDevice) {
      try {
        this.usbDevice.close();
      } catch { /* ignore */ }
      this.usbDevice = null;
    }
    if (this.serialReader) {
      try {
        this.serialReader.cancel();
      } catch { /* ignore */ }
      this.serialReader = null;
    }
    if (this.serialWriter) {
      try {
        this.serialWriter.releaseLock();
      } catch { /* ignore */ }
      this.serialWriter = null;
    }
    if (this.serialPort) {
      try {
        this.serialPort.close();
      } catch { /* ignore */ }
      this.serialPort = null;
    }
    this.bluetoothWriteChar = null;
    this.bluetoothNotifyChar = null;
    this.bluetoothServer = null;
    this.activeDevice = null;
    this.isCapturing = false;
    this.transportDiagnostics = {
      transportType: 'none',
      deviceName: null,
      canWriteHardware: false,
      discoveredServices: [],
      writableCharacteristicUuid: null,
      notifyCharacteristicUuid: null,
      usbVendorId: null,
      usbProductId: null,
      rxPacketsReceived: 0,
      lastRxHex: null,
      diagnosticNote: 'Disconnected.'
    };
  }

  private async sendXimHandshake(device: any) {
    const handshakeCommands = [[0x01, 0x00], [0x10, 0x00], [0x05, 0x00], [0x03, 0x00]];
    const candidates = new Set<number>([0x00, 0x3f]);

    if (device.collections) {
      for (const coll of device.collections) {
        coll.outputReports?.forEach((r: any) => candidates.add(r.reportId));
        coll.featureReports?.forEach((r: any) => candidates.add(r.reportId));
      }
    }

    for (const reportId of candidates) {
      let success = false;
      for (const cmd of handshakeCommands) {
        const payload = new Uint8Array(64);
        payload.set(cmd);
        try {
          await device.sendReport(reportId, payload);
          success = true;
        } catch {
          try {
            await device.sendFeatureReport(reportId, payload);
            success = true;
          } catch { /* ignore */ }
        }
      }
      if (success) {
        this.activeReportId = reportId;
        this.activeDevice = device;

        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(async () => {
          try {
            const hb = new Uint8Array(64);
            hb[0] = 0x03;
            await device.sendReport(reportId, hb);
          } catch { /* ignore */ }
        }, 3000);
        break;
      }
    }
  }

  public async startInputCapture() {
    if (!this.activeDevice) return;
    this.isCapturing = true;
    try {
      const cmd = new Uint8Array(64);
      cmd[0] = 0x02;
      await this.activeDevice.sendReport(this.activeReportId, cmd);
    } catch (e) {
      console.warn('XIM Service: Failed to start input capture:', e);
    }
  }

  private debugLogReport(data: DataView, reportId: number) {
    if ((window as any).ximDebug || localStorage.getItem('xim_debug') === 'true') {
      const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      if (bytes[0] === 0x83 || (bytes[0] === 0x00 && bytes[1] === 0x00)) return;
      console.log(`XIM RAW REPORT [ID:${reportId}]:`, Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
    }
  }

  private lastReports: Map<number, Uint8Array> = new Map();
  private lastMapTime = 0;

  private parseReport(data: DataView, reportId: number) {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    if (bytes[0] === 0x81 || bytes[0] === 0x10 || bytes[0] === 0x83 || bytes[0] === 0x03) {
      return;
    }

    const now = Date.now();
    if (now - this.lastMapTime < 200) return;

    if (!this.lastReports.has(reportId)) {
      this.lastReports.set(reportId, new Uint8Array(bytes));
      return;
    }

    const lastReport = this.lastReports.get(reportId)!;
    let changeIdx = -1;
    let changeValue = 0;
    let isButtonPress = false;

    for (let i = 0; i < bytes.length; i++) {
      const current = bytes[i];
      const last = lastReport[i];

      if (current !== last) {
        if (last === 0 && current !== 0) {
          changeIdx = i;
          changeValue = current;
          isButtonPress = true;
          break;
        }

        const isNeutral = (current >= 110 && current <= 145);
        if (!isNeutral && changeIdx === -1) {
          changeIdx = i;
          changeValue = current;
        }
      }
    }

    if (changeIdx !== -1) {
      this.lastMapTime = now;
      this.handleHardwareInput({
        source: XimInputSource.KEYBOARD,
        code: `HW_ID${reportId}_IDX${changeIdx}_${isButtonPress ? 'BTN' : (changeValue > 128 ? 'HI' : 'LO')}`,
        value: 1
      });
    }

    this.lastReports.set(reportId, new Uint8Array(bytes));
  }
}

export const ximService = new XimService();
