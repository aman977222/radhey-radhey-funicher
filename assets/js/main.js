/* ================================================================
   RADHEY RADHEY FURNITURE & HANDICRAFT — MAIN CLIENT LOGIC
   Cart, Wishlist, Search, Modals, Toasts, and State Handling
   ================================================================ */

// LocalStorage Keys
const CART_STORAGE_KEY = 'radha_furniture_cart_v1';
const WISHLIST_STORAGE_KEY = 'radha_furniture_wishlist_v1';

// Dynamic User-Isolated Storage Helpers (Strict & Collision-Proof)
function getCleanUserIdentifier(user) {
  if (!user) return null;
  // 1. Normalized 10-digit phone
  let phone = String(user.phone || '').trim().replace(/[\s\-\+]/g, '');
  if (phone.startsWith('91') && phone.length === 12) phone = phone.slice(2);
  if (phone.startsWith('0') && phone.length === 11) phone = phone.slice(1);
  if (phone.length >= 10) {
    return 'p_' + phone.slice(-10);
  }
  // 2. Clean lowercase email
  if (user.email && user.email.trim()) {
    const email = user.email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (email) return 'e_' + email;
  }
  // 3. Explicit ID / UID
  if (user.id || user.userId || user.uid) {
    const uid = String(user.id || user.userId || user.uid).toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    if (uid) return 'id_' + uid;
  }
  // 4. Role + Name
  if (user.name) {
    const role = (user.role || 'user').toLowerCase();
    return role + '_' + user.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
  return null;
}

function getCurrentUserStorageId() {
  try {
    const user = getLoggedInCustomer();
    if (user) {
      const clean = getCleanUserIdentifier(user);
      if (clean) return 'user_' + clean;
    }
  } catch (e) { }
  return 'guest';
}

function getCartStorageKey() {
  return 'radha_furniture_cart_' + getCurrentUserStorageId();
}

function getWishlistStorageKey() {
  return 'radha_furniture_wishlist_' + getCurrentUserStorageId();
}

// Format Indian Rupee (e.g., ₹48,999)
function formatPrice(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

// ---------------------------------------------------------------
// CART MANAGEMENT (Strict User-Isolated & Login Protected)
// ---------------------------------------------------------------
function getCart() {
  const user = getLoggedInCustomer();
  if (!user) return []; // Non-logged-in users cannot view or have a cart

  try {
    const key = getCartStorageKey();
    const data = localStorage.getItem(key);
    if (data !== null) {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }

    // Seamless migration: check if items were saved under previous legacy key formats
    const legacyKeys = [];
    if (user.phone) {
      const cleanPhone = String(user.phone).trim().replace(/[\s\-\+]/g, '');
      legacyKeys.push('radha_furniture_cart_user_' + cleanPhone);
      if (cleanPhone.length >= 10) legacyKeys.push('radha_furniture_cart_user_' + cleanPhone.slice(-10));
    }
    if (user.email) {
      legacyKeys.push('radha_furniture_cart_user_' + user.email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));
    }
    if (user.name) {
      legacyKeys.push('radha_furniture_cart_user_' + user.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));
    }
    legacyKeys.push('radha_furniture_cart_v1');

    for (const lk of legacyKeys) {
      const legData = localStorage.getItem(lk);
      if (legData) {
        try {
          const parsed = JSON.parse(legData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localStorage.setItem(key, JSON.stringify(parsed));
            localStorage.removeItem(lk);
            return parsed;
          }
        } catch (e) { }
      }
    }

    localStorage.setItem(key, JSON.stringify([]));
    return [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  const user = getLoggedInCustomer();
  if (!user) return; // Cannot save cart without being logged in

  const now = Date.now();
  window.__lastLocalCartSaveTime = now;

  try {
    const key = getCartStorageKey();
    localStorage.setItem(key, JSON.stringify(cart));

    // Clear legacy keys so old items never resurrect
    if (user.phone) {
      const cleanPhone = String(user.phone).trim().replace(/[\s\-\+]/g, '');
      localStorage.removeItem('radha_furniture_cart_user_' + cleanPhone);
      if (cleanPhone.length >= 10) localStorage.removeItem('radha_furniture_cart_user_' + cleanPhone.slice(-10));
    }
    if (user.email) {
      localStorage.removeItem('radha_furniture_cart_user_' + user.email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));
    }
    if (user.name) {
      localStorage.removeItem('radha_furniture_cart_user_' + user.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));
    }
    localStorage.removeItem('radha_furniture_cart_v1');
  } catch (e) {
    console.warn('Cart save error:', e);
  }
  updateCartBadge();
  if (typeof fbSyncCart === 'function') {
    fbSyncCart(getCurrentUserStorageId(), cart, now);
  }
}

function addToCart(productId, quantity = 1, selectedFinish = null) {
  const user = getLoggedInCustomer();
  if (!user) {
    showToast('⚠️ Cart me add karne ke liye kripya pehle Login karein!', 'warning');
    const currentPathClean = window.location.pathname.replace(/\\/g, '/').toLowerCase();
    const isInUserFolder = currentPathClean.includes('/user/');
    const isInAdminFolder = currentPathClean.includes('/admin/');
    const isInAlumFolder = currentPathClean.includes('/aluminium products/') || currentPathClean.includes('/aluminium%20products/') || currentPathClean.includes('/aluminium-products/');
    const rootPrefix = (isInUserFolder || isInAdminFolder || isInAlumFolder) ? '../' : '';
    const currentPath = window.location.pathname.split('/').pop() + window.location.search;
    setTimeout(() => {
      window.location.href = rootPrefix + 'login.html?redirect=' + encodeURIComponent(currentPath || 'index.html');
    }, 1200);
    return;
  }

  const product = getProductById(productId);
  if (!product) {
    showToast('Product not found!', 'error');
    return;
  }

  const cart = getCart();
  const existingIndex = cart.findIndex(item => item.id === productId && item.finish === (selectedFinish || product.finish[0]));

  if (existingIndex > -1) {
    cart[existingIndex].quantity += quantity;
  } else {
    cart.push({
      id: product.id,
      title: product.title,
      price: product.price,
      originalPrice: product.originalPrice,
      image: product.image,
      woodType: product.woodType,
      finish: selectedFinish || (product.finish && product.finish[0]) || 'Standard',
      quantity: quantity
    });
  }

  saveCart(cart);
  showToast(`Added "${product.title.slice(0, 24)}..." to cart!`, 'success');
}

function updateCartQuantity(productId, finish, newQty) {
  const user = getLoggedInCustomer();
  if (!user) return;

  let cart = getCart();
  if (newQty <= 0) {
    cart = cart.filter(item => !(item.id === productId && item.finish === finish));
  } else {
    const item = cart.find(item => item.id === productId && item.finish === finish);
    if (item) item.quantity = newQty;
  }
  saveCart(cart);
}

function removeFromCart(productId, finish) {
  const user = getLoggedInCustomer();
  if (!user) return;

  let cart = getCart();
  cart = cart.filter(item => !(item.id === productId && item.finish === finish));
  saveCart(cart);
  showToast('Item removed from cart', 'info');
}

function getCartSubtotal() {
  const cart = getCart();
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function updateCartBadge() {
  const user = getLoggedInCustomer();
  const badges = document.querySelectorAll('.cart-count-badge, .cart-badge-num');
  if (!user) {
    badges.forEach(b => {
      b.textContent = '0';
      b.style.display = 'none';
    });
    return;
  }

  const cart = getCart();
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  badges.forEach(b => {
    b.textContent = totalCount;
    b.style.display = totalCount > 0 ? 'flex' : 'none';
  });
}

// ---------------------------------------------------------------
// WISHLIST MANAGEMENT (Strict User-Isolated & Login Protected)
// ---------------------------------------------------------------
function getWishlist() {
  const user = getLoggedInCustomer();
  if (!user) return []; // Non-logged-in users cannot view or have a wishlist

  try {
    const key = getWishlistStorageKey();
    const data = localStorage.getItem(key);
    if (data !== null) {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }

    // Seamless migration: check if items were saved under previous legacy key formats
    const legacyKeys = [];
    if (user.phone) {
      const cleanPhone = String(user.phone).trim().replace(/[\s\-\+]/g, '');
      legacyKeys.push('radha_furniture_wishlist_user_' + cleanPhone);
      if (cleanPhone.length >= 10) legacyKeys.push('radha_furniture_wishlist_user_' + cleanPhone.slice(-10));
    }
    if (user.email) {
      legacyKeys.push('radha_furniture_wishlist_user_' + user.email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));
    }
    if (user.name) {
      legacyKeys.push('radha_furniture_wishlist_user_' + user.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));
    }
    legacyKeys.push('radha_furniture_wishlist_v1');

    for (const lk of legacyKeys) {
      const legData = localStorage.getItem(lk);
      if (legData) {
        try {
          const parsed = JSON.parse(legData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localStorage.setItem(key, JSON.stringify(parsed));
            localStorage.removeItem(lk);
            return parsed;
          }
        } catch (e) { }
      }
    }

    localStorage.setItem(key, JSON.stringify([]));
    return [];
  } catch (e) {
    return [];
  }
}

function saveWishlist(wishlist) {
  const user = getLoggedInCustomer();
  if (!user) return; // Cannot save wishlist without being logged in

  const now = Date.now();
  window.__lastLocalWishlistSaveTime = now;

  try {
    const key = getWishlistStorageKey();
    localStorage.setItem(key, JSON.stringify(wishlist));

    // Clear legacy keys so old items never resurrect
    if (user.phone) {
      const cleanPhone = String(user.phone).trim().replace(/[\s\-\+]/g, '');
      localStorage.removeItem('radha_furniture_wishlist_user_' + cleanPhone);
      if (cleanPhone.length >= 10) localStorage.removeItem('radha_furniture_wishlist_user_' + cleanPhone.slice(-10));
    }
    if (user.email) {
      localStorage.removeItem('radha_furniture_wishlist_user_' + user.email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));
    }
    if (user.name) {
      localStorage.removeItem('radha_furniture_wishlist_user_' + user.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));
    }
    localStorage.removeItem('radha_furniture_wishlist_v1');
  } catch (e) {
    console.warn('Wishlist save error:', e);
  }
  updateWishlistBadge();
  refreshAllWishlistButtonsUI();
  if (typeof fbSyncWishlist === 'function') {
    fbSyncWishlist(getCurrentUserStorageId(), wishlist, now);
  }
}

function toggleWishlist(productId) {
  const user = getLoggedInCustomer();
  if (!user) {
    showToast('⚠️ Wishlist save karne ke liye kripya pehle Login karein!', 'warning');
    const currentPathClean = window.location.pathname.replace(/\\/g, '/').toLowerCase();
    const isInUserFolder = currentPathClean.includes('/user/');
    const isInAdminFolder = currentPathClean.includes('/admin/');
    const isInAlumFolder = currentPathClean.includes('/aluminium products/') || currentPathClean.includes('/aluminium%20products/') || currentPathClean.includes('/aluminium-products/');
    const rootPrefix = (isInUserFolder || isInAdminFolder || isInAlumFolder) ? '../' : '';
    const currentPath = window.location.pathname.split('/').pop() + window.location.search;
    setTimeout(() => {
      window.location.href = rootPrefix + 'login.html?redirect=' + encodeURIComponent(currentPath || 'index.html');
    }, 1200);
    return;
  }

  let wishlist = getWishlist();
  const pIdStr = String(productId);
  const index = wishlist.findIndex(id => String(id) === pIdStr);
  let isAdded = false;

  if (index > -1) {
    wishlist.splice(index, 1);
    showToast('Removed from Wishlist', 'info');
  } else {
    wishlist.push(productId);
    isAdded = true;
    showToast('Saved to Wishlist ❤️', 'success');
  }

  saveWishlist(wishlist);
  updateWishlistButtonUI(productId, isAdded);
}

function updateWishlistBadge() {
  const user = getLoggedInCustomer();
  const badges = document.querySelectorAll('.wishlist-count-badge');
  if (!user) {
    badges.forEach(b => {
      b.textContent = '0';
      b.style.display = 'none';
    });
    return;
  }

  const wishlist = getWishlist();
  badges.forEach(b => {
    b.textContent = wishlist.length;
    b.style.display = wishlist.length > 0 ? 'flex' : 'none';
  });
}

// ---------------------------------------------------------------
// PASSWORD VISIBILITY TOGGLE (Show / Hide Password)
// ---------------------------------------------------------------
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.innerHTML = '🙈';
  } else {
    input.type = 'password';
    if (btn) btn.innerHTML = '👁️';
  }
}

function updateWishlistButtonUI(productId, isAdded) {
  const buttons = document.querySelectorAll(`.wishlist-toggle[data-id="${productId}"]`);
  buttons.forEach(btn => {
    if (isAdded) {
      btn.classList.add('active');
      btn.innerHTML = `<i class="bi bi-heart-fill" style="color: red; font-size: 1.25rem;"></i>`;
    } else {
      btn.classList.remove('active');
      btn.innerHTML = `<i class="bi bi-heart" style="font-size: 1.25rem;"></i>`;
    }
  });
}

function refreshAllWishlistButtonsUI() {
  const wishlist = getWishlist();
  const buttons = document.querySelectorAll('.wishlist-toggle[data-id]');
  buttons.forEach(btn => {
    const id = btn.getAttribute('data-id');
    const isAdded = wishlist.some(wId => String(wId) === String(id));
    if (isAdded) {
      btn.classList.add('active');
      btn.innerHTML = `<i class="bi bi-heart-fill" style="color: red; font-size: 1.25rem;"></i>`;
    } else {
      btn.classList.remove('active');
      btn.innerHTML = `<i class="bi bi-heart" style="font-size: 1.25rem;"></i>`;
    }
  });
}

// ---------------------------------------------------------------
// TOAST NOTIFICATIONS
// ---------------------------------------------------------------
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---------------------------------------------------------------
// ---------------------------------------------------------------
// UNIVERSAL STORE IMAGE PATH RESOLVER
// ---------------------------------------------------------------
function resolveStoreImg(src, category = '') {
  const currentPath = window.location.pathname.replace(/\\/g, '/').toLowerCase();
  const isInSubFolder = currentPath.includes('/user/') || 
                        currentPath.includes('/admin/') || 
                        currentPath.includes('/aluminium products/') || 
                        currentPath.includes('/aluminium%20products/') || 
                        currentPath.includes('/aluminium-products/');

  const categoryDefaults = {
    windows: 'assets/images/products/window-slider-1.jpg',
    doors: 'assets/images/products/door-patio-1.jpg',
    gates: 'assets/images/products/gate-compound-1.jpg',
    mirrors: 'assets/images/products/mirror-vanity-led-1.jpg',
    partitions: 'assets/images/products/partition-acoustic-1.jpg',
    railings: 'assets/images/products/railing-staircase-1.jpg',
    shower: 'assets/images/products/shower-corner-cubicle-1.jpg',
    aluminium: 'assets/images/products/aluminium-curtainwall-1.jpg',
    'steel-work': 'assets/images/products/steel-shed-structure-1.jpg',
    living: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
    bedroom: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80',
    mandir: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80',
    dining: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=800&q=80',
    handicraft: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80'
  };

  let raw = src;
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    raw = categoryDefaults[category] || 'assets/images/image.png';
  }

  raw = raw.trim();

  // 1. Data URLs (uploaded base64 images) and Blob URLs must NEVER be altered
  if (raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }

  // 2. Absolute Web URLs (http://, https://) must NEVER be altered
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }

  // 3. Clean any existing relative prefixes (../ or ./)
  const cleanPath = raw.replace(/^(\.\.\/)+/, '').replace(/^(\.\/)+/, '').replace(/^\//, '');

  // 4. Return correct relative path based on directory depth
  if (isInSubFolder) {
    return '../' + cleanPath;
  }
  return cleanPath;
}

// ---------------------------------------------------------------
// ACTIVE STORE SETTINGS HELPER
// ---------------------------------------------------------------
function getActiveStoreSettings() {
  const fallback = (typeof DEFAULT_SITE_SETTINGS !== 'undefined') ? DEFAULT_SITE_SETTINGS : {
    brandName: 'Radhey Radhey Funicher',
    phone: '9772225296',
    whatsapp: '9772225296',
    email: 'jangid7090@gmail.com',
    bannerText: '🔴 UPTO 40% OFF Festive Discount on Solid Sheesham & Teak Wood',
    address: 'Radhey Radhey Funicher, Mansarovar, Jaipur, Rajasthan 302020',
    couponCode: 'RADHEY10',
    themeColor: 'Red & Black Theme'
  };

  try {
    const local = localStorage.getItem('radha_store_settings_v1');
    if (local) {
      return { ...fallback, ...JSON.parse(local) };
    }
  } catch (e) {}

  return { ...fallback };
}

// ---------------------------------------------------------------
// FABRICATION WHATSAPP QUOTATION URL GENERATOR
// ---------------------------------------------------------------
function getFabricationWhatsAppUrl(product, customName = '') {
  const settings = getActiveStoreSettings();
  const cleanWa = (settings.whatsapp || '9772225296').replace(/[^0-9]/g, '').slice(-10) || '9772225296';
  const phone = '91' + cleanWa;
  const origin = window.location.origin || '';

  // 1. Customer details (from parameter, active session, or localStorage)
  let user = null;
  try {
    if (typeof getLoggedInCustomer === 'function') user = getLoggedInCustomer();
    if (!user) {
      const raw = localStorage.getItem('radha_furniture_logged_user_v1');
      if (raw) user = JSON.parse(raw);
    }
  } catch (e) {}

  let savedGuestName = localStorage.getItem('radha_guest_customer_name') || '';
  let custName = customName || (user ? (user.name || user.fullName || '') : savedGuestName);
  let custPhone = user ? (user.phone || user.mobile || '') : (localStorage.getItem('radha_guest_customer_phone') || '');
  let custCity = user ? (user.city || user.address || '') : 'Jaipur / Rajasthan';

  // Dynamic Project Base URL Resolver (supports GitHub Pages subfolders & live domains)
  function getProjectRootUrl() {
    const loc = window.location;
    const origin = loc.origin || '';
    const pathname = loc.pathname || '';
    
    let basePath = pathname
      .replace(/\/(Aluminium%20products|aluminium%20products|Aluminium\s+products|admin|user)\/?[^\/]*$/i, '')
      .replace(/\/[^\/]+\.html$/i, '')
      .replace(/\/+$/, '');

    return `${origin}${basePath}/`;
  }

  const rootUrl = getProjectRootUrl();

  // 2. Resolve dynamic image URL from Database
  let rawImg = (product.images && product.images.length > 0 && product.images[0]) ? product.images[0] : (product.image || '');
  let imgDisplay = '';

  if (rawImg) {
    if (rawImg.startsWith('http://') || rawImg.startsWith('https://')) {
      // Direct Cloud / Hosted Database URL
      imgDisplay = rawImg;
    } else if (rawImg.startsWith('data:') || rawImg.startsWith('blob:')) {
      // Uploaded Base64 Photo in Database (viewable directly via Product Link)
      imgDisplay = `[Database Custom Photo Attached — Open Product Link]`;
    } else {
      // Relative Path stored in database
      const cleanImg = rawImg.replace(/^(\.\.\/)+/, '').replace(/^(\.\/)+/, '').replace(/^\//, '');
      imgDisplay = `${rootUrl}${cleanImg}`;
    }
  }

  // 3. Resolve page URL
  let pageUrl = `${rootUrl}product-details.html?id=${encodeURIComponent(product.id)}`;

  // 4. Build comprehensive WhatsApp message
  let text = `Hello Radhey Radhey Workshop,\nI am interested in quotation & free site survey for:\n\n`;

  // Customer Info
  text += `👤 CUSTOMER DETAILS:\n`;
  text += `• Name: ${custName ? custName : '[Apna Naam Likhein]'}\n`;
  if (custPhone) text += `• Phone: ${custPhone}\n`;
  text += `• Site Location: ${custCity}\n\n`;

  // Product Specs from Database
  text += `🏗️ MODEL SPECIFICATIONS:\n`;
  text += `• Model: ${product.title}\n`;
  text += `• Category: ${product.categoryName || product.category}\n`;
  text += `• Model ID: #${product.id}\n`;
  if (product.aluminiumProfile || product.woodType) {
    text += `• Profile/Alloy: ${product.aluminiumProfile || product.woodType}\n`;
  }
  if (product.glassSystem) {
    text += `• Glass System: ${product.glassSystem}\n`;
  }
  if (product.hardwareRollers || product.hardware) {
    text += `• Hardware: ${product.hardwareRollers || product.hardware}\n`;
  }
  if (product.weatherGaskets) {
    text += `• Weather Gaskets: ${product.weatherGaskets}\n`;
  }
  if (product.mosquitoMesh) {
    text += `• Mosquito Mesh: ${product.mosquitoMesh}\n`;
  }
  if (product.warranty) {
    text += `• Warranty: ${product.warranty}\n`;
  }
  if (product.rateUnit) {
    text += `• Rate Unit: ${product.rateUnit}\n`;
  }
  if (imgDisplay) {
    text += `• Photo/Design: ${imgDisplay}\n`;
  }
  if (pageUrl) {
    text += `• Product Link: ${pageUrl}\n`;
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

async function handleFabricationWhatsAppInquiry(productId) {
  let product = null;
  if (typeof getProductById === 'function') {
    product = getProductById(productId);
  }
  if (!product && typeof getAllProducts === 'function') {
    try {
      const allProds = await getAllProducts();
      if (Array.isArray(allProds)) {
        product = allProds.find(p => p.id === productId || p._id === productId);
      }
    } catch (e) {}
  }
  if (!product && Array.isArray(window.allFabProducts)) {
    product = window.allFabProducts.find(p => p.id === productId || p._id === productId);
  }
  if (!product) {
    const settings = getActiveStoreSettings();
    const cleanWa = (settings.whatsapp || '9772225296').replace(/[^0-9]/g, '').slice(-10) || '9772225296';
    window.open(`https://wa.me/91${cleanWa}?text=${encodeURIComponent('Hello ' + (settings.brandName || 'Radhey Radhey') + ' Workshop, I want an inquiry for Aluminium Fabrication Model #' + productId)}`, '_blank');
    return;
  }

  let user = null;
  try {
    if (typeof getLoggedInCustomer === 'function') user = getLoggedInCustomer();
    if (!user) {
      const raw = localStorage.getItem('radha_furniture_logged_user_v1');
      if (raw) user = JSON.parse(raw);
    }
  } catch (e) {}

  let userName = user ? (user.name || user.fullName || '') : (localStorage.getItem('radha_guest_customer_name') || '');
  if (!userName) {
    const inputName = prompt('Kripya apna Naam (Name) enter karein WhatsApp Inquiry ke liye:');
    if (inputName && inputName.trim()) {
      userName = inputName.trim();
      localStorage.setItem('radha_guest_customer_name', userName);
    }
  }

  const waUrl = getFabricationWhatsAppUrl(product, userName);
  window.open(waUrl, '_blank');
}

// ---------------------------------------------------------------
// RENDER PRODUCT CARD HTML
// ---------------------------------------------------------------
function renderProductCard(product) {
  const wishlist = getWishlist();
  const isWishlisted = wishlist.includes(product.id);
  const user = getLoggedInCustomer();
  const isAdminOrSuper = user && (user.role === 'admin' || user.role === 'superadmin');
  const currentPath = window.location.pathname.replace(/\\/g, '/').toLowerCase();
  const isInUserFolder = currentPath.includes('/user/');
  const isInAdminFolder = currentPath.includes('/admin/');
  const isInAlumFolder = currentPath.includes('/aluminium products/') || currentPath.includes('/aluminium%20products/') || currentPath.includes('/aluminium-products/');
  const adminPrefix = isInAdminFolder ? '' : (isInUserFolder || isInAlumFolder ? '../admin/' : 'admin/');

  const fabricationCats = ['windows', 'doors', 'gates', 'mirrors', 'partitions', 'railings', 'shower', 'aluminium', 'steel-work'];
  const isFab = fabricationCats.includes(product.category);

  let detailUrl = '';
  if (isInAlumFolder || isInUserFolder || isInAdminFolder) {
    detailUrl = `../product-details.html?id=${encodeURIComponent(product.id)}`;
  } else {
    detailUrl = `product-details.html?id=${encodeURIComponent(product.id)}`;
  }

  const imgSrc = resolveStoreImg(product.image, product.category);
  const fallbackImg = resolveStoreImg('', product.category);
  const materialTag = isFab ? (product.woodType || 'Architectural Alloy') : `${(product.woodType || 'Solid').split(' ')[0]} Wood`;

  return `
    <div class="product-card" data-category="${product.category}" data-product-id="${product.id}">
      ${product.badge ? `<span class="product-badge ${product.badge.includes('Royal') ? 'gold' : ''}">${product.badge}</span>` : ''}
      
      <button class="wishlist-toggle ${isWishlisted ? 'active' : ''}" data-id="${product.id}" onclick="toggleWishlist('${product.id}')" title="Add to Wishlist">
        ${isWishlisted
      ? `<i class="bi bi-heart-fill" style="color: red; font-size: 1.25rem;"></i>`
      : `<i class="bi bi-heart" style="font-size: 1.25rem;"></i>`}
      </button>

      <div class="product-thumbnail">
        <img src="${imgSrc}" alt="${product.title}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImg}';">
        <div class="quick-view-overlay">
          <button class="quick-view-btn" onclick="openQuickView('${product.id}')">
            Quick View
          </button>
        </div>
      </div>

      <div class="product-info">
        <span class="product-category">${product.categoryName}</span>
        <a href="${detailUrl}" class="product-title" title="${product.title}">${product.title}</a>
        
        <div class="product-meta">
          <div class="rating-stars">
            ★ <strong>${product.rating || 5.0}</strong> <span style="font-size: 0.72rem; color: gray; margin-left: 3px;">(${product.reviewCount || 1})</span>
          </div>
          <span class="wood-tag">${materialTag}</span>
        </div>

        ${isFab ? `
          <div class="product-price-row">
            <span class="current-price" style="font-size: 0.92rem; font-weight: 700; color: #1e293b;">${product.rateUnit ? `Rate: ${product.rateUnit}` : 'Custom Quotation'}</span>
          </div>
        ` : `
          <div class="product-price-row">
            <span class="current-price">${formatPrice(product.price)}</span>
            ${product.originalPrice && product.originalPrice > product.price ? `
              <span class="old-price">${formatPrice(product.originalPrice)}</span>
              <span class="discount-tag">${product.discount || 'Offer'}</span>
            ` : ''}
          </div>
        `}

        <div class="card-actions">
          ${isFab ? `
            <button onclick="handleFabricationWhatsAppInquiry('${product.id}')" class="btn btn-block" style="background: #25D366; color: white; border: none; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; padding: 10px 14px; border-radius: 6px; box-shadow: 0 2px 8px rgba(37,211,102,0.3);">
              <i class="bi bi-whatsapp" style="font-size: 1.15rem;"></i>
              Inquire on WhatsApp
            </button>
          ` : (product.inStock !== false ? `
            <button class="btn btn-red btn-block" onclick="addToCart('${product.id}')">
              <i class="bi bi-bag" style="font-size: 1.1rem; margin-right: 6px;"></i>
              Add to Cart
            </button>
          ` : `
            <button class="btn btn-block" style="background: mistyrose; color: darkred; border: 1px solid lightcoral; font-weight: 700; cursor: not-allowed; padding: 10px;" disabled>
              ✕ Out of Stock
            </button>
          `)}
        </div>

        ${isAdminOrSuper ? `
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed lightgray; display: flex; align-items: center; justify-content: space-between; gap: 6px;">
            <span style="font-size: 0.72rem; color: brown; font-weight: 800;">👑 Admin Control</span>
            <a href="${isFab ? `${adminPrefix}manage-aluminium.html?edit=${encodeURIComponent(product.id)}` : `${adminPrefix}manage-products.html?edit=${encodeURIComponent(product.id)}`}" 
               style="background: black; color: gold; border: 1px solid goldenrod; padding: 5px 10px; border-radius: 5px; font-size: 0.75rem; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
              ✏️ Edit Product
            </a>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------
// SEARCH AUTO-SUGGESTION
// ---------------------------------------------------------------
function setupSearch() {
  const searchInput = document.getElementById('mainSearchInput');
  const dropdown = document.getElementById('searchResultsDropdown');
  if (!searchInput || !dropdown) return;

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim().toLowerCase();
    if (val.length < 2) {
      dropdown.classList.remove('active');
      dropdown.innerHTML = '';
      return;
    }

    const matches = PRODUCTS_DATA.filter(p =>
      p.title.toLowerCase().includes(val) ||
      p.categoryName.toLowerCase().includes(val) ||
      p.woodType.toLowerCase().includes(val)
    ).slice(0, 5);

    if (matches.length === 0) {
      dropdown.innerHTML = `<div style="padding: 14px; color: gray; text-align: center;">No furniture or craft found for "${val}"</div>`;
      dropdown.classList.add('active');
      return;
    }

    dropdown.innerHTML = matches.map(p => {
      const isFabProduct = ['windows', 'doors', 'gates', 'mirrors', 'partitions', 'railings', 'shower', 'aluminium', 'steel-work'].includes(p.category);
      return `
      <a href="${rootPrefix}product-details.html?id=${p.id}" class="search-result-item">
        <img src="${resolveStoreImg(p.image, p.category)}" alt="${p.title}">
        <div style="flex: 1;">
          <h5 style="font-size: 0.88rem; font-weight: 600; margin-bottom: 2px;">${p.title}</h5>
          <span style="font-size: 0.8rem; color: ${isFabProduct ? 'darkslategray' : 'red'}; font-weight: 700;">${isFabProduct ? (p.rateUnit ? `Rate: ${p.rateUnit}` : 'On Quotation') : formatPrice(p.price)}</span>
          <span style="font-size: 0.72rem; color: gray; margin-left: 6px;">(${p.categoryName})</span>
        </div>
      </a>
    `;}).join('');

    dropdown.classList.add('active');
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('active');
    }
  });

  const searchForm = document.getElementById('headerSearchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = searchInput.value.trim();
      if (val) {
        window.location.href = `shop.html?search=${encodeURIComponent(val)}`;
      }
    });
  }
}

// ---------------------------------------------------------------
// QUICK VIEW MODAL
// ---------------------------------------------------------------
function openQuickView(productId) {
  const product = getProductById(productId);
  if (!product) return;

  const currentPath = window.location.pathname.replace(/\\/g, '/').toLowerCase();
  const isInUserFolder = currentPath.includes('/user/');
  const isInAdminFolder = currentPath.includes('/admin/');
  const isInAlumFolder = currentPath.includes('/aluminium products/') || currentPath.includes('/aluminium%20products/') || currentPath.includes('/aluminium-products/');
  const adminPrefix = isInAdminFolder ? '' : (isInUserFolder || isInAlumFolder ? '../admin/' : 'admin/');
  const detailPrefix = (isInAlumFolder || isInUserFolder || isInAdminFolder) ? '../' : '';

  const fabricationCats = ['windows', 'doors', 'gates', 'mirrors', 'partitions', 'railings', 'shower', 'aluminium', 'steel-work'];
  const isFab = fabricationCats.includes(product.category);

  let modal = document.getElementById('quickViewModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'quickViewModal';
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.75);
      backdrop-filter: blur(5px); z-index: 3000; display: flex;
      align-items: center; justify-content: center; padding: 20px;
    `;
    document.body.appendChild(modal);
  }

  const imgSrc = resolveStoreImg(product.image, product.category);
  const fallbackImg = resolveStoreImg('', product.category);
  const detailUrl = `${detailPrefix}product-details.html?id=${encodeURIComponent(product.id)}`;
  const editUrl = isFab ? `${adminPrefix}manage-aluminium.html?edit=${encodeURIComponent(product.id)}` : `${adminPrefix}manage-products.html?edit=${encodeURIComponent(product.id)}`;

  modal.innerHTML = `
    <div style="background: white; width: 100%; max-width: 820px; border-radius: 16px; overflow: hidden; position: relative; box-shadow: 0 20px 50px rgba(0,0,0,0.5); display: grid; grid-template-columns: 1fr 1.05fr; border-top: 4px solid var(--primary-red, red); max-height: 90vh;">
      <button onclick="document.getElementById('quickViewModal').style.display='none'" style="position: absolute; top: 14px; right: 16px; font-size: 1.5rem; color: slategray; background: none; border: none; cursor: pointer; z-index: 10;">✕</button>
      
      <div style="background: whitesmoke; padding: 20px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
        <img src="${imgSrc}" alt="${product.title}" style="max-height: 360px; width: 100%; object-fit: cover; border-radius: 10px;" onerror="this.onerror=null;this.src='${fallbackImg}';">
      </div>

      <div style="padding: 26px 28px; display: flex; flex-direction: column; justify-content: space-between; overflow-y: auto;">
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--primary-red, red); font-weight: 800;">${product.categoryName}</span>
          <h3 style="font-size: 1.25rem; font-weight: 800; margin: 6px 0 10px; color: black;">${product.title}</h3>
          
          ${isFab ? `
            <div style="display: flex; gap: 10px; align-items: baseline; margin-bottom: 14px;">
              <span style="font-size: 1.25rem; font-weight: 800; color: #1e293b;">${product.rateUnit ? `Rate: ${product.rateUnit}` : 'Custom Quotation'}</span>
            </div>
          ` : `
            <div style="display: flex; gap: 10px; align-items: baseline; margin-bottom: 14px;">
              <span style="font-size: 1.5rem; font-weight: 800; color: black;">${formatPrice(product.price)}</span>
              ${product.originalPrice && product.originalPrice > product.price ? `
                <span style="font-size: 1rem; color: gray; text-decoration: line-through;">${formatPrice(product.originalPrice)}</span>
                <span style="font-weight: 800; color: var(--primary-red, red); font-size: 0.88rem;">${product.discount || 'Special Offer'}</span>
              ` : ''}
              ${product.rateUnit ? `<span style="font-size: 0.8rem; color: gray; font-weight: 700;">(${product.rateUnit})</span>` : ''}
            </div>
          `}

          <p style="font-size: 0.88rem; color: slategray; line-height: 1.55; margin-bottom: 14px;">${product.description || (isFab ? 'Custom engineered architectural fabrication manufactured with high-grade alloys.' : 'Handcrafted solid wood product.')}</p>
          
          <div style="font-size: 0.82rem; color: darkslategray; margin-bottom: 16px; background: whitesmoke; padding: 10px 12px; border-radius: 8px; border: 1px solid lightgray;">
            ${isFab ? `
              <p style="margin: 2px 0;"><strong>Alloy Profile:</strong> ${product.aluminiumProfile || product.woodType || 'Architectural Alloy'}</p>
              ${product.glassSystem ? `<p style="margin: 2px 0;"><strong>Glass:</strong> ${product.glassSystem}</p>` : ''}
              ${product.rateUnit ? `<p style="margin: 2px 0;"><strong>Rate Unit:</strong> ${product.rateUnit}</p>` : ''}
            ` : `
              <p style="margin: 2px 0;"><strong>Wood Material:</strong> ${product.woodType || 'Solid Wood'}</p>
              <p style="margin: 2px 0;"><strong>Dimensions:</strong> ${product.dimensions || 'Standard'}</p>
            `}
          </div>
        </div>

        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
          ${isFab ? `
            <button onclick="handleFabricationWhatsAppInquiry('${product.id}')" class="btn" style="flex: 1; min-width: 160px; padding: 12px; background: #25D366; color: white; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; border: none; cursor: pointer; border-radius: 6px; box-shadow: 0 2px 8px rgba(37,211,102,0.3);">
              <i class="bi bi-whatsapp" style="font-size: 1.15rem;"></i> Inquire on WhatsApp
            </button>
          ` : `
            <button class="btn btn-red" style="flex: 1; min-width: 140px; padding: 12px;" onclick="addToCart('${product.id}'); document.getElementById('quickViewModal').style.display='none';">
              <i class="bi bi-bag"></i> Add to Cart
            </button>
          `}
          <a href="${detailUrl}" class="btn btn-dark" style="padding: 12px 18px; font-weight: 700; text-decoration: none; border-radius: 6px;">
            View Details ➔
          </a>
          ${(typeof getLoggedInCustomer === 'function' && getLoggedInCustomer() && (getLoggedInCustomer().role === 'admin' || getLoggedInCustomer().role === 'superadmin')) ? `
            <a href="${editUrl}" class="btn" style="background: black; color: gold; border: 1px solid goldenrod; padding: 12px 14px; font-weight: 800; text-decoration: none; border-radius: 6px;">
              ✏️ Edit
            </a>
          ` : ''}
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

// ---------------------------------------------------------------
// INITIALIZATION
// ---------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  updateWishlistBadge();
  updateHeaderAuthState();
  applySiteSettingsToPage();
  setupSearch();

  // Mobile menu toggle
  const mobileToggle = document.querySelector('.mobile-nav-toggle');
  const catBar = document.querySelector('.nav-categories-bar');
  if (mobileToggle && catBar) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = catBar.classList.toggle('mobile-open');
      const icon = mobileToggle.querySelector('i');
      if (icon) {
        icon.className = isOpen ? 'bi bi-x-lg' : 'bi bi-list';
      }
    });

    document.addEventListener('click', (e) => {
      if (catBar.classList.contains('mobile-open') && !catBar.contains(e.target) && !mobileToggle.contains(e.target)) {
        catBar.classList.remove('mobile-open');
        const icon = mobileToggle.querySelector('i');
        if (icon) icon.className = 'bi bi-list';
      }
    });

    catBar.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        catBar.classList.remove('mobile-open');
        const icon = mobileToggle.querySelector('i');
        if (icon) icon.className = 'bi bi-list';
      });
    });
  }
});

// ---------------------------------------------------------------
// HEADER AUTH STATE (Dynamically switches Login vs User vs Admin Area)
// ---------------------------------------------------------------
function updateHeaderAuthState() {
  const user = getLoggedInCustomer();
  const currentPath = window.location.pathname.replace(/\\/g, '/').toLowerCase();
  const isInUserFolder = currentPath.includes('/user/');
  const isInAdminFolder = currentPath.includes('/admin/');
  const isInAlumFolder = currentPath.includes('/aluminium products/') || currentPath.includes('/aluminium%20products/') || currentPath.includes('/aluminium-products/');
  const rootPrefix = (isInUserFolder || isInAdminFolder || isInAlumFolder) ? '../' : '';
  const userPrefix = isInUserFolder ? '' : (isInAdminFolder || isInAlumFolder ? '../user/' : 'user/');
  const adminPrefix = isInAdminFolder ? '' : (isInUserFolder || isInAlumFolder ? '../admin/' : 'admin/');

  // 1. Account Button in header
  const accountLinks = document.querySelectorAll('a[title="My Account"], a.action-btn[href*="dashboard.html"], a.action-btn[href*="login.html"]');
  accountLinks.forEach(link => {
    const textSpan = link.querySelector('span:not(.badge-count)');
    if (user) {
      const role = (user.role || 'user').toLowerCase();
      if (role === 'superadmin') {
        link.href = adminPrefix + 'dashboard.html';
        link.title = `Super Admin (${user.name || 'Owner'})`;
        if (textSpan) textSpan.textContent = '👑 Super Admin';
      } else if (role === 'admin') {
        link.href = adminPrefix + 'dashboard.html';
        link.title = `Store Admin (${user.name || 'Admin'})`;
        if (textSpan) textSpan.textContent = '🛡️ Admin';
      } else {
        link.href = userPrefix + 'dashboard.html';
        link.title = `My Account (${user.name || 'Customer'})`;
        if (textSpan) {
          const firstName = (user.name || 'Account').split(' ')[0];
          textSpan.textContent = firstName.length > 10 ? firstName.slice(0, 8) + '..' : firstName;
        }
      }
    } else {
      link.href = rootPrefix + 'login.html';
      link.title = 'Sign In / Register';
      if (textSpan) {
        textSpan.textContent = 'Sign In';
      }
    }
  });

  // 2. Wishlist Link in header (Requires login to access)
  const wishlistLinks = document.querySelectorAll('a[title="Saved Wishlist"], a[href*="wishlist"]');
  wishlistLinks.forEach(link => {
    if (link.classList.contains('action-btn') || link.closest('.header-actions') || link.closest('.navbar')) {
      if (user) {
        link.href = userPrefix + 'wishlist.html';
      } else {
        link.href = rootPrefix + 'login.html?redirect=' + encodeURIComponent(userPrefix + 'wishlist.html');
      }
    }
  });

  // 3. Cart Link in header (Requires login to access)
  const cartLinks = document.querySelectorAll('a[title="View Cart"], a.action-btn[href*="cart.html"], a.action-btn[href$="cart.html"], a[href$="cart.html"]');
  cartLinks.forEach(link => {
    if (link.classList.contains('action-btn') || link.closest('.header-actions') || link.closest('.navbar')) {
      if (user) {
        link.href = rootPrefix + 'cart.html';
      } else {
        link.href = rootPrefix + 'login.html?redirect=cart.html';
      }
    }
  });

  // 4. Top Bar Auth Links
  const topAuthLinks = document.querySelectorAll('.top-bar-auth-link, a.top-login-link');
  topAuthLinks.forEach(link => {
    if (user) {
      const role = (user.role || 'user').toLowerCase();
      if (role === 'superadmin') {
        link.href = adminPrefix + 'dashboard.html';
        link.innerHTML = '👑 Super Admin Panel';
      } else if (role === 'admin') {
        link.href = adminPrefix + 'dashboard.html';
        link.innerHTML = '🛡️ Admin Panel';
      } else {
        const firstName = (user.name || 'Account').split(' ')[0];
        link.href = userPrefix + 'dashboard.html';
        link.innerHTML = `👤 Hi, ${firstName}`;
      }
    } else {
      link.href = rootPrefix + 'login.html';
      link.innerHTML = '🔐 Login / Register';
    }
  });
}

// ---------------------------------------------------------------
// APPLY STORE & WEBSITE CONFIGURATIONS DYNAMICALLY (Cloud Synced)
// ---------------------------------------------------------------
async function applySiteSettingsToPage(customSettings = null) {
  function applyDOM(settings) {
    if (!settings) return;

    const brandName = settings.brandName || 'Radhey Radhey Funicher';
    const address = settings.address || 'Radhey Radhey Funicher, Mansarovar, Jaipur, Rajasthan 302020';
    const email = settings.email || 'jangid7090@gmail.com';
    const cleanPhone = (settings.phone || '9772225296').replace(/[^0-9]/g, '').slice(-10) || '9772225296';
    const cleanWa = (settings.whatsapp || '9772225296').replace(/[^0-9]/g, '').slice(-10) || '9772225296';
    const bannerText = settings.bannerText || '🔴 UPTO 40% OFF Festive Discount on Solid Sheesham & Teak Wood';
    const fullWa = '91' + cleanWa;

    // 1. Update announcement banner marquee text
    if (bannerText) {
      const bannerSpans = document.querySelectorAll('.top-announcement-bar .marquee-content span, .top-announcement-bar span, [data-setting="bannerText"]');
      bannerSpans.forEach(span => {
        span.textContent = bannerText;
      });
    }

    // 2. Update WhatsApp buttons and links across whole page
    const waLinks = document.querySelectorAll('a[href*="wa.me"], a.whatsapp-float, a.floating-whatsapp, a.pdp-whatsapp-btn, #modalWaDirectBtn, #whatsappOrderBtn, #chatCustomerBtn');
    waLinks.forEach(a => {
      const href = a.getAttribute('href') || '';
      const match = href.match(/text=([^&]+)/);
      const textParam = match ? ('?' + match[0]) : '';
      a.href = `https://wa.me/${fullWa}${textParam}`;

      // If button text includes WhatsApp inquiry label with phone
      if (a.textContent.includes('Inquire on WhatsApp') || a.classList.contains('pdp-whatsapp-btn')) {
        a.innerHTML = `<i class="bi bi-whatsapp" style="font-size: 1.15rem; color: #16a34a;"></i> Inquire on WhatsApp (+91 ${cleanWa})`;
      }
    });

    document.querySelectorAll('[data-store-whatsapp], [data-setting="whatsapp"]').forEach(el => {
      if (el.tagName === 'A') {
        el.href = `https://wa.me/${fullWa}`;
      } else {
        el.textContent = `+91 ${cleanWa}`;
      }
    });

    // 3. Update telephone links and phone text
    const telLinks = document.querySelectorAll('a[href^="tel:"]');
    telLinks.forEach(a => {
      a.href = 'tel:+91' + cleanPhone;
      const icon = a.querySelector('i');
      if (icon) {
        a.innerHTML = `${icon.outerHTML} Call / Support: +91 ${cleanPhone}`;
      } else if (a.textContent.trim().startsWith('+91') || a.textContent.includes('Call')) {
        a.textContent = `+91 ${cleanPhone}`;
      }
    });

    // Footer contact list items for phone
    document.querySelectorAll('.footer-contact i.bi-telephone, .footer-contact svg.bi-telephone').forEach(icon => {
      const span = icon.closest('li')?.querySelector('span') || icon.nextElementSibling;
      if (span && span.tagName === 'SPAN') {
        span.textContent = `+91 ${cleanPhone} (10 AM - 8 PM)`;
      }
    });

    // Contact page info-card phone
    document.querySelectorAll('.info-card').forEach(card => {
      if (card.innerHTML.includes('📞') || card.innerHTML.includes('Direct Call') || card.innerHTML.includes('Helpline')) {
        const pLink = card.querySelector('p a[href^="tel:"]');
        if (pLink) {
          pLink.href = 'tel:+91' + cleanPhone;
          pLink.textContent = '+91 ' + cleanPhone;
        }
      }
    });

    document.querySelectorAll('[data-store-phone], [data-setting="phone"]').forEach(el => {
      if (el.tagName === 'A') {
        el.href = `tel:+91${cleanPhone}`;
      } else {
        el.textContent = `+91 ${cleanPhone}`;
      }
    });

    // 4. Update Email links and displays
    const mailLinks = document.querySelectorAll('a[href^="mailto:"]');
    mailLinks.forEach(a => {
      a.href = `mailto:${email}`;
      if (a.textContent.includes('@')) {
        a.textContent = email;
      }
    });

    // Footer contact list items for email
    document.querySelectorAll('.footer-contact i.bi-envelope, .footer-contact svg.bi-envelope').forEach(icon => {
      const span = icon.closest('li')?.querySelector('span') || icon.nextElementSibling;
      if (span && span.tagName === 'SPAN') {
        span.textContent = email;
      }
    });

    // Contact page info-card email
    document.querySelectorAll('.info-card').forEach(card => {
      if (card.innerHTML.includes('✉️') || card.innerHTML.includes('Email Support')) {
        const mailA = card.querySelector('p a[href^="mailto:"]');
        if (mailA) {
          mailA.href = `mailto:${email}`;
          mailA.textContent = email;
        }
      }
    });

    document.querySelectorAll('[data-store-email], [data-setting="email"]').forEach(el => {
      if (el.tagName === 'A') {
        el.href = `mailto:${email}`;
      } else {
        el.textContent = email;
      }
    });

    // 5. Update Address across all elements
    // a. Footer location item in main store pages
    document.querySelectorAll('.footer-contact i.bi-geo-alt, .footer-contact svg.bi-geo-alt, .footer-contact .bi-geo-alt-fill').forEach(icon => {
      const span = icon.closest('li')?.querySelector('span') || icon.nextElementSibling;
      if (span && span.tagName === 'SPAN') {
        span.textContent = address;
      }
    });

    // b. Aluminium pages footer location
    document.querySelectorAll('.site-footer .bi-geo-alt-fill, .site-footer .bi-geo-alt').forEach(icon => {
      const parent = icon.parentElement;
      if (parent) {
        const span = parent.querySelector('span');
        if (span) {
          span.textContent = address;
        } else {
          parent.innerHTML = `<i class="bi bi-geo-alt-fill text-gold"></i> <span>${address}</span>`;
        }
      }
    });

    // c. Contact page workshop address info-card
    document.querySelectorAll('.info-card').forEach(card => {
      if (card.innerHTML.includes('📍') || card.innerHTML.includes('Main Workshop') || card.innerHTML.includes('Factory Outlet')) {
        const p = card.querySelector('p');
        if (p) {
          p.textContent = address;
        }
      }
    });

    // d. All elements explicitly marked for address
    document.querySelectorAll('.store-address, [data-store-address], [data-setting="address"], #storeAddressText, #contactStoreAddress').forEach(el => {
      el.textContent = address;
    });

    // 6. Update Store Brand Name
    document.querySelectorAll('.store-brand-name, [data-store-brand], [data-setting="brandName"]').forEach(el => {
      el.textContent = brandName;
    });

    // Footer copyright brand name
    document.querySelectorAll('.footer-bottom, footer .footer-bottom, .site-footer p').forEach(el => {
      if (el.innerHTML.includes('©') || el.innerHTML.includes('&copy;')) {
        const strong = el.querySelector('strong');
        if (strong) {
          strong.textContent = brandName;
        }
      }
    });
  }

  if (customSettings) {
    applyDOM(customSettings);
    return;
  }

  try {
    // 1. Instant local render
    const local = localStorage.getItem('radha_store_settings_v1');
    if (local) {
      try {
        applyDOM(JSON.parse(local));
      } catch (e) { }
    } else if (typeof DEFAULT_SITE_SETTINGS !== 'undefined') {
      applyDOM(DEFAULT_SITE_SETTINGS);
    }

    // 2. Always fetch fresh settings from Firestore Cloud
    if (typeof fbGetSiteSettings === 'function') {
      fbGetSiteSettings().then(cloudSettings => {
        if (cloudSettings) applyDOM(cloudSettings);
      }).catch(() => { });
    }
  } catch (e) {
    console.warn('applySiteSettingsToPage error:', e);
  }
}

// Real-time synchronization listeners across tabs & admin saves
window.addEventListener('storage', (e) => {
  if (e.key === 'radha_store_settings_v1') {
    try {
      const parsed = JSON.parse(e.newValue);
      if (parsed) applySiteSettingsToPage(parsed);
    } catch (err) {}
  }
});

window.addEventListener('radha_settings_updated', (e) => {
  if (e.detail) {
    applySiteSettingsToPage(e.detail);
  }
});

// ---------------------------------------------------------------
// CLIENT AUTHENTICATION & DATA STORAGE (Firebase Cloud + Local)
// ---------------------------------------------------------------
const USER_SESSION_KEY = 'radha_auth_user_v1';
const REGISTERED_USERS_KEY = 'radha_registered_users_v1';

function getRegisteredUsers() {
  try {
    const data = localStorage.getItem(REGISTERED_USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveRegisteredUser(user) {
  const users = getRegisteredUsers();
  users.push(user);
  localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
}

async function loginCustomerWithDB(emailOrPhone, password) {
  if (typeof fbLoginUser === 'function') {
    return await fbLoginUser(emailOrPhone, password);
  }

  const cleanQuery = (emailOrPhone || '').toString().trim();
  const cleanPhone = cleanQuery.replace(/[\s\-\+]/g, '');
  const users = getRegisteredUsers();

  for (const u of users) {
    const emailMatches = u.email && u.email.toLowerCase() === cleanQuery.toLowerCase();
    const phoneMatches = u.phone && u.phone.replace(/[\s\-\+]/g, '') === cleanPhone;
    if (emailMatches || phoneMatches) {
      const isMatch = (typeof verifyPassword === 'function')
        ? await verifyPassword(password, u.password)
        : (u.password === password);
      if (isMatch) {
        const role = (u.role || 'user').toLowerCase();
        const sessionUser = {
          id: u.id || '',
          name: u.name,
          email: u.email || '',
          phone: u.phone || '',
          city: u.city || '',
          address: u.address || '',
          role: role
        };
        localStorage.setItem(USER_SESSION_KEY, JSON.stringify(sessionUser));
        if (role === 'admin' || role === 'superadmin') {
          localStorage.setItem('radha_auth_admin_v1', JSON.stringify(sessionUser));
        } else {
          localStorage.removeItem('radha_auth_admin_v1');
        }
        return { success: true, user: sessionUser };
      }
    }
  }

  return { success: false, message: 'Invalid credentials! Please check your mobile/email and password.' };
}

// ---------------------------------------------------------------
// LOGIN SECURITY & LOCKOUT GUARD (3 Failed Attempts = 2 Min Break)
// ---------------------------------------------------------------
const LOGIN_MAX_FAILED_ATTEMPTS = 3;
const LOGIN_LOCKOUT_MS = 2 * 60 * 1000; // 2 minutes (120,000 ms)
const LOGIN_FAIL_KEY = 'radha_login_fail_count_v1';
const LOGIN_LOCKOUT_KEY = 'radha_login_lockout_until_v1';

function checkLoginLockout() {
  const lockoutUntil = parseInt(localStorage.getItem(LOGIN_LOCKOUT_KEY) || '0', 10);
  const now = Date.now();
  if (lockoutUntil && now < lockoutUntil) {
    const remainingMs = lockoutUntil - now;
    const remainingSec = Math.ceil(remainingMs / 1000);
    return {
      isLocked: true,
      remainingSec: remainingSec,
      remainingMs: remainingMs,
      lockoutUntil: lockoutUntil
    };
  }

  // If previous lockout expired, clean up
  if (lockoutUntil && now >= lockoutUntil) {
    localStorage.removeItem(LOGIN_LOCKOUT_KEY);
    localStorage.removeItem(LOGIN_FAIL_KEY);
  }

  const failCount = parseInt(localStorage.getItem(LOGIN_FAIL_KEY) || '0', 10);
  return {
    isLocked: false,
    remainingSec: 0,
    remainingMs: 0,
    failCount: failCount,
    attemptsLeft: Math.max(0, LOGIN_MAX_FAILED_ATTEMPTS - failCount)
  };
}

function handleLoginFailure() {
  let failCount = parseInt(localStorage.getItem(LOGIN_FAIL_KEY) || '0', 10) + 1;
  if (failCount >= LOGIN_MAX_FAILED_ATTEMPTS) {
    const lockoutUntil = Date.now() + LOGIN_LOCKOUT_MS;
    localStorage.setItem(LOGIN_LOCKOUT_KEY, lockoutUntil.toString());
    localStorage.removeItem(LOGIN_FAIL_KEY);
    return {
      isLocked: true,
      lockoutUntil: lockoutUntil,
      remainingSec: 120,
      attemptsLeft: 0
    };
  } else {
    localStorage.setItem(LOGIN_FAIL_KEY, failCount.toString());
    return {
      isLocked: false,
      failCount: failCount,
      attemptsLeft: LOGIN_MAX_FAILED_ATTEMPTS - failCount
    };
  }
}

function clearLoginFailureLockout() {
  localStorage.removeItem(LOGIN_LOCKOUT_KEY);
  localStorage.removeItem(LOGIN_FAIL_KEY);
}

async function registerCustomerWithDB(userData) {
  try {
    if (typeof fbRegisterUser === 'function') {
      const fbRes = await fbRegisterUser(userData);
      if (fbRes) return fbRes;
    }
  } catch (err) {
    console.warn('fbRegisterUser exception caught in main.js:', err);
  }

  try {
    const sanitizedPhone = (userData.phone || '').toString().trim().replace(/[\s\-\+]/g, '');
    const cleanEmail = (userData.email || '').toString().trim().toLowerCase();
    const existingUsers = getRegisteredUsers();

    if (sanitizedPhone) {
      const phoneExists = existingUsers.some(u => {
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
      const emailExists = existingUsers.some(u => (u.email || '').toString().trim().toLowerCase() === cleanEmail);
      if (emailExists) {
        return {
          success: false,
          message: `Yeh Email ID (${cleanEmail}) pehle se registered hai! Ek Email ID se sirf ek hi account ban sakta hai.`
        };
      }
    }

    saveRegisteredUser({
      ...userData,
      phone: sanitizedPhone,
      email: cleanEmail
    });

    const sessionUser = {
      name: userData.name,
      email: cleanEmail,
      phone: sanitizedPhone,
      city: userData.city || '',
      address: userData.address || '',
      role: (userData.role || 'user').toLowerCase()
    };
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(sessionUser));
    return { success: true, user: sessionUser };
  } catch (err) {
    console.error('Local registerCustomerWithDB fallback error:', err);
    return { success: false, message: 'Registration failed. Please check your details.' };
  }
}

async function updateCustomerProfileInDB(updatedData) {
  const user = getLoggedInCustomer();
  const contact = (user && (user.email || user.phone)) || updatedData.email || updatedData.phone;
  window.__lastLocalProfileSaveTime = Date.now();

  let res = { success: true };
  if (typeof fbUpdateUserProfile === 'function' && contact) {
    res = await fbUpdateUserProfile(contact, updatedData);
  }

  // Update session immediately on local device
  const session = JSON.parse(localStorage.getItem(USER_SESSION_KEY) || '{}');
  const merged = { ...session, ...updatedData };
  localStorage.setItem(USER_SESSION_KEY, JSON.stringify(merged));
  if (merged.role === 'admin' || merged.role === 'superadmin') {
    localStorage.setItem('radha_auth_admin_v1', JSON.stringify(merged));
  }
  updateHeaderAuthState();
  window.dispatchEvent(new CustomEvent('radha_profile_synced', { detail: merged }));
  return res;
}

async function changeCustomerPasswordInDB(currentPassword, newPassword) {
  const user = getLoggedInCustomer();
  if (!user) return { success: false, message: 'Please login first!' };
  const contact = user.email || user.phone;

  if (typeof fbChangeUserPassword === 'function') {
    return await fbChangeUserPassword(contact, currentPassword, newPassword);
  }

  // Local fallback
  const users = getRegisteredUsers();
  for (const u of users) {
    if (u.email === contact || u.phone === contact) {
      const match = (typeof verifyPassword === 'function')
        ? await verifyPassword(currentPassword, u.password)
        : (u.password === currentPassword);
      if (match) {
        u.password = (typeof hashPassword === 'function') ? await hashPassword(newPassword) : newPassword;
        localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
        return { success: true, message: 'Password updated successfully!' };
      }
    }
  }
  return { success: false, message: 'Current password does not match!' };
}

async function resetCustomerPasswordInDB(contact, newPassword) {
  if (typeof fbResetUserPassword === 'function') {
    return await fbResetUserPassword(contact, newPassword);
  }

  const users = getRegisteredUsers();
  const u = users.find(u => u.email === contact || u.phone === contact);
  if (u) {
    u.password = (typeof hashPassword === 'function') ? await hashPassword(newPassword) : newPassword;
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
    return { success: true };
  }
  return { success: false };
}

async function placeOrderInDB(orderPayload) {
  try {
    if (typeof fbSaveOrder === 'function') {
      const fbRes = await fbSaveOrder(orderPayload);
      if (fbRes && fbRes.success) return fbRes;
    }
  } catch (err) {
    console.warn('fbSaveOrder error in main.js:', err);
  }

  try {
    const orders = JSON.parse(localStorage.getItem('radha_furniture_orders_v1') || '[]');
    const idx = orders.findIndex(o => (o.orderId || o._id) === orderPayload.orderId);
    if (idx >= 0) {
      orders[idx] = { ...orders[idx], ...orderPayload };
    } else {
      orders.unshift(orderPayload);
    }
    localStorage.setItem('radha_furniture_orders_v1', JSON.stringify(orders));
  } catch (e) {
    console.warn('Local placeOrderInDB save error:', e);
  }

  return { success: true, orderId: orderPayload.orderId };
}

async function getCustomerOrdersFromDB() {
  if (typeof fbGetOrders === 'function') {
    return await fbGetOrders();
  }

  try {
    const d = localStorage.getItem('radha_furniture_orders_v1');
    return d ? JSON.parse(d) : [];
  } catch (e) {
    return [];
  }
}

function getLoggedInCustomer() {
  try {
    // 1. If admin session is active in admin storage, sync to user storage
    const adminData = localStorage.getItem('radha_auth_admin_v1');
    if (adminData) {
      const adm = JSON.parse(adminData);
      const role = (adm && adm.role ? adm.role : '').toLowerCase();
      if (role === 'admin' || role === 'superadmin') {
        const uData = localStorage.getItem(USER_SESSION_KEY);
        if (!uData || (JSON.parse(uData).role !== 'admin' && JSON.parse(uData).role !== 'superadmin')) {
          localStorage.setItem(USER_SESSION_KEY, JSON.stringify(adm));
        }
        return adm;
      }
    }

    // 2. Normal customer session
    const d = localStorage.getItem(USER_SESSION_KEY);
    return d ? JSON.parse(d) : null;
  } catch (e) {
    return null;
  }
}

function logoutCustomer() {
  if (typeof fbUnsubscribeUserDataSync === 'function') {
    fbUnsubscribeUserDataSync();
  }
  localStorage.removeItem(USER_SESSION_KEY);
  localStorage.removeItem('radha_auth_admin_v1');
  updateCartBadge();
  updateWishlistBadge();
  const currentPath = window.location.pathname.replace(/\\/g, '/').toLowerCase();
  const isInUserFolder = currentPath.includes('/user/');
  const isInAdminFolder = currentPath.includes('/admin/');
  const isInAlumFolder = currentPath.includes('/aluminium products/') || currentPath.includes('/aluminium%20products/') || currentPath.includes('/aluminium-products/');
  const rootPrefix = (isInUserFolder || isInAdminFolder || isInAlumFolder) ? '../' : '';
  window.location.href = rootPrefix + 'login.html';
}

async function getAllProducts() {
  if (typeof fbGetProducts === 'function') {
    return await fbGetProducts();
  }

  try {
    const custom = localStorage.getItem('radha_furniture_custom_products_v1');
    if (custom) {
      const parsed = JSON.parse(custom);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) { }

  return typeof PRODUCTS_DATA !== 'undefined' ? PRODUCTS_DATA : [];
}

// ---------------------------------------------------------------
// CLOUD CART & WISHLIST SYNCHRONIZATION (Cross-Device Real-Time)
// ---------------------------------------------------------------

function applyCloudCartUpdate(cloudData) {
  if (!cloudData) return;
  const user = getLoggedInCustomer();
  if (!user) return;
  const userStorageId = getCurrentUserStorageId();
  if (!userStorageId || userStorageId === 'guest') return;

  const now = Date.now();
  // If this device just wrote locally and this is its own pending write, skip to avoid UI jitter
  if (cloudData.hasPendingWrites) {
    return;
  }
  if (window.__lastLocalCartSaveTime && (now - window.__lastLocalCartSaveTime < 2500)) {
    if (cloudData.updatedAt && cloudData.updatedAt < window.__lastLocalCartSaveTime) {
      return;
    }
  }

  const newItems = Array.isArray(cloudData.items) ? cloudData.items : [];
  const key = getCartStorageKey();
  const currentLocal = localStorage.getItem(key);
  const currentStr = currentLocal ? currentLocal : '[]';
  const newStr = JSON.stringify(newItems);

  if (currentStr === newStr) {
    return; // Already identical
  }

  // Authoritative cloud replacement (exact sync across devices, handles both additions and removals)
  localStorage.setItem(key, newStr);
  updateCartBadge();
  window.dispatchEvent(new CustomEvent('radha_cart_synced', { detail: newItems }));
}

function applyCloudWishlistUpdate(cloudData) {
  if (!cloudData) return;
  const user = getLoggedInCustomer();
  if (!user) return;
  const userStorageId = getCurrentUserStorageId();
  if (!userStorageId || userStorageId === 'guest') return;

  const now = Date.now();
  // If this device just wrote locally and this is its own pending write, skip to avoid UI jitter
  if (cloudData.hasPendingWrites) {
    return;
  }
  if (window.__lastLocalWishlistSaveTime && (now - window.__lastLocalWishlistSaveTime < 2500)) {
    if (cloudData.updatedAt && cloudData.updatedAt < window.__lastLocalWishlistSaveTime) {
      return;
    }
  }

  const newItems = Array.isArray(cloudData.items) ? cloudData.items : [];
  const key = getWishlistStorageKey();
  const currentLocal = localStorage.getItem(key);
  const currentStr = currentLocal ? currentLocal : '[]';
  const newStr = JSON.stringify(newItems);

  if (currentStr === newStr) {
    return; // Already identical
  }

  // Authoritative cloud replacement (exact sync across devices, handles both additions and removals)
  localStorage.setItem(key, newStr);
  updateWishlistBadge();
  refreshAllWishlistButtonsUI();
  window.dispatchEvent(new CustomEvent('radha_wishlist_synced', { detail: newItems }));
}

function applyCloudProfileUpdate(cloudUser) {
  if (!cloudUser) return;
  const current = getLoggedInCustomer();
  if (!current) return;

  // Match by id, phone, or email to verify it belongs to this account
  const matchId = (current.id && cloudUser.id && current.id === cloudUser.id);
  const curPhone = String(current.phone || '').trim().replace(/[\s\-\+]/g, '').slice(-10);
  const cloudPhone = String(cloudUser.phone || '').trim().replace(/[\s\-\+]/g, '').slice(-10);
  const matchPhone = (curPhone && cloudPhone && curPhone === cloudPhone);
  const curEmail = String(current.email || '').trim().toLowerCase();
  const cloudEmail = String(cloudUser.email || '').trim().toLowerCase();
  const matchEmail = (curEmail && cloudEmail && curEmail === cloudEmail);

  if (!matchId && !matchPhone && !matchEmail) {
    return; // Different user account
  }

  // If local device just saved locally within the last 2.5 seconds and this has pending writes, skip
  if (cloudUser.hasPendingWrites) {
    return;
  }
  const now = Date.now();
  if (window.__lastLocalProfileSaveTime && (now - window.__lastLocalProfileSaveTime < 2500)) {
    if (cloudUser.updatedAt && cloudUser.updatedAt < window.__lastLocalProfileSaveTime) {
      return;
    }
  }

  const updatedSession = {
    ...current,
    id: cloudUser.id || current.id,
    name: cloudUser.name || current.name,
    phone: cloudUser.phone || current.phone,
    email: cloudUser.email !== undefined ? cloudUser.email : (current.email || ''),
    city: cloudUser.city !== undefined ? cloudUser.city : (current.city || ''),
    address: cloudUser.address !== undefined ? cloudUser.address : (current.address || ''),
    role: cloudUser.role || current.role || 'user'
  };

  const curStr = JSON.stringify(current);
  const upStr = JSON.stringify(updatedSession);
  if (curStr === upStr) {
    return; // Already identical
  }

  localStorage.setItem(USER_SESSION_KEY, upStr);
  if (updatedSession.role === 'admin' || updatedSession.role === 'superadmin') {
    localStorage.setItem('radha_auth_admin_v1', upStr);
  }

  updateHeaderAuthState();
  window.dispatchEvent(new CustomEvent('radha_profile_synced', { detail: updatedSession }));
}

async function syncCloudUserData() {
  const user = getLoggedInCustomer();
  if (!user) return;
  const userStorageId = getCurrentUserStorageId();
  if (!userStorageId || userStorageId === 'guest') return;

  // 1. Attach Real-Time Snapshot Listeners for immediate updates from other devices
  if (typeof fbListenCart === 'function') {
    fbListenCart(userStorageId, (cloudData) => {
      applyCloudCartUpdate(cloudData);
    });
  }

  if (typeof fbListenWishlist === 'function') {
    fbListenWishlist(userStorageId, (cloudData) => {
      applyCloudWishlistUpdate(cloudData);
    });
  }

  // 2. Attach User Profile Real-Time Listener (Cross-Device Profile Updates)
  if (typeof fbListenUserProfile === 'function') {
    fbListenUserProfile(user, (cloudUser) => {
      applyCloudProfileUpdate(cloudUser);
    });
  }

  // 3. Initial Get Sync for Cart & Wishlist
  if (typeof fbGetCart === 'function') {
    try {
      const cloudCart = await fbGetCart(userStorageId);
      if (cloudCart) {
        applyCloudCartUpdate(cloudCart);
      } else {
        const localCart = getCart();
        if (localCart.length > 0 && typeof fbSyncCart === 'function') {
          fbSyncCart(userStorageId, localCart, Date.now());
        }
      }
    } catch (e) {
      console.warn('Sync cloud cart warning:', e);
    }
  }

  if (typeof fbGetWishlist === 'function') {
    try {
      const cloudWishlist = await fbGetWishlist(userStorageId);
      if (cloudWishlist) {
        applyCloudWishlistUpdate(cloudWishlist);
      } else {
        const localWishlist = getWishlist();
        if (localWishlist.length > 0 && typeof fbSyncWishlist === 'function') {
          fbSyncWishlist(userStorageId, localWishlist, Date.now());
        }
      }
    } catch (e) {
      console.warn('Sync cloud wishlist warning:', e);
    }
  }

  // 4. Initial Get Sync for User Profile
  if (typeof fbGetUserProfile === 'function') {
    try {
      const cloudUser = await fbGetUserProfile(user);
      if (cloudUser) {
        applyCloudProfileUpdate(cloudUser);
      }
    } catch (e) {
      console.warn('Sync cloud profile warning:', e);
    }
  }
}

// Auto sync on page startup
document.addEventListener('DOMContentLoaded', () => {
  syncCloudUserData();
});

// Auto-Expire Event Listener: Refresh UI badges & auth state when browser data reaches 1 hour TTL
window.addEventListener('radha_storage_expired', () => {
  if (typeof updateCartBadge === 'function') updateCartBadge();
  if (typeof updateWishlistBadge === 'function') updateWishlistBadge();
  if (typeof updateHeaderAuthState === 'function') updateHeaderAuthState();
  if (typeof refreshAllWishlistButtonsUI === 'function') refreshAllWishlistButtonsUI();
});

// ================================================================
// SECURITY: DISABLE RIGHT-CLICK & SHORTCUTS (UNLOCK VIA CTRL+SHIFT+ENTER)
// ================================================================
let isInspectModeUnlocked = false;

// 1. Disable Right Click (Context Menu)
document.addEventListener('contextmenu', (e) => {
  if (!isInspectModeUnlocked) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
}, true);

// 2. Disable Standard Inspect Shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U, Ctrl+S)
document.addEventListener('keydown', (e) => {
  // Secret Unlock / Toggle Shortcut: Ctrl + Shift + Enter
  if (e.ctrlKey && e.shiftKey && (e.key === 'Enter' || e.keyCode === 13)) {
    e.preventDefault();
    e.stopPropagation();
    toggleInspectMode();
    return false;
  }

  // If unlocked, allow native inspect shortcuts
  if (isInspectModeUnlocked) return;

  // Block F12
  if (e.key === 'F12' || e.keyCode === 123) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }

  // Block Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }

  // Block Ctrl+U (View Source), Ctrl+S (Save Page)
  if ((e.ctrlKey || e.metaKey) && ['u', 'U', 's', 'S'].includes(e.key)) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
}, true);

// function toggleInspectMode() {
//   isInspectModeUnlocked = !isInspectModeUnlocked;
//   if (isInspectModeUnlocked) {
//     if (typeof showToast === 'function') {
//       showToast('🔓 Inspect Mode Activated (Ctrl+Shift+Enter to lock)', 'success');
//     }
//     // Load in-page mobile & desktop devtools (Eruda)
//     if (!window.eruda) {
//       const script = document.createElement('script');
//       script.src = 'https://cdn.jsdelivr.net/npm/eruda';
//       script.onload = () => {
//         if (window.eruda) {
//           window.eruda.init();
//           window.eruda.show();
//         }
//       };
//       document.body.appendChild(script);
//     } else {
//       window.eruda.show();
//     }
//   } else {
//     if (typeof showToast === 'function') {
//       showToast('🔒 Inspect Mode Locked', 'info');
//     }
//     if (window.eruda) {
//       window.eruda.hide();
//     }
//   }
// }


