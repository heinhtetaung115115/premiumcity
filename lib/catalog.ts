import { getServiceSupabaseClient } from './supabase';
import type { ProductInputField } from '@/types/product';

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  products: ProductRow[] | null;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string;
  product_type: 'INSTANT' | 'MANUAL';
  status: 'ACTIVE' | 'INACTIVE';
  is_in_stock: boolean;
  input_schema: ProductInputField[] | null;
  delivery_note: string | null;
  variants: VariantRow[] | null;
};

type VariantRow = {
  id: string;
  product_id: string;
  name: string;
  price: number;
  is_default: boolean;
  is_active: boolean;
  position: number;
};

function mapVariant(row: VariantRow) {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    price: Number(row.price),
    isDefault: row.is_default,
    isActive: row.is_active,
    position: row.position
  };
}

function mapProduct(row: ProductRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    categoryId: row.category_id,
    productType: row.product_type,
    status: row.status,
    isInStock: row.is_in_stock,
    inputSchema: row.input_schema,
    deliveryNote: row.delivery_note,
    variants: (row.variants ?? []).map(mapVariant)
  };
}

export async function getActiveCategories() {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('categories')
    .select(
      `id, name, slug, description, products(id, name, slug, description, category_id, product_type, status, is_in_stock, input_schema, delivery_note)`
    )
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as CategoryRow[]).map((category) => {
    const products = (category.products ?? []).filter((product) => product.status === 'ACTIVE' && product.is_in_stock);
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      productCount: products.length
    };
  }).filter((category) => category.productCount > 0);
}

export async function getCategoryBySlug(slug: string) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('categories')
    .select(
      `id, name, slug, description, products(id, name, slug, description, category_id, product_type, status, is_in_stock, input_schema, delivery_note, variants(*))`
    )
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const category = data as CategoryRow;
  const products = (category.products ?? [])
    .filter((product) => product.status === 'ACTIVE')
    .map((product) => ({ ...mapProduct(product), variants: (product.variants ?? []).map(mapVariant).filter((variant) => variant.isActive) }))
    .map((product) => ({ ...product, variants: product.variants.sort((a, b) => a.position - b.position) }))
    .filter((product) => product.variants.length > 0);

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    products
  };
}

export async function getProductBySlug(slug: string) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select(
      `id, name, slug, description, category:categories(id, name, slug), category_id, product_type, status, is_in_stock, input_schema, delivery_note, variants(*)`
    )
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const product = data as ProductRow & { category: { id: string; name: string; slug: string } | null };
  return {
    ...mapProduct(product),
    category: product.category,
    variants: (product.variants ?? [])
      .map(mapVariant)
      .filter((variant) => variant.isActive)
      .sort((a, b) => a.position - b.position)
  };
}
