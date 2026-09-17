// ---------------------------------------------------------------
// AUTHORITATIVE LIVE DATABASE STORAGE SYSTEM
// ---------------------------------------------------------------
const DB_STORAGE_KEY = 'radha_furniture_custom_products_v1';
const PRODUCTS_DATA = (typeof window !== 'undefined' && window.PRODUCTS_DATA) || [];

function getLiveCatalogDatabase() {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}

  // If database is not yet initialized in localStorage, initialize it with all catalog products
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(PRODUCTS_DATA));
  } catch (e) {}
  return PRODUCTS_DATA;
}

function getProductById(id) {
  const list = getLiveCatalogDatabase();
  return list.find(p => p.id === id || p._id === id);
}

function getFeaturedProducts() {
  const list = getLiveCatalogDatabase();
  const fabricationCats = ['windows', 'doors', 'gates', 'mirrors', 'partitions', 'railings', 'shower', 'aluminium', 'steel-work'];
  return list.filter(p => {
    if (!p.isFeatured) return false;
    const cat = (p.category || '').toLowerCase().trim();
    const catName = (p.categoryName || '').toLowerCase();
    const isFab = fabricationCats.includes(cat) || cat.includes('aluminium') || cat.includes('aluminum') || cat.includes('steel') || catName.includes('aluminium') || catName.includes('steel');
    return !isFab;
  });
}

function getProductsByCategory(cat) {
  const list = getLiveCatalogDatabase();
  if (!cat || cat === 'all') return list;
  return list.filter(p => p.category === cat);
}

// Global catalog reference (dynamically gets latest live database)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'productsData', {
    get() {
      return getLiveCatalogDatabase();
    },
    configurable: true
  });
}

