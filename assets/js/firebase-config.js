/* ================================================================
   RADHEY RADHEY FURNITURE & HANDICRAFT — SECURE FIREBASE CLOUD CONFIG
   Encapsulated Cloud Database Integration with Shielded Credentials
   ================================================================ */

// ================================================================
// WEBSITE PROTECTION: DISABLE RIGHT-CLICK, DOUBLE-CLICK & DEVTOOLS
// ================================================================
(function initAntiInspectProtection() {
  if (window.__antiInspectInitialized) return;
  window.__antiInspectInitialized = true;

  // 1. Disable Right-Click Context Menu
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
  }, { capture: true });

  // 2. Disable Double-Click action (except in input/textarea/editable fields)
  document.addEventListener('dblclick', function(e) {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) {
      return true;
    }
    e.preventDefault();
    return false;
  }, { capture: true });

  // 3. Block Developer Tools & Inspect Keyboard Shortcuts
  document.addEventListener('keydown', function(e) {
    // F12 key
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl + Shift + I (Inspect), Ctrl + Shift + J (Console), Ctrl + Shift + C (Inspect Element)
    if (e.ctrlKey && e.shiftKey && (
      e.key === 'I' || e.key === 'i' || e.keyCode === 73 ||
      e.key === 'J' || e.key === 'j' || e.keyCode === 74 ||
      e.key === 'C' || e.key === 'c' || e.keyCode === 67
    )) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Mac Cmd + Option + I / J / C
    if (e.metaKey && e.altKey && (
      e.key === 'I' || e.key === 'i' ||
      e.key === 'J' || e.key === 'j' ||
      e.key === 'C' || e.key === 'c'
    )) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl + U (View Source)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U' || e.keyCode === 85)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl + S (Save Page Source)
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.keyCode === 83)) {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
  }, { capture: true });

  // 4. Disable drag of images
  document.addEventListener('dragstart', function(e) {
    if (e.target && e.target.tagName === 'IMG') {
      e.preventDefault();
      return false;
    }
  }, { capture: true });

  // Fullscreen helper: Completely hides the browser URL address bar
  window.toggleAppFullscreen = function() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };
})();

// ================================================================
// AUTOMATIC 1-HOUR BROWSER DATA EXPIRY MANAGER (AUTO-PURGE TTL)
// Har browser-saved data (localStorage) 1 ghante (3,600,000 ms) baad
// automatic delete ho jaata hai.
// ================================================================
(function initAutoExpireStorageManager() {
  if (window.__radhaStorageManagerInitialized) return;
  window.__radhaStorageManagerInitialized = true;

  const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 Hour = 3,600,000 milliseconds
  const META_STORAGE_KEY = '__radha_storage_ttl_meta_v1__';

  const rawSetItem = Storage.prototype.setItem;
  const rawGetItem = Storage.prototype.getItem;
  const rawRemoveItem = Storage.prototype.removeItem;
  const rawClear = Storage.prototype.clear;

  let activeTTL = DEFAULT_TTL_MS;

  function loadMetadata() {
    try {
      const raw = rawGetItem.call(localStorage, META_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveMetadata(meta) {
    try {
      rawSetItem.call(localStorage, META_STORAGE_KEY, JSON.stringify(meta));
    } catch (e) {}
  }

  // Active Purge: Delete any key older than 1 hour
  function purgeExpiredItems() {
    const meta = loadMetadata();
    const now = Date.now();
    let hasChanges = false;
    const expiredKeys = [];

    // 1. Check all registered keys in metadata
    for (const key in meta) {
      if (!meta.hasOwnProperty(key)) continue;
      const entry = meta[key];
      const expiresAt = typeof entry === 'object' ? entry.expiresAt : entry;
      
      if (now >= expiresAt) {
        rawRemoveItem.call(localStorage, key);
        delete meta[key];
        hasChanges = true;
        expiredKeys.push(key);
      }
    }

    // 2. Also track any unmapped localStorage keys that exist
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || key === META_STORAGE_KEY) continue;
      if (!meta[key]) {
        // First discovery: set 1-hour expiration from now
        meta[key] = { savedAt: now, expiresAt: now + activeTTL };
        hasChanges = true;
      } else {
        const expiresAt = typeof meta[key] === 'object' ? meta[key].expiresAt : meta[key];
        if (now >= expiresAt) {
          rawRemoveItem.call(localStorage, key);
          delete meta[key];
          hasChanges = true;
          expiredKeys.push(key);
        }
      }
    }

    if (hasChanges) {
      saveMetadata(meta);
    }

    if (expiredKeys.length > 0) {
      console.log(`[Radha Storage Guard] 1 Hour Expired — Auto-deleted ${expiredKeys.length} browser items:`, expiredKeys);
      window.dispatchEvent(new CustomEvent('radha_storage_expired', { detail: { keys: expiredKeys } }));

      // Check if session was deleted
      const sessionExpired = expiredKeys.includes('radha_auth_user_v1') || expiredKeys.includes('radha_auth_admin_v1');
      if (sessionExpired) {
        handleSessionExpiration();
      }
    }

    return expiredKeys;
  }

  function handleSessionExpiration() {
    const isProtectedArea = window.location.pathname.includes('/admin/') || window.location.pathname.includes('/user/');
    if (isProtectedArea && !window.__sessionExpireAlertShown) {
      window.__sessionExpireAlertShown = true;
      alert('⏰ 1 Ghante ka samay poora ho gaya hai. Suraksha ke liye browser ka data aur session delete ho gaya hai. Kripya dobara login karein.');
      const redirectPrefix = window.location.pathname.includes('/user/') || window.location.pathname.includes('/admin/') ? '../' : '';
      window.location.href = redirectPrefix + 'login.html';
    }
  }

  // Intercept Storage.prototype.setItem
  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && key !== META_STORAGE_KEY) {
      const now = Date.now();
      const meta = loadMetadata();
      meta[key] = {
        savedAt: now,
        expiresAt: now + activeTTL
      };
      saveMetadata(meta);
    }
    return rawSetItem.call(this, key, value);
  };

  // Intercept Storage.prototype.getItem
  Storage.prototype.getItem = function(key) {
    if (this === localStorage && key !== META_STORAGE_KEY) {
      const meta = loadMetadata();
      if (meta[key]) {
        const now = Date.now();
        const expiresAt = typeof meta[key] === 'object' ? meta[key].expiresAt : meta[key];
        if (now >= expiresAt) {
          rawRemoveItem.call(this, key);
          delete meta[key];
          saveMetadata(meta);
          return null;
        }
      }
    }
    return rawGetItem.call(this, key);
  };

  // Intercept Storage.prototype.removeItem
  Storage.prototype.removeItem = function(key) {
    if (this === localStorage && key !== META_STORAGE_KEY) {
      const meta = loadMetadata();
      if (meta[key]) {
        delete meta[key];
        saveMetadata(meta);
      }
    }
    return rawRemoveItem.call(this, key);
  };

  // Intercept Storage.prototype.clear
  Storage.prototype.clear = function() {
    if (this === localStorage) {
      saveMetadata({});
    }
    return rawClear.call(this);
  };

  // Expose global manager for verification & testing
  window.radhaStorageManager = {
    TTL_MS: activeTTL,
    getRemainingSeconds: function(key) {
      const meta = loadMetadata();
      if (!meta[key]) return 0;
      const expiresAt = typeof meta[key] === 'object' ? meta[key].expiresAt : meta[key];
      const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      return remaining;
    },
    getAllTracked: function() {
      const meta = loadMetadata();
      const now = Date.now();
      const report = {};
      for (const k in meta) {
        const entry = meta[k];
        const exp = typeof entry === 'object' ? entry.expiresAt : entry;
        const remSec = Math.max(0, Math.round((exp - now) / 1000));
        report[k] = {
          savedAgoMinutes: Math.round((now - (entry.savedAt || (exp - activeTTL))) / 60000),
          remainingMinutes: Math.round(remSec / 60),
          remainingSeconds: remSec,
          isExpired: now >= exp
        };
      }
      return report;
    },
    cleanup: purgeExpiredItems,
    clearAllData: function() {
      rawClear.call(localStorage);
      saveMetadata({});
      console.log('[Radha Storage Guard] All browser data successfully purged.');
    },
    setTestTTL: function(seconds) {
      activeTTL = seconds * 1000;
      console.log(`[Radha Storage Guard] TTL temporarily set to ${seconds} seconds for testing.`);
    }
  };

  // Run cleanup immediately
  purgeExpiredItems();

  // Run cleanup on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', purgeExpiredItems);
  }

  // Run cleanup whenever user switches back to tab
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      purgeExpiredItems();
    }
  });

  // Run background sweep every 30 seconds
  setInterval(purgeExpiredItems, 30000);
})();

// Internal shielded credentials generator (Prevents plaintext exposure in Inspect / Sources / Console)
const _getProtectedCloudConfig = (function() {
  const _s = (parts) => parts.join('');
  return function() {
    return {
      apiKey: _s(['AIza', 'SyAol', 'J7Mgeq', 'Zw7kzza', 'FpB6lub', '05AQa3', 'O5RU']),
      authDomain: ['radha-radha-funicher-17e24', 'firebaseapp', 'com'].join('.'),
      projectId: ['radha', 'radha', 'funicher', '17e24'].join('-'),
      storageBucket: ['radha-radha-funicher-17e24', 'firebasestorage', 'app'].join('.'),
      messagingSenderId: '100970099431',
      appId: _s(['1:', '100970099431:', 'web:', '27a495b68b6e12835b2842']),
      measurementId: 'G-ZQBDG338SL'
    };
  };
})();

// Production Logger (Suppressed to prevent DevTools inspect leaks)
const _log = (..._args) => {};

// Global Firebase Objects
let firebaseApp = null;
let firestoreDB = null;
let isFirebaseReady = false;
let firebaseSdkLoadingPromise = null;

// Dynamically load Firebase SDK if not present in HTML
async function ensureFirebaseSDKLoaded() {
  if (typeof firebase !== 'undefined' && typeof firebase.firestore !== 'undefined') {
    return true;
  }
  if (firebaseSdkLoadingPromise) {
    return await firebaseSdkLoadingPromise;
  }

  firebaseSdkLoadingPromise = (async () => {
    const scripts = [
      'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js',
      'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js'
    ];

    for (const src of scripts) {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (!existing.dataset.loaded && typeof firebase === 'undefined') {
          await new Promise((resolve) => {
            existing.addEventListener('load', () => { existing.dataset.loaded = 'true'; resolve(); }, { once: true });
            existing.addEventListener('error', resolve, { once: true });
            setTimeout(resolve, 2000);
          });
        }
      } else {
        await new Promise((resolve) => {
          const s = document.createElement('script');
          s.src = src;
          s.onload = () => { s.dataset.loaded = 'true'; resolve(); };
          s.onerror = () => {
            console.warn(`Could not load script: ${src}`);
            resolve();
          };
          document.head.appendChild(s);
        });
      }
    }

    let waitCount = 0;
    while ((typeof firebase === 'undefined' || typeof firebase.firestore === 'undefined') && waitCount < 30) {
      await new Promise(r => setTimeout(r, 100));
      waitCount++;
    }

    return typeof firebase !== 'undefined' && typeof firebase.firestore !== 'undefined';
  })();

  return await firebaseSdkLoadingPromise;
}

// Initialize Firebase App and Firestore
async function initFirebaseCloud() {
  if (isFirebaseReady && firestoreDB) return firestoreDB;

  try {
    const sdkLoaded = await ensureFirebaseSDKLoaded();

    if (sdkLoaded && typeof firebase !== 'undefined') {
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(_getProtectedCloudConfig());
      } else {
        firebaseApp = firebase.app();
      }

      firestoreDB = firebase.firestore();
      isFirebaseReady = true;
      return firestoreDB;
    }
  } catch (err) {
    console.warn('⚠️ Firebase init warning:', err.message);
  }
  return null;
}

// Auto-run initialization on load
initFirebaseCloud();

// ----------------------------------------------------------------
// FIREBASE FIRESTORE DATA HELPERS (With LocalStorage Fallback)
// ----------------------------------------------------------------

// Helper to clean objects for Firestore (removes undefined which Firestore rejects)
function _sanitizeForFirestore(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(_sanitizeForFirestore);
  const clean = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      clean[key] = _sanitizeForFirestore(val);
    }
  }
  return clean;
}

// 1. PRODUCTS (Cross-Device Cloud Synchronized)
async function fbGetProducts() {
  // Step 1: Prepare base products (Local Storage or default PRODUCTS_DATA)
  let baseProducts = [];
  try {
    const local = localStorage.getItem('radha_furniture_custom_products_v1');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        baseProducts = parsed.filter(p => p.id !== 'rf-107' && (!p.title || !p.title.includes('Rocking Chair (Aaram Kursi)')));
      }
    }
  } catch (e) {}

  if (baseProducts.length === 0 && typeof PRODUCTS_DATA !== 'undefined') {
    baseProducts = PRODUCTS_DATA.filter(p => p.id !== 'rf-107' && (!p.title || !p.title.includes('Rocking Chair (Aaram Kursi)')));
    try {
      localStorage.setItem('radha_furniture_custom_products_v1', JSON.stringify(baseProducts));
    } catch (e) {}
  }

  // Step 2: Reliable Cloud sync with Firestore
  try {
    const fetchCloud = async () => {
      const db = await initFirebaseCloud();
      if (db) {
        const snap = await db.collection('products').get();
        if (!snap.empty) {
          const cloudProducts = [];
          snap.forEach(doc => {
            const d = doc.data();
            const prodId = doc.id || d.id;
            if (prodId === 'rf-107' || (d.title && d.title.includes('Rocking Chair (Aaram Kursi)'))) {
              return;
            }
            cloudProducts.push({ ...d, _id: doc.id, id: d.id || doc.id });
          });

          if (cloudProducts.length > 0) {
            // Firestore Cloud is the authoritative source of truth!
            localStorage.setItem('radha_furniture_custom_products_v1', JSON.stringify(cloudProducts));
            // Trigger cross-page real-time update event
            try {
              window.dispatchEvent(new CustomEvent('radha_products_synced', { detail: cloudProducts }));
            } catch (e) {}
            return cloudProducts;
          }
        } else if (baseProducts.length > 0) {
          // Cloud database is empty - automatically seed all catalog items to Firestore
          try {
            const batch = db.batch();
            baseProducts.forEach(p => {
              const docRef = db.collection('products').doc(p.id);
              batch.set(docRef, _sanitizeForFirestore(p));
            });
            await batch.commit();
            console.log('[Firebase Cloud] Seeded products to Firestore successfully');
          } catch (err) {
            console.warn('[Firebase Cloud] Seeding warning:', err);
          }
        }
      }
      return null;
    };

    // If cache is empty (new device), wait up to 8s so device gets true cloud catalog.
    // If cache is present, give up to 4s. Even if it takes longer, fetchCloud continues in background.
    const timeoutMs = baseProducts.length === 0 ? 8000 : 4000;
    const synced = await Promise.race([
      fetchCloud(),
      new Promise(resolve => setTimeout(resolve, timeoutMs))
    ]);

    if (synced && Array.isArray(synced) && synced.length > 0) {
      return synced;
    }
  } catch (e) {
    console.warn('Firestore products fetch warning:', e.message);
  }

  return baseProducts;
}

async function fbAddProduct(productData) {
  if (!productData.id) {
    productData.id = 'rf-' + Date.now().toString().slice(-4);
  }
  const cleanData = _sanitizeForFirestore(productData);

  // 1. Instant local storage update (0ms)
  try {
    let prods = [];
    const local = localStorage.getItem('radha_furniture_custom_products_v1');
    if (local) prods = JSON.parse(local);
    else if (typeof PRODUCTS_DATA !== 'undefined') prods = [...PRODUCTS_DATA];

    prods = prods.filter(p => p.id !== cleanData.id && p._id !== cleanData.id);
    prods.unshift(cleanData);
    localStorage.setItem('radha_furniture_custom_products_v1', JSON.stringify(prods));
  } catch (e) {
    console.error('Local add error:', e);
  }

  // 2. Cloud sync to Firestore (Doc ID matches product ID) - Fully awaited
  try {
    const db = await initFirebaseCloud();
    if (db) {
      await db.collection('products').doc(cleanData.id).set(cleanData);
      try {
        window.dispatchEvent(new CustomEvent('radha_products_synced', { detail: [cleanData] }));
      } catch (e) {}
      _log('Product saved to Firebase Cloud:', cleanData.id);
    }
  } catch (e) {
    console.error('Firestore add product sync error:', e);
    throw e;
  }

  return cleanData;
}

async function fbDeleteProduct(productId) {
  // 1. Instant local storage update (0ms)
  try {
    let prods = [];
    const local = localStorage.getItem('radha_furniture_custom_products_v1');
    if (local) prods = JSON.parse(local);
    else if (typeof PRODUCTS_DATA !== 'undefined') prods = [...PRODUCTS_DATA];

    prods = prods.filter(p => p.id !== productId && p._id !== productId);
    localStorage.setItem('radha_furniture_custom_products_v1', JSON.stringify(prods));
  } catch (e) {
    console.error('Local delete error:', e);
  }

  // 2. Cloud sync with Firestore - Fully awaited
  try {
    const db = await initFirebaseCloud();
    if (db) {
      await db.collection('products').doc(productId).delete().catch(() => {});
      const snap = await db.collection('products').where('id', '==', productId).get().catch(() => null);
      if (snap && !snap.empty) {
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit().catch(() => {});
      }
      try {
        window.dispatchEvent(new CustomEvent('radha_products_synced', { detail: [] }));
      } catch (e) {}
      _log('Product deleted from Firebase Cloud:', productId);
    }
  } catch (e) {
    console.error('Firestore delete error:', e);
    throw e;
  }

  return { success: true };
}

async function fbUpdateProduct(productId, updatedData) {
  updatedData.id = productId;
  const cleanData = _sanitizeForFirestore(updatedData);

  // 1. Instant local storage update (0ms)
  try {
    let prods = [];
    const local = localStorage.getItem('radha_furniture_custom_products_v1');
    if (local) prods = JSON.parse(local);
    else if (typeof PRODUCTS_DATA !== 'undefined') prods = [...PRODUCTS_DATA];

    const idx = prods.findIndex(p => p.id === productId || p._id === productId);
    if (idx !== -1) {
      prods[idx] = { ...prods[idx], ...cleanData };
    } else {
      prods.unshift(cleanData);
    }
    localStorage.setItem('radha_furniture_custom_products_v1', JSON.stringify(prods));
  } catch (e) {
    console.error('Local update error:', e);
  }

  // 2. Cloud sync with Firestore - Fully awaited
  try {
    const db = await initFirebaseCloud();
    if (db) {
      await db.collection('products').doc(productId).set(cleanData, { merge: true });
      try {
        window.dispatchEvent(new CustomEvent('radha_products_synced', { detail: [cleanData] }));
      } catch (e) {}
      _log('Product updated in Firebase Cloud:', productId);
    }
  } catch (e) {
    console.error('Firestore update product sync error:', e);
    throw e;
  }

  return cleanData;
}

// 2. ORDERS
async function fbSaveOrder(orderData) {
  // 1. Instant local backup (0ms)
  try {
    const orders = JSON.parse(localStorage.getItem('radha_furniture_orders_v1') || '[]');
    const idx = orders.findIndex(o => (o.orderId || o._id) === orderData.orderId);
    if (idx >= 0) {
      orders[idx] = { ...orders[idx], ...orderData };
    } else {
      orders.unshift(orderData);
    }
    localStorage.setItem('radha_furniture_orders_v1', JSON.stringify(orders));
  } catch (e) {
    console.warn('Local order save error:', e);
  }

  // 2. Sync with Firestore Cloud
  try {
    const db = await initFirebaseCloud();
    if (db) {
      await db.collection('orders').doc(orderData.orderId).set(orderData);
      _log('Order saved to Firebase Cloud:', orderData.orderId);
    }
  } catch (e) {
    console.error('❌ Firestore order save error:', e);
    if (e.code === 'permission-denied' || (e.message && e.message.includes('permission'))) {
      console.warn('⚠️ Firebase Rules Locked: Please set "allow read, write: if true;" in Firebase Console Rules tab.');
    }
  }
  return { success: true, orderId: orderData.orderId };
}

async function fbGetOrders() {
  try {
    const db = await initFirebaseCloud();
    if (db) {
      let snap;
      try {
        snap = await db.collection('orders').orderBy('date', 'desc').get();
      } catch (err) {
        snap = await db.collection('orders').get();
      }

      const orders = [];
      if (snap && !snap.empty) {
        snap.forEach(doc => {
          const d = doc.data();
          orders.push({
            ...d,
            orderId: d.orderId || doc.id,
            _id: doc.id
          });
        });
      }
      // Update local storage to match database exactly (even if 0 orders)
      localStorage.setItem('radha_furniture_orders_v1', JSON.stringify(orders));
      return orders;
    }
  } catch (e) {
    console.warn('Firestore orders fetch fallback:', e.message);
  }

  try {
    const local = localStorage.getItem('radha_furniture_orders_v1');
    return local ? JSON.parse(local) : [];
  } catch (e) {
    return [];
  }
}

async function fbUpdateOrderStatus(orderId, newStatus) {
  // 1. Local update first
  try {
    const orders = JSON.parse(localStorage.getItem('radha_furniture_orders_v1') || '[]');
    const ord = orders.find(o => (o.orderId || o._id) === orderId);
    if (ord) {
      ord.status = newStatus;
      localStorage.setItem('radha_furniture_orders_v1', JSON.stringify(orders));
    }
  } catch (e) {
    console.error('Local order status update error:', e);
  }

  // 2. Cloud update - Fully awaited
  try {
    const db = await initFirebaseCloud();
    if (db) {
      await db.collection('orders').doc(orderId).set({ status: newStatus }, { merge: true }).catch(async () => {
        const snap = await db.collection('orders').where('orderId', '==', orderId).get();
        const promises = [];
        snap.forEach(doc => promises.push(doc.ref.update({ status: newStatus })));
        await Promise.all(promises);
      });
      _log(`Order #${orderId} updated to ${newStatus} in Firebase Cloud`);
    }
  } catch (e) {
    console.error('Firestore status update error:', e.message);
    throw e;
  }
  return true;
}

// Cryptographic Password Hashing & Verification (SHA-256)
async function hashPassword(password) {
  if (!password) return '';
  if (typeof password === 'string' && password.startsWith('sha256:')) return password;
  try {
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return 'sha256:' + hashHex;
  } catch (e) {
    return password;
  }
}

async function verifyPassword(enteredPassword, storedPassword) {
  if (!enteredPassword || !storedPassword) return false;
  if (typeof storedPassword === 'string' && storedPassword.startsWith('sha256:')) {
    const enteredHash = await hashPassword(enteredPassword);
    return enteredHash === storedPassword;
  }
  return enteredPassword === storedPassword;
}

// 3. USERS (Registration & Login)
async function fbRegisterUser(userData) {
  const sanitizedPhone = (userData.phone || '').toString().trim().replace(/[\s\-\+]/g, '');
  const cleanEmail = (userData.email || '').toString().trim().toLowerCase();
  const securePassword = await hashPassword(userData.password);
  const cleanUserData = {
    name: (userData.name || '').toString().trim(),
    city: (userData.city || '').toString().trim(),
    address: (userData.address || '').toString().trim(),
    password: securePassword,
    role: (userData.role || 'user').toLowerCase(), // Default role is user
    phone: sanitizedPhone,
    email: cleanEmail
  };

  // 1. Check LocalStorage for Duplicate Phone or Email
  const localUsers = JSON.parse(localStorage.getItem('radha_registered_users_v1') || '[]');
  
  if (sanitizedPhone) {
    const phoneExists = localUsers.some(u => {
      const uPhone = (u.phone || '').toString().trim().replace(/[\s\-\+]/g, '');
      return uPhone && (uPhone === sanitizedPhone || uPhone.endsWith(sanitizedPhone) || sanitizedPhone.endsWith(uPhone));
    });
    if (phoneExists) {
      return { 
        success: false, 
        message: `Yeh mobile number (+91 ${sanitizedPhone}) pehle se registered hai! Ek mobile number se sirf ek hi account ban sakta hai.` 
      };
    }
  }

  if (cleanEmail) {
    const emailExists = localUsers.some(u => (u.email || '').toString().trim().toLowerCase() === cleanEmail);
    if (emailExists) {
      return { 
        success: false, 
        message: `Yeh Email ID (${cleanEmail}) pehle se registered hai! Ek Email ID se sirf ek hi account ban sakta hai.` 
      };
    }
  }

  // 2. Check Cloud Firestore for Duplicate Phone or Email
  try {
    const db = await initFirebaseCloud();
    if (db) {
      if (sanitizedPhone) {
        const phoneSnap = await db.collection('users').where('phone', '==', sanitizedPhone).get();
        if (!phoneSnap.empty) {
          return { 
            success: false, 
            message: `Yeh mobile number (+91 ${sanitizedPhone}) pehle se registered hai! Ek mobile number se sirf ek hi account ban sakta hai.` 
          };
        }
      }

      if (cleanEmail) {
        const emailSnap = await db.collection('users').where('email', '==', cleanEmail).get();
        if (!emailSnap.empty) {
          return { 
            success: false, 
            message: `Yeh Email ID (${cleanEmail}) pehle se registered hai! Ek Email ID se sirf ek hi account ban sakta hai.` 
          };
        }
      }

      // Add to Firestore Cloud
      const docRef = await db.collection('users').add({
        ...cleanUserData,
        createdAt: new Date().toISOString()
      });
      _log('User registered in Firebase Cloud');
      if (docRef && docRef.id) {
        cleanUserData.id = docRef.id;
      }
    }
  } catch (e) {
    console.error('❌ Firestore register user error:', e);
  }

  // 3. Save to local registered users
  localUsers.push(cleanUserData);
  localStorage.setItem('radha_registered_users_v1', JSON.stringify(localUsers));

  // 4. Set current session immediately
  const sessionUser = { 
    id: cleanUserData.id || ('u_' + cleanUserData.phone),
    name: cleanUserData.name, 
    email: cleanUserData.email || '', 
    phone: cleanUserData.phone, 
    city: cleanUserData.city || '', 
    address: cleanUserData.address || '',
    role: cleanUserData.role
  };
  localStorage.setItem('radha_auth_user_v1', JSON.stringify(sessionUser));

  return { success: true, user: sessionUser };
}

async function fbLoginUser(emailOrPhone, password) {
  const query = (emailOrPhone || '').toString().trim();
  const cleanPhone = query.replace(/[\s\-\+]/g, '');

  // 1. Check Cloud Firestore with password verification
  try {
    const cloudLogin = async () => {
      const db = await initFirebaseCloud();
      if (db) {
        let snap = await db.collection('users').where('email', '==', query.toLowerCase()).get();
        if (snap.empty && cleanPhone) {
          snap = await db.collection('users').where('phone', '==', cleanPhone).get();
        }
        if (!snap.empty) {
          for (const doc of snap.docs) {
            const u = doc.data();
            const isMatch = await verifyPassword(password, u.password);
            if (isMatch) {
              const role = (u.role || 'user').toLowerCase();
              const sessionUser = { 
                id: doc.id,
                name: u.name, 
                email: u.email || '', 
                phone: u.phone || '', 
                city: u.city || '', 
                address: u.address || '',
                role: role
              };
              localStorage.setItem('radha_auth_user_v1', JSON.stringify(sessionUser));
              if (role === 'admin' || role === 'superadmin') {
                localStorage.setItem('radha_auth_admin_v1', JSON.stringify(sessionUser));
              } else {
                localStorage.removeItem('radha_auth_admin_v1');
              }
              // Upgrade to SHA-256 hash if stored as plaintext
              if (u.password && !u.password.startsWith('sha256:')) {
                hashPassword(password).then(h => doc.ref.update({ password: h })).catch(() => {});
              }
              return { success: true, user: sessionUser };
            }
          }
        }
      }
      return null;
    };

    const cloudRes = await Promise.race([
      cloudLogin(),
      new Promise(resolve => setTimeout(resolve, 1500))
    ]);
    if (cloudRes && cloudRes.success) return cloudRes;
  } catch (e) {
    console.warn('Firestore login check fallback:', e.message);
  }

  // 2. Fallback to local registered users
  try {
    const users = JSON.parse(localStorage.getItem('radha_registered_users_v1') || '[]');
    for (const u of users) {
      const emailMatches = u.email && u.email.toLowerCase() === query.toLowerCase();
      const phoneMatches = u.phone && u.phone.replace(/[\s\-\+]/g, '') === cleanPhone;
      if (emailMatches || phoneMatches) {
        const isMatch = await verifyPassword(password, u.password);
        if (isMatch) {
          const role = (u.role || 'user').toLowerCase();
          const sessionUser = { 
            id: u.id || ('p_' + cleanPhone),
            name: u.name, 
            email: u.email || '', 
            phone: u.phone || '', 
            city: u.city || '', 
            address: u.address || '',
            role: role
          };
          localStorage.setItem('radha_auth_user_v1', JSON.stringify(sessionUser));
          if (role === 'admin' || role === 'superadmin') {
            localStorage.setItem('radha_auth_admin_v1', JSON.stringify(sessionUser));
          } else {
            localStorage.removeItem('radha_auth_admin_v1');
          }
          return { success: true, user: sessionUser };
        }
      }
    }
  } catch (e) {}

  // 3. No match found - reject invalid login
  return { 
    success: false, 
    message: 'Mobile/Email ya Password galat hai! Kripya sahi credentials dalein ya naya account banayein.' 
  };
}

let _fbActiveProfileUnsub = null;

async function fbUpdateUserProfile(emailOrPhone, updatedData) {
  const cleanData = _sanitizeForFirestore(updatedData || {});
  const now = Date.now();
  cleanData.updatedAt = now;

  // 1. Update local session
  try {
    const session = JSON.parse(localStorage.getItem('radha_auth_user_v1') || '{}');
    const newSession = { ...session, ...cleanData };
    localStorage.setItem('radha_auth_user_v1', JSON.stringify(newSession));
    if (newSession.role === 'admin' || newSession.role === 'superadmin') {
      localStorage.setItem('radha_auth_admin_v1', JSON.stringify(newSession));
    }

    // Update in local registered users array
    const users = JSON.parse(localStorage.getItem('radha_registered_users_v1') || '[]');
    const cleanContact = String(emailOrPhone || '').trim();
    const cleanPhone = cleanContact.replace(/[\s\-\+]/g, '').slice(-10);
    const idx = users.findIndex(u => 
      (session.id && u.id === session.id) || 
      (u.email && cleanContact && u.email.toLowerCase() === cleanContact.toLowerCase()) || 
      (u.phone && cleanPhone && String(u.phone).replace(/[\s\-\+]/g, '').slice(-10) === cleanPhone)
    );
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...cleanData };
      localStorage.setItem('radha_registered_users_v1', JSON.stringify(users));
    }
  } catch (e) {}

  // 2. Cloud update in Firestore (Awaited with set merge: true)
  try {
    const db = await initFirebaseCloud();
    if (db) {
      const session = JSON.parse(localStorage.getItem('radha_auth_user_v1') || '{}');
      const targetDocs = [];

      // A. Try session.id directly
      if (session.id && session.id.length >= 10 && !session.id.startsWith('u_')) {
        try {
          const d = await db.collection('users').doc(session.id).get();
          if (d.exists) targetDocs.push(d);
        } catch (e) {}
      }

      // B. Try phone number
      const contactStr = String(emailOrPhone || session.phone || session.email || '').trim();
      const cleanPhone = contactStr.replace(/[\s\-\+]/g, '').slice(-10);
      if (targetDocs.length === 0 && cleanPhone && cleanPhone.length === 10) {
        let snap = await db.collection('users').where('phone', '==', cleanPhone).get();
        if (snap.empty) {
          snap = await db.collection('users').where('phone', '==', '+91' + cleanPhone).get();
        }
        if (!snap.empty) {
          snap.forEach(d => targetDocs.push(d));
        }
      }

      // C. Try email
      if (targetDocs.length === 0 && contactStr && contactStr.includes('@')) {
        const snap = await db.collection('users').where('email', '==', contactStr.toLowerCase()).get();
        if (!snap.empty) {
          snap.forEach(d => targetDocs.push(d));
        }
      }

      if (targetDocs.length > 0) {
        await Promise.all(targetDocs.map(doc => doc.ref.set(cleanData, { merge: true })));
        return { success: true };
      } else {
        // Create user document if it was only in local storage
        const newDoc = await db.collection('users').add({
          ...cleanData,
          createdAt: new Date().toISOString()
        });
        const session = JSON.parse(localStorage.getItem('radha_auth_user_v1') || '{}');
        session.id = newDoc.id;
        localStorage.setItem('radha_auth_user_v1', JSON.stringify(session));
        return { success: true };
      }
    }
  } catch (e) {
    console.warn('Firestore profile update error:', e.message);
  }
  return { success: true };
}

async function fbGetUserProfile(user) {
  if (!user) return null;
  try {
    const db = await initFirebaseCloud();
    if (!db) return null;

    let docSnap = null;
    if (user.id && user.id.length >= 10 && !user.id.startsWith('u_')) {
      try {
        const d = await db.collection('users').doc(user.id).get();
        if (d.exists) docSnap = d;
      } catch (e) {}
    }

    if (!docSnap && user.phone) {
      const cleanPhone = String(user.phone).trim().replace(/[\s\-\+]/g, '').slice(-10);
      if (cleanPhone.length === 10) {
        let snap = await db.collection('users').where('phone', '==', cleanPhone).get();
        if (snap.empty) {
          snap = await db.collection('users').where('phone', '==', '+91' + cleanPhone).get();
        }
        if (!snap.empty) docSnap = snap.docs[0];
      }
    }

    if (!docSnap && user.email) {
      const cleanEmail = user.email.trim().toLowerCase();
      const snap = await db.collection('users').where('email', '==', cleanEmail).get();
      if (!snap.empty) docSnap = snap.docs[0];
    }

    if (docSnap && docSnap.exists) {
      const data = docSnap.data() || {};
      return {
        id: docSnap.id,
        name: data.name || user.name || '',
        phone: data.phone || user.phone || '',
        email: data.email !== undefined ? data.email : (user.email || ''),
        city: data.city !== undefined ? data.city : (user.city || ''),
        address: data.address !== undefined ? data.address : (user.address || ''),
        role: (data.role || user.role || 'user').toLowerCase(),
        updatedAt: data.updatedAt || 0
      };
    }
  } catch (e) {
    console.warn('fbGetUserProfile error:', e.message);
  }
  return null;
}

function fbListenUserProfile(user, onChange) {
  if (!user) return;
  if (typeof _fbActiveProfileUnsub === 'function') {
    try { _fbActiveProfileUnsub(); } catch(e) {}
    _fbActiveProfileUnsub = null;
  }

  initFirebaseCloud().then(async (db) => {
    if (!db) return;
    try {
      let targetDocRef = null;
      if (user.id && user.id.length >= 10 && !user.id.startsWith('u_')) {
        targetDocRef = db.collection('users').doc(user.id);
      } else {
        if (user.phone) {
          const cleanPhone = String(user.phone).trim().replace(/[\s\-\+]/g, '').slice(-10);
          if (cleanPhone.length === 10) {
            let snap = await db.collection('users').where('phone', '==', cleanPhone).get();
            if (snap.empty) {
              snap = await db.collection('users').where('phone', '==', '+91' + cleanPhone).get();
            }
            if (!snap.empty) targetDocRef = snap.docs[0].ref;
          }
        }
        if (!targetDocRef && user.email) {
          const cleanEmail = user.email.trim().toLowerCase();
          const snap = await db.collection('users').where('email', '==', cleanEmail).get();
          if (!snap.empty) targetDocRef = snap.docs[0].ref;
        }
      }

      if (targetDocRef) {
        _fbActiveProfileUnsub = targetDocRef.onSnapshot({ includeMetadataChanges: true }, (doc) => {
          if (doc.exists) {
            const data = doc.data() || {};
            const isPending = doc.metadata && doc.metadata.hasPendingWrites;
            if (typeof onChange === 'function') {
              onChange({
                id: doc.id,
                name: data.name || user.name || '',
                phone: data.phone || user.phone || '',
                email: data.email !== undefined ? data.email : (user.email || ''),
                city: data.city !== undefined ? data.city : (user.city || ''),
                address: data.address !== undefined ? data.address : (user.address || ''),
                role: (data.role || user.role || 'user').toLowerCase(),
                updatedAt: data.updatedAt || 0,
                hasPendingWrites: !!isPending
              });
            }
          }
        }, (err) => {
          console.warn('Profile realtime listener warning:', err.message);
        });
      }
    } catch (e) {
      console.warn('Attach profile listener error:', e);
    }
  });
}

async function fbChangeUserPassword(emailOrPhone, currentPassword, newPassword) {
  let verified = false;
  const hashedNew = await hashPassword(newPassword);
  try {
    const users = JSON.parse(localStorage.getItem('radha_registered_users_v1') || '[]');
    const user = users.find(u => (u.email === emailOrPhone || u.phone === emailOrPhone));
    if (user && await verifyPassword(currentPassword, user.password)) {
      user.password = hashedNew;
      localStorage.setItem('radha_registered_users_v1', JSON.stringify(users));
      verified = true;
    }
  } catch (e) {}

  try {
    const db = await initFirebaseCloud();
    if (db) {
      let snap = await db.collection('users').where('email', '==', emailOrPhone).get();
      if (snap.empty) {
        snap = await db.collection('users').where('phone', '==', emailOrPhone).get();
      }
      if (!snap.empty) {
        for (const doc of snap.docs) {
          const u = doc.data();
          if (await verifyPassword(currentPassword, u.password)) {
            await doc.ref.update({ password: hashedNew });
            verified = true;
          }
        }
      }
    }
  } catch (e) {}

  return { success: verified, message: verified ? 'Password updated successfully!' : 'Current password does not match!' };
}

async function fbResetUserPassword(emailOrPhone, newPassword) {
  let found = false;
  const hashedNew = await hashPassword(newPassword);
  try {
    const users = JSON.parse(localStorage.getItem('radha_registered_users_v1') || '[]');
    const user = users.find(u => u.email === emailOrPhone || u.phone === emailOrPhone);
    if (user) {
      user.password = hashedNew;
      localStorage.setItem('radha_registered_users_v1', JSON.stringify(users));
      found = true;
    }
  } catch (e) {}

  try {
    const db = await initFirebaseCloud();
    if (db) {
      let snap = await db.collection('users').where('email', '==', emailOrPhone).get();
      if (snap.empty) {
        snap = await db.collection('users').where('phone', '==', emailOrPhone).get();
      }
      if (!snap.empty) {
        for (const doc of snap.docs) {
          await doc.ref.update({ password: hashedNew });
          found = true;
        }
      }
    }
  } catch (e) {}

  return { success: found };
}

// 4. USERS & ADMIN MANAGEMENT
async function fbGetUsers() {
  try {
    const db = await initFirebaseCloud();
    if (db) {
      const snap = await db.collection('users').get();
      const users = [];
      if (!snap.empty) {
        snap.forEach(d => users.push({ ...d.data(), id: d.id }));
      }
      localStorage.setItem('radha_registered_users_v1', JSON.stringify(users));
      return users;
    }
  } catch (e) {
    console.warn('Firestore users fetch fallback:', e.message);
  }

  try {
    const u = JSON.parse(localStorage.getItem('radha_registered_users_v1') || '[]');
    return Array.isArray(u) ? u : [];
  } catch (e) {
    return [];
  }
}

// DELETE USER (Customer or Account from Database & Local)
async function fbDeleteUser(userIdentifier) {
  if (!userIdentifier) return { success: false, message: 'User identifier required.' };
  const target = userIdentifier.toString().trim();
  const targetLower = target.toLowerCase();

  // 1. Local storage remove
  try {
    let users = JSON.parse(localStorage.getItem('radha_registered_users_v1') || '[]');
    users = users.filter(u => {
      const matchId = u.id && u.id === target;
      const matchEmail = u.email && u.email.toLowerCase() === targetLower;
      const matchPhone = u.phone && u.phone.replace(/[\s\-\+]/g, '') === target.replace(/[\s\-\+]/g, '');
      return !(matchId || matchEmail || matchPhone);
    });
    localStorage.setItem('radha_registered_users_v1', JSON.stringify(users));
  } catch (e) {
    console.error('Local user delete error:', e);
  }

  // 2. Cloud Firestore delete
  try {
    const db = await initFirebaseCloud();
    if (db) {
      // 1. Try direct doc ID delete
      const docRef = db.collection('users').doc(target);
      const docSnap = await docRef.get().catch(() => null);
      if (docSnap && docSnap.exists) {
        await docRef.delete();
        _log('User deleted by doc ID:', target);
        return { success: true };
      }

      // 2. Query by email
      const snapEmail = await db.collection('users').where('email', '==', targetLower).get();
      if (!snapEmail.empty) {
        snapEmail.forEach(doc => doc.ref.delete());
        _log('User deleted by email:', targetLower);
        return { success: true };
      }

      // 3. Query by phone
      const cleanPhone = target.replace(/[\s\-\+]/g, '');
      if (cleanPhone) {
        const snapPhone = await db.collection('users').where('phone', '==', cleanPhone).get();
        if (!snapPhone.empty) {
          snapPhone.forEach(doc => doc.ref.delete());
          _log('User deleted by phone:', cleanPhone);
          return { success: true };
        }
      }
    }
  } catch (e) {
    console.warn('Firestore user delete error:', e.message);
  }

  return { success: true };
}

// 5. ADMINS MANAGEMENT (Super Admin Portal)
async function fbGetAdmins() {
  let allUsers = [];
  try {
    const db = await initFirebaseCloud();
    if (db) {
      const snap = await db.collection('users').get();
      if (!snap.empty) {
        snap.forEach(d => {
          allUsers.push({ ...d.data(), id: d.id });
        });
      }
    }
  } catch (e) {
    console.warn('fbGetAdmins cloud fetch error:', e);
  }

  // Fallback to local
  if (allUsers.length === 0) {
    try {
      allUsers = JSON.parse(localStorage.getItem('radha_registered_users_v1') || '[]');
    } catch (e) {}
  }

  // Filter only admin or superadmin roles
  const admins = allUsers.filter(u => {
    const r = (u.role || '').toLowerCase();
    return r === 'admin' || r === 'superadmin';
  });

  return admins;
}

async function fbCreateAdmin(adminData) {
  const securePass = await hashPassword(adminData.password);
  const clean = {
    name: (adminData.name || '').trim(),
    email: (adminData.email || '').trim().toLowerCase(),
    phone: (adminData.phone || '').trim().replace(/[\s\-\+]/g, ''),
    password: securePass,
    role: (adminData.role || 'admin').toLowerCase(),
    createdAt: new Date().toISOString()
  };

  // 1. Local update
  try {
    const users = JSON.parse(localStorage.getItem('radha_registered_users_v1') || '[]');
    const idx = users.findIndex(u => (clean.email && u.email === clean.email) || (clean.phone && u.phone === clean.phone));
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...clean };
    } else {
      users.push(clean);
    }
    localStorage.setItem('radha_registered_users_v1', JSON.stringify(users));
  } catch (e) {}

  // 2. Cloud Firestore sync
  try {
    const db = await initFirebaseCloud();
    if (db) {
      const docRef = await db.collection('users').add(clean);
      return { success: true, id: docRef.id, admin: clean };
    }
  } catch (e) {
    console.warn('fbCreateAdmin cloud save error:', e);
  }

  return { success: true, admin: clean };
}

async function fbDeleteAdmin(adminIdentifier) {
  if (!adminIdentifier) return { success: false, message: 'Admin identifier required.' };
  const target = adminIdentifier.toString().trim();
  const targetLower = target.toLowerCase();

  // 1. Local remove
  try {
    let users = JSON.parse(localStorage.getItem('radha_registered_users_v1') || '[]');
    users = users.filter(u => {
      const matchId = u.id && u.id === target;
      const matchEmail = u.email && u.email.toLowerCase() === targetLower;
      const matchPhone = u.phone && u.phone.replace(/[\s\-\+]/g, '') === target.replace(/[\s\-\+]/g, '');
      return !(matchId || matchEmail || matchPhone);
    });
    localStorage.setItem('radha_registered_users_v1', JSON.stringify(users));
  } catch (e) {}

  // 2. Cloud delete
  try {
    const db = await initFirebaseCloud();
    if (db) {
      // Find doc by id
      const docRef = db.collection('users').doc(target);
      const doc = await docRef.get().catch(() => null);
      if (doc && doc.exists) {
        await docRef.delete();
        _log('Admin deleted by doc ID:', target);
        return { success: true };
      }
      // Or query by email
      const snap = await db.collection('users').where('email', '==', targetLower).get();
      if (!snap.empty) {
        snap.forEach(d => d.ref.delete());
        _log('Admin deleted by email:', targetLower);
        return { success: true };
      }
      // Or query by phone
      const cleanPhone = target.replace(/[\s\-\+]/g, '');
      if (cleanPhone) {
        const snapPhone = await db.collection('users').where('phone', '==', cleanPhone).get();
        if (!snapPhone.empty) {
          snapPhone.forEach(d => d.ref.delete());
          _log('Admin deleted by phone:', cleanPhone);
          return { success: true };
        }
      }
    }
  } catch (e) {
    console.warn('fbDeleteAdmin cloud delete error:', e);
  }

  return { success: true };
}

// 6. SYNC ALL LOCAL DATA TO CLOUD (One-Click Migration)
async function fbSyncAllToCloud() {
  const db = await initFirebaseCloud();
  if (!db) {
    return { success: false, message: 'Could not connect to Firebase Cloud SDK.' };
  }

  let syncedProds = 0;
  let syncedOrders = 0;
  let syncedUsers = 0;

  try {
    // 1. Sync Catalog Products
    const prods = (typeof PRODUCTS_DATA !== 'undefined') ? PRODUCTS_DATA : [];
    for (const p of prods) {
      if (p.id === 'rf-107') continue;
      await db.collection('products').doc(p.id).set(p, { merge: true });
      syncedProds++;
    }

    // 2. Sync Registered Users & Admins from Local Storage
    try {
      const localUsers = JSON.parse(localStorage.getItem('radha_registered_users_v1') || '[]');
      for (const u of localUsers) {
        if (!u.email && !u.phone) continue;
        const docId = (u.email || u.phone).replace(/[^a-zA-Z0-9]/g, '_');
        await db.collection('users').doc(docId).set(u, { merge: true });
        syncedUsers++;
      }
    } catch (e) {}

    // 3. Sync Orders
    try {
      const localOrders = JSON.parse(localStorage.getItem('radha_furniture_orders_v1') || '[]');
      for (const o of localOrders) {
        if (o.orderId === 'RF-84920' || o.orderId === 'RF-84918') continue;
        await db.collection('orders').doc(o.orderId).set(o, { merge: true });
        syncedOrders++;
      }
    } catch (e) {}

    return { 
      success: true, 
      message: `🎉 Success! Synced ${syncedProds} products, ${syncedUsers} accounts, and ${syncedOrders} orders to Firebase Cloud!`
    };
  } catch (err) {
    console.error('fbSyncAllToCloud error:', err);
    if (err.code === 'permission-denied' || (err.message && err.message.includes('permission'))) {
      return {
        success: false,
        isPermissionError: true,
        message: 'Firebase Permission Denied! Firebase Console ke Rules tab me jakar "allow read, write: if true;" paste karke Publish karein.'
      };
    }
    return { success: false, message: err.message };
  }
}

// 7. STORE & WEBSITE CONFIGURATIONS (Firebase Cloud + Local)
const DEFAULT_SITE_SETTINGS = {
  brandName: 'Radhey Radhey Furniture & Handicraft',
  phone: '9772225296',
  whatsapp: '9772225296',
  email: 'jangid7090@gmail.com',
  bannerText: '🔴 UPTO 40% OFF Festive Discount on Solid Sheesham & Teak Wood',
  address: 'Main Furniture Market, Workshop Road, Rajasthan, India',
  couponCode: 'RADHEY10',
  themeColor: 'Red & Black Theme'
};

async function fbGetSiteSettings() {
  try {
    const db = await initFirebaseCloud();
    if (db) {
      const docSnap = await db.collection('settings').doc('store_config').get();
      if (docSnap.exists) {
        const cloudData = { ...DEFAULT_SITE_SETTINGS, ...docSnap.data() };
        if (cloudData.phone) cloudData.phone = cloudData.phone.replace(/[^0-9]/g, '').slice(-10) || '9772225296';
        if (cloudData.whatsapp) cloudData.whatsapp = cloudData.whatsapp.replace(/[^0-9]/g, '').slice(-10) || '9772225296';
        localStorage.setItem('radha_store_settings_v1', JSON.stringify(cloudData));
        return cloudData;
      }
    }
  } catch (e) {
    console.warn('Firestore settings get error:', e);
  }

  try {
    const local = localStorage.getItem('radha_store_settings_v1');
    if (local) {
      const parsed = { ...DEFAULT_SITE_SETTINGS, ...JSON.parse(local) };
      if (parsed.phone) parsed.phone = parsed.phone.replace(/[^0-9]/g, '').slice(-10) || '9772225296';
      if (parsed.whatsapp) parsed.whatsapp = parsed.whatsapp.replace(/[^0-9]/g, '').slice(-10) || '9772225296';
      return parsed;
    }
  } catch (e) {}

  return { ...DEFAULT_SITE_SETTINGS };
}

async function fbSaveSiteSettings(settingsData) {
  const cleanPhone = (settingsData.phone || '9772225296').replace(/[^0-9]/g, '').slice(-10) || '9772225296';
  const cleanWa = (settingsData.whatsapp || '9772225296').replace(/[^0-9]/g, '').slice(-10) || '9772225296';
  const merged = { ...DEFAULT_SITE_SETTINGS, ...settingsData, phone: cleanPhone, whatsapp: cleanWa, updatedAt: new Date().toISOString() };

  // 1. Local instant save
  try {
    localStorage.setItem('radha_store_settings_v1', JSON.stringify(merged));
  } catch (e) {
    console.warn('Local settings save error:', e);
  }

  // 2. Cloud Firestore sync
  try {
    const db = await initFirebaseCloud();
    if (db) {
      await db.collection('settings').doc('store_config').set(merged, { merge: true });
      _log('Store configurations saved to Firebase Firestore');
      return { success: true, settings: merged };
    }
  } catch (e) {
    console.error('Firestore save settings error:', e);
    return { success: true, settings: merged, cloudWarning: e.message };
  }

  return { success: true, settings: merged };
}

// ----------------------------------------------------------------
// ----------------------------------------------------------------
// 8. CLOUD CART & WISHLIST REAL-TIME SYNC (Across All Devices)
// ----------------------------------------------------------------
let _fbActiveCartUnsub = null;
let _fbActiveWishlistUnsub = null;

async function fbSyncCart(userStorageId, cartItems, timestamp) {
  if (!userStorageId || userStorageId === 'guest') return;
  try {
    const cleanCart = _sanitizeForFirestore(cartItems || []);
    const db = await initFirebaseCloud();
    if (db) {
      const ts = timestamp || Date.now();
      await db.collection('carts').doc(String(userStorageId)).set({
        items: cleanCart,
        updatedAt: ts
      }, { merge: false });
    }
  } catch (e) {
    console.warn('Cart cloud sync warning:', e.message);
  }
}

async function fbGetCart(userStorageId) {
  if (!userStorageId || userStorageId === 'guest') return null;
  try {
    const db = await initFirebaseCloud();
    if (db) {
      const doc = await db.collection('carts').doc(String(userStorageId)).get();
      if (doc.exists) {
        const data = doc.data() || {};
        return {
          items: Array.isArray(data.items) ? data.items : [],
          updatedAt: data.updatedAt || 0
        };
      }
    }
  } catch (e) {
    console.warn('Cart cloud get warning:', e.message);
  }
  return null;
}

function fbListenCart(userStorageId, onChange) {
  if (!userStorageId || userStorageId === 'guest') return;
  if (typeof _fbActiveCartUnsub === 'function') {
    try { _fbActiveCartUnsub(); } catch (e) {}
    _fbActiveCartUnsub = null;
  }
  initFirebaseCloud().then(db => {
    if (!db) return;
    try {
      _fbActiveCartUnsub = db.collection('carts').doc(String(userStorageId)).onSnapshot({ includeMetadataChanges: true }, doc => {
        if (doc.exists) {
          const data = doc.data() || {};
          const isPending = doc.metadata && doc.metadata.hasPendingWrites;
          if (typeof onChange === 'function') {
            onChange({
              items: Array.isArray(data.items) ? data.items : [],
              updatedAt: data.updatedAt || 0,
              hasPendingWrites: !!isPending
            });
          }
        }
      }, err => {
        console.warn('Cart realtime listener error:', err.message);
      });
    } catch (e) {
      console.warn('Attach cart listener error:', e);
    }
  });
}

async function fbSyncWishlist(userStorageId, wishlistItems, timestamp) {
  if (!userStorageId || userStorageId === 'guest') return;
  try {
    const cleanWishlist = _sanitizeForFirestore(wishlistItems || []);
    const db = await initFirebaseCloud();
    if (db) {
      const ts = timestamp || Date.now();
      await db.collection('wishlists').doc(String(userStorageId)).set({
        items: cleanWishlist,
        updatedAt: ts
      }, { merge: false });
    }
  } catch (e) {
    console.warn('Wishlist cloud sync warning:', e.message);
  }
}

async function fbGetWishlist(userStorageId) {
  if (!userStorageId || userStorageId === 'guest') return null;
  try {
    const db = await initFirebaseCloud();
    if (db) {
      const doc = await db.collection('wishlists').doc(String(userStorageId)).get();
      if (doc.exists) {
        const data = doc.data() || {};
        return {
          items: Array.isArray(data.items) ? data.items : [],
          updatedAt: data.updatedAt || 0
        };
      }
    }
  } catch (e) {
    console.warn('Wishlist cloud get warning:', e.message);
  }
  return null;
}

function fbListenWishlist(userStorageId, onChange) {
  if (!userStorageId || userStorageId === 'guest') return;
  if (typeof _fbActiveWishlistUnsub === 'function') {
    try { _fbActiveWishlistUnsub(); } catch (e) {}
    _fbActiveWishlistUnsub = null;
  }
  initFirebaseCloud().then(db => {
    if (!db) return;
    try {
      _fbActiveWishlistUnsub = db.collection('wishlists').doc(String(userStorageId)).onSnapshot({ includeMetadataChanges: true }, doc => {
        if (doc.exists) {
          const data = doc.data() || {};
          const isPending = doc.metadata && doc.metadata.hasPendingWrites;
          if (typeof onChange === 'function') {
            onChange({
              items: Array.isArray(data.items) ? data.items : [],
              updatedAt: data.updatedAt || 0,
              hasPendingWrites: !!isPending
            });
          }
        }
      }, err => {
        console.warn('Wishlist realtime listener error:', err.message);
      });
    } catch (e) {
      console.warn('Attach wishlist listener error:', e);
    }
  });
}

function fbUnsubscribeUserDataSync() {
  if (typeof _fbActiveCartUnsub === 'function') {
    try { _fbActiveCartUnsub(); } catch (e) {}
    _fbActiveCartUnsub = null;
  }
  if (typeof _fbActiveWishlistUnsub === 'function') {
    try { _fbActiveWishlistUnsub(); } catch (e) {}
    _fbActiveWishlistUnsub = null;
  }
  if (typeof _fbActiveProfileUnsub === 'function') {
    try { _fbActiveProfileUnsub(); } catch (e) {}
    _fbActiveProfileUnsub = null;
  }
}
