import { getServiceSupabaseClient } from './supabase';
import type { ProductInputField } from '@/types/product';

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string;
  product_type: 'INSTANT' | 'MANUAL';
  status: 'ACTIVE' | 'INACTIVE';
  is_in_stock: boolean; // present in DB but we ignore it for logic
  input_schema: ProductInputField[] | null;
  delivery_note: string | null;
  image_url?: string | null;
};

type VariantRow = {
  id: string;
  product_id: string;
  name: string;
  price: number;
  is_default: boolean;
  is_active: boolean;
  position: number | null;
  created_at?: string | null;
  // Filled only on product page: how many unused inventory_items exist for this variant
  availableInventoryCount?: number;
};

type InventoryRow = {
  product_id: string;
  order_item_id: string | null;
};

function mapVariant(row: VariantRow) {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    price: Number(row.price),
    isDefault: row.is_default,
    isActive: row.is_active,
    position: row.position ?? 0,
    // expose for UI (checkout) – 0 if undefined
    availableInventoryCount: row.availableInventoryCount ?? 0,
  };
}

/**
 * Stable variant ordering:
 *  - First by `position` (if you ever set manual ordering)
 *  - Then by `created_at` (older = first created = comes first)
 *
 * This avoids “random” ordering when many variants share the same position.
 */
function sortVariantsForDisplay(list: VariantRow[]): VariantRow[] {
  return [...list].sort((a, b) => {
    const posA =
      typeof a.position === 'number' && !Number.isNaN(a.position)
        ? a.position
        : 999999;
    const posB =
      typeof b.position === 'number' && !Number.isNaN(b.position)
        ? b.position
        : 999999;

    if (posA !== posB) {
      return posA - posB;
    }

    const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tB = b.created_at ? new Date(b.created_at).getTime() : 0;

    return tA - tB;
  });
}

/**
 * Build final product object + compute stock from inventory.
 *
 * Rules:
 *  - INSTANT: in stock if availableInventoryCount > 0
 *  - MANUAL: always in stock (you delete product to “disable” it)
 */
function mapProduct(
  row: ProductRow,
  variants: VariantRow[],
  availableInventoryCount: number
) {
  const isInStock =
    row.product_type === 'INSTANT'
      ? availableInventoryCount > 0
      : true;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    categoryId: row.category_id,
    productType: row.product_type,
    status: row.status,
    isInStock,
    inputSchema: row.input_schema,
    deliveryNote: row.delivery_note,
    imageUrl: row.image_url ?? null,
    variants: variants.map(mapVariant),
    // extra debug field if you want to show it later
    availableInventoryCount,
  };
}

/**
 * Home page – fetch ALL active products across all categories,
 * with their variants, inventory counts, and category info.
 */
export async function getAllProducts() {
  const supabase = getServiceSupabaseClient();

  // Parallel fetch: categories, products, variants, inventory
  const [
    { data: categoryRows, error: catError },
    { data: productRows, error: prodError },
  ] = await Promise.all([
    supabase
      .from('categories')
      .select('id,name,slug,description')
      .order('created_at', { ascending: true }),
    supabase
      .from('products')
      .select(
        'id,name,slug,description,category_id,product_type,status,is_in_stock,input_schema,delivery_note,image_url'
      )
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: true }),
  ]);

  if (catError) throw catError;
  if (prodError) throw prodError;

  const categories = (categoryRows ?? []) as CategoryRow[];
  const products = (productRows ?? []) as ProductRow[];
  const productIds = products.map((p) => p.id);

  if (productIds.length === 0) {
    return { categories: [], products: [] };
  }

  const [
    { data: variantRows, error: varError },
    { data: inventoryRows, error: invError },
  ] = await Promise.all([
    supabase
      .from('product_variants')
      .select('id,product_id,name,price,is_default,is_active,position,created_at')
      .in('product_id', productIds),
    supabase
      .from('inventory_items')
      .select('product_id,order_item_id')
      .in('product_id', productIds)
      .is('order_item_id', null)
      .limit(10000),
  ]);

  if (varError) throw varError;
  if (invError) throw invError;

  const variants = (variantRows ?? []) as VariantRow[];
  const inventory = (inventoryRows ?? []) as InventoryRow[];

  // Build maps
  const variantsByProduct: Record<string, VariantRow[]> = {};
  for (const v of variants) {
    if (!v.is_active) continue;
    if (!variantsByProduct[v.product_id]) {
      variantsByProduct[v.product_id] = [];
    }
    variantsByProduct[v.product_id].push(v);
  }
  for (const pid of Object.keys(variantsByProduct)) {
    variantsByProduct[pid] = sortVariantsForDisplay(variantsByProduct[pid]);
  }

  const inventoryByProduct: Record<string, number> = {};
  for (const row of inventory) {
    // Already filtered to unused items (order_item_id IS NULL) in query
    inventoryByProduct[row.product_id] =
      (inventoryByProduct[row.product_id] ?? 0) + 1;
  }

  const categoryById: Record<string, { id: string; name: string; slug: string }> = {};
  for (const c of categories) {
    categoryById[c.id] = { id: c.id, name: c.name, slug: c.slug };
  }

  const resultProducts = products.map((p) => {
    const productVariants = variantsByProduct[p.id] ?? [];
    const availableCount = inventoryByProduct[p.id] ?? 0;
    const mapped = mapProduct(p, productVariants, availableCount);
    return {
      ...mapped,
      categoryName: categoryById[p.category_id]?.name ?? 'Other',
      categorySlug: categoryById[p.category_id]?.slug ?? '',
    };
  });

  // Only return categories that have active products
  const usedCategoryIds = new Set(products.map((p) => p.category_id));
  const activeCategories = categories
    .filter((c) => usedCategoryIds.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, slug: c.slug }));

  return { categories: activeCategories, products: resultProducts };
}

/**
 * Home page – list categories that have at least one ACTIVE product.
 * We don't care about stock here; if a category has any ACTIVE product, it shows.
 */
export async function getActiveCategories() {
  const supabase = getServiceSupabaseClient();

  const [
    { data: categoryRows, error: catError },
    { data: productRows, error: prodError }
  ] = await Promise.all([
    supabase
      .from('categories')
      .select('id,name,slug,description')
      // ✅ Oldest category first (by creation time)
      .order('created_at', { ascending: true }),
    supabase.from('products').select('id,category_id,status')
  ]);

  if (catError) throw catError;
  if (prodError) throw prodError;

  type ProductStatusRow = {
    id: string;
    category_id: string;
    status: 'ACTIVE' | 'INACTIVE';
  };

  const categories = (categoryRows ?? []) as CategoryRow[];
  const products = (productRows ?? []) as ProductStatusRow[];

  const productsByCategory: Record<string, number> = {};

  for (const p of products) {
    if (p.status === 'ACTIVE') {
      productsByCategory[p.category_id] =
        (productsByCategory[p.category_id] ?? 0) + 1;
    }
  }

  return categories
    .map((category) => {
      const productCount = productsByCategory[category.id] ?? 0;
      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        productCount,
      };
    })
    .filter((category) => category.productCount > 0);
}

/**
 * Category page:
 *  1) Get category by slug
 *  2) Get products in that category
 *  3) Get all variants for those products
 *  4) Get all inventory_items for those products
 *  5) Join everything in JS and compute isInStock
 */
export async function getCategoryBySlug(slug: string) {
  const supabase = getServiceSupabaseClient();

  // 1) Category
  const { data: catData, error: catError } = await supabase
    .from('categories')
    .select('id,name,slug,description')
    .eq('slug', slug)
    .maybeSingle();

  if (catError) throw catError;
  if (!catData) return null;

  const category = catData as CategoryRow;

  // 2) Products in this category
  const { data: productRows, error: prodError } = await supabase
    .from('products')
    .select(
      `
      id,
      name,
      slug,
      description,
      category_id,
      product_type,
      status,
      is_in_stock,
      input_schema,
      delivery_note
    `
    )
    .eq('category_id', category.id)
    // ✅ Oldest product first within this category
    .order('created_at', { ascending: true });

  if (prodError) throw prodError;

  const products = (productRows ?? []) as ProductRow[];
  const productIds = products.map((p) => p.id);

  if (productIds.length === 0) {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      products: [] as any[],
    };
  }

  // 3) Variants for these products
  const { data: variantRows, error: varError } = await supabase
    .from('product_variants')
    .select(
      `
      id,
      product_id,
      name,
      price,
      is_default,
      is_active,
      position,
      created_at
    `
    )
    .in('product_id', productIds);

  if (varError) throw varError;

  const variants = (variantRows ?? []) as VariantRow[];

  // Build productId -> variants[]
  const variantsByProduct: Record<string, VariantRow[]> = {};
  for (const v of variants) {
    if (!v.is_active) continue; // only active variants
    if (!variantsByProduct[v.product_id]) {
      variantsByProduct[v.product_id] = [];
    }
    variantsByProduct[v.product_id].push(v);
  }

  // ensure sorted in a stable, predictable way
  for (const pid of Object.keys(variantsByProduct)) {
    variantsByProduct[pid] = sortVariantsForDisplay(variantsByProduct[pid]);
  }

  // 4) Inventory for these products (only unused items)
  const { data: inventoryRows, error: invError } = await supabase
    .from('inventory_items')
    .select('product_id,order_item_id')
    .in('product_id', productIds)
    .is('order_item_id', null)
    .limit(10000);

  if (invError) throw invError;

  const inventory = (inventoryRows ?? []) as InventoryRow[];

  // Build productId -> available count
  const inventoryByProduct: Record<string, number> = {};
  for (const row of inventory) {
    inventoryByProduct[row.product_id] =
      (inventoryByProduct[row.product_id] ?? 0) + 1;
  }

  // 5) Combine everything
  const resultProducts = products
    .filter((p) => p.status === 'ACTIVE')
    .map((p) => {
      const productVariants = variantsByProduct[p.id] ?? [];
      const availableCount = inventoryByProduct[p.id] ?? 0;
      return mapProduct(p, productVariants, availableCount);
    });

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    products: resultProducts,
  };
}

/**
 * Product page:
 *  1) Get product by slug + its category
 *  2) Get variants for this product
 *  3) Get inventory_items for this product
 *  4) Compute isInStock
 */
export async function getProductBySlug(slug: string) {
  const supabase = getServiceSupabaseClient();

  // 1) Product + category
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      id,
      name,
      slug,
      description,
      category_id,
      product_type,
      status,
      is_in_stock,
      input_schema,
      delivery_note,
      image_url,
      tags,
      category:categories (
        id,
        name,
        slug
      )
    `
    )
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const productRow = data as ProductRow & {
    category: { id: string; name: string; slug: string } | null;
  };

  // 2) Variants for this product
  const { data: variantRows, error: varError } = await supabase
    .from('product_variants')
    .select(
      `
      id,
      product_id,
      name,
      price,
      is_default,
      is_active,
      position,
      created_at
    `
    )
    .eq('product_id', productRow.id);

  if (varError) throw varError;

  const activeVariants = sortVariantsForDisplay(
    ((variantRows ?? []) as VariantRow[]).filter((v) => v.is_active)
  );

  // 3) Inventory for this product (per variant)
  const { data: inventoryRows, error: invError } = await supabase
    .from('inventory_items')
    .select('order_item_id,variant_id')
    .eq('product_id', productRow.id);

  if (invError) throw invError;

  let availableCount = 0;
  const availableByVariant: Record<string, number> = {};

  for (const row of (inventoryRows ?? []) as {
    order_item_id: string | null;
    variant_id: string | null;
  }[]) {
    const isUnused = !row.order_item_id;
    if (!isUnused) continue;

    availableCount++;

    const vid = row.variant_id ? String(row.variant_id) : null;
    if (vid) {
      availableByVariant[vid] = (availableByVariant[vid] ?? 0) + 1;
    }
  }

  const variantsWithCounts: VariantRow[] = activeVariants.map((v) => ({
    ...v,
    availableInventoryCount: availableByVariant[String(v.id)] ?? 0,
  }));

  // 4) Combine
  const base = mapProduct(productRow, variantsWithCounts, availableCount);

  // 5) Sold count — total quantity ordered for this product (any status),
  // plus a +100 marketing boost so new products still look popular.
  let soldCount = 100;
  try {
    const { data: soldRows } = await supabase
      .from('order_items')
      .select('quantity')
      .eq('product_id', productRow.id)
      .limit(5000);
    const realSold = ((soldRows ?? []) as any[]).reduce(
      (sum, r) => sum + (Number(r.quantity) || 1),
      0
    );
    soldCount = realSold + 100;
  } catch {
    soldCount = 100;
  }

  return {
    ...base,
    imageUrl: (productRow as any).image_url ?? null,
    soldCount,
    category: productRow.category,
    tags: Array.isArray((productRow as any).tags) ? (productRow as any).tags : [],
  };
}

/**
 * Out-of-stock INSTANT variants, for the admin dashboard.
 *
 * A variant is "out of stock" when it has no unused inventory to sell:
 *   - no unused rows tagged with its own variant_id, AND
 *   - no unused rows shared across the product (variant_id IS NULL)
 *
 * MANUAL products are excluded — they're fulfilled by hand, so "stock" doesn't
 * apply. Only active variants of active/INSTANT products are checked. An
 * INSTANT product with no variants at all is flagged as one row if it has zero
 * shared stock.
 */
export type OutOfStockVariant = {
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
};

export async function getOutOfStockVariants(): Promise<OutOfStockVariant[]> {
  const supabase = getServiceSupabaseClient();

  // INSTANT products only (MANUAL is always "in stock").
  const { data: productRows } = await supabase
    .from('products')
    .select('id,name,product_type,status')
    .eq('product_type', 'INSTANT')
    .limit(1000);

  const products = ((productRows ?? []) as any[]).filter(
    (p) => String(p.status ?? '').toUpperCase() !== 'ARCHIVED'
  );
  if (products.length === 0) return [];

  const productIds = products.map((p) => p.id);
  const nameById = new Map(products.map((p) => [p.id, p.name as string]));

  // Active variants for those products.
  const { data: variantRows } = await supabase
    .from('product_variants')
    .select('id,product_id,name,is_active')
    .in('product_id', productIds)
    .limit(5000);

  const variants = ((variantRows ?? []) as any[]).filter((v) => v.is_active);

  // Unused inventory for those products.
  const { data: invRows } = await supabase
    .from('inventory_items')
    .select('product_id,variant_id,order_item_id')
    .in('product_id', productIds)
    .is('order_item_id', null)
    .limit(10000);

  // Count unused stock per variant, and per-product shared (variant_id null).
  const unusedByVariant = new Map<string, number>();
  const sharedByProduct = new Map<string, number>();
  for (const row of (invRows ?? []) as any[]) {
    if (row.variant_id) {
      const k = String(row.variant_id);
      unusedByVariant.set(k, (unusedByVariant.get(k) ?? 0) + 1);
    } else {
      const k = String(row.product_id);
      sharedByProduct.set(k, (sharedByProduct.get(k) ?? 0) + 1);
    }
  }

  const out: OutOfStockVariant[] = [];

  // Variants with zero own-stock AND zero shared stock on their product.
  const variantsByProduct = new Map<string, any[]>();
  for (const v of variants) {
    if (!variantsByProduct.has(v.product_id)) variantsByProduct.set(v.product_id, []);
    variantsByProduct.get(v.product_id)!.push(v);
  }

  for (const v of variants) {
    const own = unusedByVariant.get(String(v.id)) ?? 0;
    const shared = sharedByProduct.get(String(v.product_id)) ?? 0;
    if (own === 0 && shared === 0) {
      out.push({
        productId: v.product_id,
        productName: nameById.get(v.product_id) ?? 'Unknown product',
        variantId: v.id,
        variantName: v.name,
      });
    }
  }

  // INSTANT products with NO active variants — flag if zero shared stock.
  for (const p of products) {
    const hasVariants = (variantsByProduct.get(p.id) ?? []).length > 0;
    if (hasVariants) continue;
    const shared = sharedByProduct.get(String(p.id)) ?? 0;
    if (shared === 0) {
      out.push({
        productId: p.id,
        productName: nameById.get(p.id) ?? 'Unknown product',
        variantId: null,
        variantName: null,
      });
    }
  }

  // Sort by product name for a stable, scannable list.
  out.sort((a, b) => a.productName.localeCompare(b.productName));
  return out;
}
