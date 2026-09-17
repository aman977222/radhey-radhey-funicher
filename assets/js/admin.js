/* ================================================================
   RADHEY RADHEY FURNITURE & HANDICRAFT — ADMIN PORTAL LOGIC
   Clean LocalStorage-Powered Administration (Zero Server Required)
   ================================================================ */

const ADMIN_PRODUCTS_STORAGE_KEY = 'radha_furniture_custom_products_v1';
const ADMIN_ORDERS_STORAGE_KEY = 'radha_furniture_orders_v1';
const ADMIN_SESSION_KEY = 'radha_auth_admin_v1';

// Format INR Price (₹48,999)
function formatINR(num) {
  return '₹' + Number(num || 0).toLocaleString('en-IN');
}

// ----------------------------------------------------------------
// 1. ADMIN AUTHENTICATION & ROLE GUARDS
// ----------------------------------------------------------------
async function adminLoginWithDB(username, password) {
  if (typeof fbLoginUser === 'function') {
    const res = await fbLoginUser(username, password);
    if (res && res.success) {
      const role = (res.user && res.user.role ? res.user.role : '').toLowerCase();
      if (role === 'admin' || role === 'superadmin') {
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(res.user));
        localStorage.setItem('radha_auth_user_v1', JSON.stringify(res.user));
        return { success: true, admin: res.user };
      }
      return { success: false, message: 'Access Denied: This account does not have Admin privileges.' };
    }
    return res;
  }

  // Local database fallback check against registered accounts
  try {
    const users = JSON.parse(localStorage.getItem('radha_registered_users_v1') || '[]');
    for (const u of users) {
      const emailMatches = u.email && u.email.toLowerCase() === (username || '').toLowerCase();
      const phoneMatches = u.phone && u.phone.replace(/[\s\-\+]/g, '') === (username || '').replace(/[\s\-\+]/g, '');
      if (emailMatches || phoneMatches) {
        const isMatch = (typeof verifyPassword === 'function') 
          ? await verifyPassword(password, u.password) 
          : (u.password === password);
        if (isMatch) {
          const role = (u.role || '').toLowerCase();
          if (role === 'admin' || role === 'superadmin') {
            const adminUser = {
              id: u.id || '',
              name: u.name,
              email: u.email || '',
              phone: u.phone || '',
              role: role
            };
            localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(adminUser));
            localStorage.setItem('radha_auth_user_v1', JSON.stringify(adminUser));
            return { success: true, admin: adminUser };
          }
          return { success: false, message: 'Access Denied: This account does not have Admin privileges.' };
        }
      }
    }
  } catch (e) {}

  return { success: false, message: 'Invalid admin credentials! Please check your email/mobile and password.' };
}

function getLoggedInAdmin() {
  try {
    const data = localStorage.getItem(ADMIN_SESSION_KEY);
    if (data) return JSON.parse(data);
    // Sync from user session if role is admin or superadmin
    const userSession = localStorage.getItem('radha_auth_user_v1');
    if (userSession) {
      const u = JSON.parse(userSession);
      const r = (u.role || '').toLowerCase();
      if (r === 'admin' || r === 'superadmin') {
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(u));
        return u;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function enforceAdminAuth(requireSuperAdmin = false) {
  const admin = getLoggedInAdmin();
  if (!admin) {
    const currentPath = window.location.pathname.replace(/\\/g, '/').split('/').slice(-2).join('/');
    window.location.href = '../login.html?redirect=' + encodeURIComponent(currentPath);
    return null;
  }

  const role = (admin.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'superadmin') {
    alert('Access Denied: You do not have permission to access the Store Admin Portal.');
    window.location.href = '../user/dashboard.html';
    return null;
  }

  if (requireSuperAdmin && role !== 'superadmin') {
    alert('Access Restricted: Only Super Admin can access this section!');
    window.location.href = 'dashboard.html';
    return null;
  }

  return admin;
}

function setupAdminNavigation() {
  const admin = getLoggedInAdmin();
  if (!admin) return;

  const role = (admin.role || '').toLowerCase();
  const isSuper = role === 'superadmin';

  // Toggle Super-Admin only elements in sidebar & page
  const superOnlyElements = document.querySelectorAll('.super-admin-only');
  superOnlyElements.forEach(el => {
    el.style.display = isSuper ? '' : 'none';
  });

  // Display admin name
  const nameDisplays = document.querySelectorAll('.admin-user-name, #adminUserNameDisplay');
  nameDisplays.forEach(el => {
    el.textContent = admin.name || (isSuper ? 'Store Super Admin' : 'Store Admin');
  });

  // Display role badge
  const roleBadges = document.querySelectorAll('.admin-role-badge, #adminRoleBadge');
  roleBadges.forEach(el => {
    if (isSuper) {
      el.textContent = '👑 SUPER ADMIN';
      el.style.background = 'bisque';
      el.style.color = 'brown';
      el.style.border = '1px solid gold';
    } else {
      el.textContent = '🛡️ STORE ADMIN';
      el.style.background = 'aliceblue';
      el.style.color = 'dodgerblue';
      el.style.border = '1px solid lightblue';
    }
  });

  // Display avatar icon
  const avatars = document.querySelectorAll('.admin-avatar-display, #adminAvatarDisplay');
  avatars.forEach(el => {
    el.textContent = isSuper ? '👑' : '🛡️';
  });

  // Setup Mobile Hamburger Menu & Overlay for convenient mobile admin navigation
  setupMobileSidebarToggle();
}

function setupMobileSidebarToggle() {
  const header = document.querySelector('.admin-header');
  const sidebar = document.querySelector('.admin-sidebar');
  if (!header || !sidebar) return;

  if (!document.getElementById('adminMobileMenuBtn')) {
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'adminMobileMenuBtn';
    toggleBtn.className = 'admin-mobile-menu-btn';
    toggleBtn.type = 'button';
    toggleBtn.innerHTML = '☰';
    toggleBtn.title = 'Toggle Navigation Menu';
    toggleBtn.onclick = function() {
      sidebar.classList.toggle('open');
      const overlay = document.getElementById('adminSidebarOverlay');
      if (overlay) overlay.classList.toggle('active');
    };
    header.prepend(toggleBtn);
  }

  if (!document.getElementById('adminSidebarOverlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'adminSidebarOverlay';
    overlay.className = 'sidebar-overlay';
    overlay.onclick = function() {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    };
    document.body.appendChild(overlay);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupAdminNavigation();
});

function adminLogout() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  localStorage.removeItem('radha_auth_user_v1');
  window.location.href = '../login.html';
}

// Auto-Expire Event Listener: Handle 1-hour session expiry in Admin Panel
window.addEventListener('radha_storage_expired', (e) => {
  const expired = (e.detail && e.detail.keys) ? e.detail.keys : [];
  if (expired.includes(ADMIN_SESSION_KEY) || expired.includes('radha_auth_user_v1')) {
    if (!window.__adminExpiredAlert) {
      window.__adminExpiredAlert = true;
      alert('⏰ 1 Ghante ka samay poora ho gaya hai. Suraksha ke liye admin portal ka session delete ho gaya hai. Kripya dobara login karein.');
      window.location.href = '../login.html';
    }
  }
});

// ----------------------------------------------------------------
// 2. PRODUCT MANAGEMENT (Firebase Cloud + Local)
// ----------------------------------------------------------------
async function fetchAdminProductsFromDB() {
  if (typeof fbGetProducts === 'function') {
    return await fbGetProducts();
  }
  return getAdminProducts();
}

function getAdminProducts() {
  try {
    const custom = localStorage.getItem(ADMIN_PRODUCTS_STORAGE_KEY);
    if (custom) {
      let parsed = JSON.parse(custom);
      if (Array.isArray(parsed)) {
        parsed = parsed.filter(p => p.id !== 'rf-107' && (!p.title || !p.title.includes('Rocking Chair (Aaram Kursi)')));
        return parsed;
      }
    }
  } catch (e) {}
  if (typeof PRODUCTS_DATA !== 'undefined') {
    const prods = PRODUCTS_DATA.filter(p => p.id !== 'rf-107' && (!p.title || !p.title.includes('Rocking Chair (Aaram Kursi)')));
    localStorage.setItem(ADMIN_PRODUCTS_STORAGE_KEY, JSON.stringify(prods));
    return prods;
  }
  return [];
}

async function createProductInDB(productData) {
  if (typeof fbAddProduct === 'function') {
    return await fbAddProduct(productData);
  }
  addNewProduct(productData);
  return productData;
}

function addNewProduct(productData) {
  const products = getAdminProducts();
  products.unshift(productData);
  localStorage.setItem(ADMIN_PRODUCTS_STORAGE_KEY, JSON.stringify(products));
}

async function deleteProductFromDB(productId) {
  if (typeof fbDeleteProduct === 'function') {
    await fbDeleteProduct(productId);
    return;
  }
  deleteProduct(productId);
}

function deleteProduct(productId) {
  let products = getAdminProducts();
  products = products.filter(p => p.id !== productId && p._id !== productId);
  localStorage.setItem(ADMIN_PRODUCTS_STORAGE_KEY, JSON.stringify(products));
}

async function updateProductInDB(productId, productData) {
  if (typeof fbUpdateProduct === 'function') {
    return await fbUpdateProduct(productId, productData);
  }
  updateProductLocally(productId, productData);
  return productData;
}

function updateProductLocally(productId, productData) {
  let products = getAdminProducts();
  const idx = products.findIndex(p => p.id === productId || p._id === productId);
  if (idx !== -1) {
    products[idx] = { ...products[idx], ...productData };
    localStorage.setItem(ADMIN_PRODUCTS_STORAGE_KEY, JSON.stringify(products));
  }
}

// ----------------------------------------------------------------
// 3. ORDER MANAGEMENT (Firebase Cloud + Local)
// ----------------------------------------------------------------
async function fetchAdminOrdersFromDB() {
  if (typeof fbGetOrders === 'function') {
    return await fbGetOrders();
  }
  return getAdminOrders();
}

function getAdminOrders() {
  try {
    const orders = localStorage.getItem(ADMIN_ORDERS_STORAGE_KEY);
    if (orders) {
      let parsed = JSON.parse(orders);
      if (Array.isArray(parsed)) {
        // Filter out legacy hardcoded sample orders if present
        parsed = parsed.filter(o => o.orderId !== 'RF-84920' && o.orderId !== 'RF-84918');
        return parsed;
      }
    }
  } catch (e) {}

  return [];
}

async function updateOrderStatusInDB(orderId, newStatus) {
  if (typeof fbUpdateOrderStatus === 'function') {
    await fbUpdateOrderStatus(orderId, newStatus);
    return true;
  }
  return updateOrderStatus(orderId, newStatus);
}

function updateOrderStatus(orderId, newStatus) {
  const orders = getAdminOrders();
  const order = orders.find(o => (o.orderId || o._id) === orderId);
  if (order) {
    order.status = newStatus;
    localStorage.setItem(ADMIN_ORDERS_STORAGE_KEY, JSON.stringify(orders));
    return true;
  }
  return false;
}

// ----------------------------------------------------------------
// 4. METRICS & USERS DIRECTORY (Database Synchronized)
// ----------------------------------------------------------------
async function fetchAdminMetricsFromDB() {
  const products = (await fetchAdminProductsFromDB()) || [];
  const orders = (await fetchAdminOrdersFromDB()) || [];
  
  // Clean out legacy sample orders if any were cached
  const cleanOrders = orders.filter(o => o.orderId !== 'RF-84920' && o.orderId !== 'RF-84918');

  // Total revenue is the sum of valid, non-cancelled orders
  const totalRevenue = cleanOrders.reduce((sum, o) => {
    if (o.status !== 'Cancelled') {
      return sum + (Number(o.totalAmount) || 0);
    }
    return sum;
  }, 0);

  // Pending orders: orders waiting to be crafted, packed or dispatched
  const pendingOrders = cleanOrders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length;

  let registeredUsersCount = 0;
  try {
    const users = await fetchAdminUsersFromDB();
    if (users && users.length > 0) registeredUsersCount = users.length;
  } catch (e) {}

  return {
    totalRevenue,
    totalOrders: cleanOrders.length,
    activeProducts: products.length,
    pendingOrders,
    totalUsers: registeredUsersCount
  };
}

async function fetchAdminUsersFromDB() {
  if (typeof fbGetUsers === 'function') {
    return await fbGetUsers();
  }
  try {
    const u = JSON.parse(localStorage.getItem('radha_registered_users_v1') || '[]');
    if (Array.isArray(u)) return u;
  } catch (e) {}
  return [];
}

async function deleteCustomerAccountFromDB(userIdOrContact) {
  if (typeof fbDeleteUser === 'function') {
    return await fbDeleteUser(userIdOrContact);
  }
  try {
    let users = JSON.parse(localStorage.getItem('radha_registered_users_v1') || '[]');
    users = users.filter(u => u.id !== userIdOrContact && u.email !== userIdOrContact && u.phone !== userIdOrContact);
    localStorage.setItem('radha_registered_users_v1', JSON.stringify(users));
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

