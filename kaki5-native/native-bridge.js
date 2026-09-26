// ==================== NATIVE BRIDGE (kaki5-native) ====================
// File ini HANYA ada di bundle APK (di-injeksi sync-www.mjs ke www/index.html),
// tidak pernah ada di deploy web kaki5.
//
// Tugas:
// 1. Tandai runtime native (window.KASIRSOLO_NATIVE).
// 2. Tandai PWA "sudah terpasang" (baris Pengaturan tidak menawarkan install).
// 3. Shim Web Bluetooth di atas plugin @capacitor-community/bluetooth-le —
//    WebView Android tidak punya navigator.bluetooth, jadi kode printer.js
//    yang lama dijembatani tanpa diubah sama sekali.
//
// Permukaan printer.js yang didukung shim:
//   navigator.bluetooth.requestDevice({filters, optionalServices})
//   device.gatt.connect() / .disconnect() / .connected
//   server.getPrimaryService(uuid) -> service.getCharacteristics()
//   characteristic.properties.write / .writeWithoutResponse
//   characteristic.writeValue(bytes) / .writeValueWithoutResponse(bytes)
//   device.addEventListener('gattserverdisconnected', cb)
(function () {
  'use strict';

  try { localStorage.setItem('kasirsolo:pwa-installed', 'true'); } catch (_) {}

  var plugin = null;
  try {
    plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BluetoothLe;
  } catch (_) {}

  // __KSR_FORCE_BT_SHIM: saklar QA — paksa shim menimpa Web Bluetooth bawaan
  // (desktop Chrome punya navigator.bluetooth asli; WebView Android tidak).
  var force = false, nativeBT = false;
  try { force = window.__KSR_FORCE_BT_SHIM === true; } catch (_) {}
  try { nativeBT = !!navigator.bluetooth; } catch (_) {}

  if ((!plugin || nativeBT) && !force) return; // bukan APK / WebView punya BT asli

  window.KASIRSOLO_NATIVE = true;

  // ── util ─────────────────────────────────────────────────────────────────
  function bytesToB64(bytes) {
    var u8 = new Uint8Array(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength !== undefined ? bytes.byteLength : bytes.length);
    var s = '';
    for (var i = 0; i < u8.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  function norm(uuid) { return String(uuid || '').toLowerCase(); }

  function notFound(msg) {
    var e = new Error(msg || 'NotFoundError');
    e.name = 'NotFoundError';
    return e;
  }

  function isCancelled(err) {
    var m = String((err && err.message) || err || '').toLowerCase();
    return m.indexOf('cancel') !== -1 || m.indexOf('no device') !== -1 || m.indexOf('denied') !== -1;
  }

  // ── izin runtime (Android 12+: BLUETOOTH_SCAN/CONNECT, lama: lokasi) ─────
  var initPromise = null;
  function ensureInit() {
    if (!initPromise) {
      initPromise = Promise.resolve(plugin.initialize()).catch(function (e) {
        initPromise = null;
        throw e;
      });
    }
    return initPromise;
  }

  // ── registry device shim (agar listener 'disconnected|<id>' tidak dobel) ─
  var activeDevices = {}; // deviceId -> { handlers: [cb], handle: listenerHandle }

  function markDisconnected(deviceId, shimDevice) {
    var rec = activeDevices[deviceId];
    if (rec && rec.marked) return;
    if (rec) rec.marked = true;
    if (shimDevice) shimDevice.gatt.connected = false;
    var handlers = rec ? rec.handlers : [];
    for (var i = 0; i < handlers.length; i++) {
      try { handlers[i](); } catch (_) {}
    }
  }

  function watchDisconnect(deviceId, shimDevice) {
    if (activeDevices[deviceId]) return;
    var rec = { handlers: [], marked: false };
    activeDevices[deviceId] = rec;
    plugin.addListener('disconnected|' + deviceId, function () {
      markDisconnected(deviceId, shimDevice);
    }).then(function (h) { rec.handle = h; }).catch(function () {});
  }

  // ── objek Web Bluetooth tiruan ───────────────────────────────────────────
  function makeCharacteristic(deviceId, svcUuid, c) {
    var props = c.properties || {};
    return {
      uuid: c.uuid,
      properties: {
        write: !!props.write,
        writeWithoutResponse: !!props.writeWithoutResponse,
        read: !!props.read,
        notify: !!props.notify,
        indicate: !!props.indicate
      },
      value: null,
      writeValue: function (bytes) {
        return plugin.write({ deviceId: deviceId, service: svcUuid, characteristic: c.uuid, value: bytesToB64(bytes) });
      },
      writeValueWithoutResponse: function (bytes) {
        return plugin.writeWithoutResponse({ deviceId: deviceId, service: svcUuid, characteristic: c.uuid, value: bytesToB64(bytes) });
      },
      // alias gaya spec baru
      writeValueWithResponse: function (bytes) { return this.writeValue(bytes); }
    };
  }

  function makeService(deviceId, s) {
    var chars = null;
    return {
      uuid: s.uuid,
      getCharacteristics: function () {
        if (chars) return Promise.resolve(chars);
        chars = (s.characteristics || []).map(function (c) { return makeCharacteristic(deviceId, s.uuid, c); });
        return Promise.resolve(chars);
      }
    };
  }

  function makeGattServer(deviceId, shimDevice) {
    var services = null;
    var server = {
      connected: false,
      connect: function () {
        return ensureInit().then(function () {
          return plugin.connect({ deviceId: deviceId });
        }).catch(function (err) {
          // device yang masih menyala dari sesi sebelumnya — anggap sukses
          if (/already connected/i.test(String((err && err.message) || err))) return;
          if (isCancelled(err)) throw notFound('Pemilihan perangkat dibatalkan');
          throw err;
        }).then(function () {
          server.connected = true;
          services = null; // servis di-discover ulang tiap koneksi baru
          watchDisconnect(deviceId, shimDevice);
          return server;
        });
      },
      disconnect: function () {
        server.connected = false;
        return Promise.resolve(plugin.disconnect({ deviceId: deviceId })).catch(function () {}).then(function () {
          markDisconnected(deviceId, shimDevice);
        });
      },
      getPrimaryService: function (uuid) {
        if (services) return findService(uuid);
        return plugin.discoverServices({ deviceId: deviceId }).then(function () {
          return plugin.getServices({ deviceId: deviceId });
        }).then(function (res) {
          services = (res.services || []).map(function (s) { return makeService(deviceId, s); });
          return findService(uuid);
        });
      }
    };
    function findService(uuid) {
      for (var i = 0; i < services.length; i++) {
        if (norm(services[i].uuid) === norm(uuid)) return services[i];
      }
      return Promise.reject(notFound('Service tidak ditemukan: ' + uuid));
    }
    return server;
  }

  function makeDevice(bleDevice) {
    var deviceId = bleDevice.deviceId;
    var device = {
      id: deviceId,
      name: bleDevice.name || bleDevice.utf8Name || '',
      _shimServer: null,
      addEventListener: function (type, cb) {
        if (type === 'gattserverdisconnected') {
          var rec = activeDevices[deviceId];
          if (!rec) { rec = { handlers: [], marked: false }; activeDevices[deviceId] = rec; }
          rec.handlers.push(cb);
        }
      },
      removeEventListener: function () {},
      forget: function () { return Promise.resolve(); },
      watchAdvertisements: function () { return Promise.resolve(); }
    };
    var server = makeGattServer(deviceId, device);
    device._shimServer = server;
    device.gatt = server;
    return device;
  }

  // ── navigator.bluetooth ──────────────────────────────────────────────────
  var shim = {
    requestDevice: function (options) {
      options = options || {};
      return ensureInit().then(function () {
        // Tanpa filter nama/service → dialog native menampilkan SEMUA perangkat
        // sekitar (kaki5 memfilter per nama prefix yang kadang tidak match iklan
        // service; daftar penuh lebih aman). optionalServices tetap dibawa agar
        // semua UUID service thermal printer diizinkan.
        var svcs = [];
        var push = function (u) {
          if (u && svcs.indexOf(norm(u)) === -1) svcs.push(norm(u));
        };
        (Array.isArray(options.optionalServices) ? options.optionalServices : []).forEach(push);
        (Array.isArray(options.filters) ? options.filters : []).forEach(function (f) {
          (Array.isArray(f && f.services) ? f.services : []).forEach(push);
        });
        var reqOpts = {};
        if (svcs.length) reqOpts.optionalServices = svcs;
        return plugin.requestDevice(reqOpts);
      }).then(function (bleDevice) {
        if (!bleDevice || !bleDevice.deviceId) throw notFound('Perangkat tidak dipilih');
        return makeDevice(bleDevice);
      }).catch(function (err) {
        if (isCancelled(err)) throw notFound('Pemilihan perangkat dibatalkan');
        throw err;
      });
    },
    getAvailability: function () { return Promise.resolve(true); }
  };

  try {
    Object.defineProperty(navigator, 'bluetooth', { value: shim, configurable: true });
  } catch (_) {
    try { navigator.bluetooth = shim; } catch (_) {}
  }

  console.log('[native-bridge] Web Bluetooth shim aktif (BluetoothLe plugin)');
})();
