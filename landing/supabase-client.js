/**
 * Supabase Client untuk Landing Page
 * Fetch katalog produk dari Supabase (read-only, pakai anon key)
 */

const SUPABASE_URL = 'https://hhywrvedlwljawgxzpkq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoeXdydmVkbHdsamF3Z3h6cGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MzM4OTgsImV4cCI6MjEwMTEwOTg5OH0.GXHRDayBNRbWh1QywGkYCJ6D79qnm_mtyRSJUxw4x50';

/**
 * Fetch semua produk visible dari Supabase
 * @returns {Promise<Array>} Array of products
 */
async function fetchProductsFromSupabase() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/products?visible=eq.true&order=order_index.asc`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Supabase fetch failed:', response.status, response.statusText);
      return [];
    }

    const products = await response.json();
    
    // Transform Supabase schema → landing catalog format
    return products.map(p => ({
      id: p.app_type || p.id,
      icon: p.icon || '📦',
      name: p.name,
      desc: p.description || '',
      price: parseInt(p.price_label?.replace(/\D/g, '') || '0', 10),
      category: p.app_type === 'retail' || p.app_type === 'rosok' || p.app_type === 'gerobak' ? 'bisnis' : 'institusi',
      hot: p.order_index === 0, // First product = hot
      trialUrl: `https://example.com/trial/${p.app_type}`
    }));
  } catch (error) {
    console.error('Error fetching products from Supabase:', error);
    return [];
  }
}

/**
 * Fetch katalog — try Supabase first, fallback to localStorage, then default
 * @param {Array} fallback Default catalog if all sources fail
 * @returns {Promise<Array>}
 */
async function getCatalog(fallback = []) {
  // Try Supabase first
  const supabaseProducts = await fetchProductsFromSupabase();
  if (supabaseProducts.length > 0) {
    console.log('✅ Katalog loaded from Supabase:', supabaseProducts.length, 'products');
    return supabaseProducts;
  }

  // Fallback to localStorage (for backward compatibility)
  try {
    const localCatalog = localStorage.getItem('kasirsolo:catalog');
    if (localCatalog) {
      const parsed = JSON.parse(localCatalog);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log('⚠️ Katalog loaded from localStorage (fallback):', parsed.length, 'products');
        return parsed;
      }
    }
  } catch (e) {
    console.error('localStorage read failed:', e);
  }

  // Last resort: fallback
  console.log('⚠️ Using default catalog fallback');
  return fallback;
}
