import fs from 'fs';

// 1. Inject Android 12-14+ Bluetooth permissions into AndroidManifest.xml
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
if (fs.existsSync(manifestPath)) {
  let xml = fs.readFileSync(manifestPath, 'utf8');
  const perms = [
    'android.permission.BLUETOOTH',
    'android.permission.BLUETOOTH_ADMIN',
    'android.permission.BLUETOOTH_CONNECT',
    'android.permission.BLUETOOTH_SCAN',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION'
  ];
  let tagsToAdd = '';
  for (const p of perms) {
    if (!xml.includes(p)) {
      tagsToAdd += `    <uses-permission android:name="${p}" />\n`;
    }
  }
  if (tagsToAdd) {
    xml = xml.replace('<application', tagsToAdd + '    <application');
    fs.writeFileSync(manifestPath, xml, 'utf8');
    console.log('Injected Bluetooth permissions into AndroidManifest.xml');
  } else {
    console.log('All Bluetooth permissions already present in AndroidManifest.xml');
  }
}

// 2. Patch MainActivity.java to request Android 12-14+ BLUETOOTH_CONNECT & BLUETOOTH_SCAN runtime permissions on launch
const mainActPath = 'android/app/src/main/java/com/xim/webmanager/MainActivity.java';
if (fs.existsSync(mainActPath)) {
  const mainActCode = [
    'package com.xim.webmanager;',
    '',
    'import android.Manifest;',
    'import android.content.pm.PackageManager;',
    'import android.os.Build;',
    'import android.os.Bundle;',
    'import androidx.core.app.ActivityCompat;',
    'import androidx.core.content.ContextCompat;',
    'import com.getcapacitor.BridgeActivity;',
    'import java.util.ArrayList;',
    'import java.util.List;',
    '',
    'public class MainActivity extends BridgeActivity {',
    '    @Override',
    '    public void onCreate(Bundle savedInstanceState) {',
    '        super.onCreate(savedInstanceState);',
    '        requestBluetoothPermissionsIfNeeded();',
    '    }',
    '',
    '    private void requestBluetoothPermissionsIfNeeded() {',
    '        List<String> needed = new ArrayList<>();',
    '        if (Build.VERSION.SDK_INT >= 31) {',
    '            if (ContextCompat.checkSelfPermission(this, "android.permission.BLUETOOTH_CONNECT") != PackageManager.PERMISSION_GRANTED) {',
    '                needed.add("android.permission.BLUETOOTH_CONNECT");',
    '            }',
    '            if (ContextCompat.checkSelfPermission(this, "android.permission.BLUETOOTH_SCAN") != PackageManager.PERMISSION_GRANTED) {',
    '                needed.add("android.permission.BLUETOOTH_SCAN");',
    '            }',
    '        }',
    '        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {',
    '            needed.add(Manifest.permission.ACCESS_FINE_LOCATION);',
    '        }',
    '        if (!needed.isEmpty()) {',
    '            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), 1001);',
    '        }',
    '    }',
    '}',
    ''
  ].join('\n');

  fs.writeFileSync(mainActPath, mainActCode, 'utf8');
  console.log('Patched MainActivity.java with Android 12-14+ BLUETOOTH_CONNECT & BLUETOOTH_SCAN runtime permission prompt');
}

// 3. Patch BluetoothSerial.java in cordova-plugin-bluetooth-serial so ACCESS_COARSE_LOCATION check does not block Android 12+ discovery
const btSerialPath = 'android/capacitor-cordova-android-plugins/src/main/java/com/megster/cordova/BluetoothSerial.java';
if (fs.existsSync(btSerialPath)) {
  let btCode = fs.readFileSync(btSerialPath, 'utf8');
  btCode = btCode.replace(
    'if (cordova.hasPermission(ACCESS_COARSE_LOCATION)) {',
    'if (android.os.Build.VERSION.SDK_INT >= 31 || cordova.hasPermission(ACCESS_COARSE_LOCATION)) {'
  );
  fs.writeFileSync(btSerialPath, btCode, 'utf8');
  console.log('Patched BluetoothSerial.java for Android 12-14+ discovery compatibility');
}
