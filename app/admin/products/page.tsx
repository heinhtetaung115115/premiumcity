import { getServiceSupabaseClient } from '@/lib/supabase';
import {
  addInventoryAction,
  createBankAccountAction,
  createCategoryAction,
  createProductAction,
  createVariantAction,
  toggleProductStockAction
} from './actions';
import { Button, Card, Input, TextArea } from '@/components/ui';
import type { Product, ProductVariant, BankAccount } from '@/types/entities';

function mapVariant(row: any): ProductVariant {
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

function mapProduct(row: any): Product & { inventoryItems: { id: string; orderItemId: string | null }[] } {
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
    variants: (row.variants ?? []).map(mapVariant),
    category: row.category ?? null,
    inventoryItems: (row.inventory_items ?? []).map((item: any) => ({
      id: item.id,
      orderItemId: item.order_item_id ?? null
    }))
  };
}

function mapBank(row: any): BankAccount {
  return {
    id: row.id,
    bankName: row.bank_name,
    accountName: row.account_name,
    accountNo: row.account_no,
    instructions: row.instructions ?? null,
    qrCodeUrl: row.qr_code_url ?? null,
    isActive: row.is_active
  };
}

export default async function AdminProductsPage() {
  const supabase = getServiceSupabaseClient();
  const [categoriesData, productsData, banksData] = await Promise.all([
    supabase.from('categories').select('id, name').order('name', { ascending: true }),
    supabase
      .from('products')
      .select(
        `id, name, slug, description, category_id, product_type, status, is_in_stock, input_schema, delivery_note,
         category:categories(id, name),
         variants(*),
         inventory_items(id, order_item_id)`
      )
      .order('created_at', { ascending: false }),
    supabase.from('bank_accounts').select('*').order('bank_name', { ascending: true })
  ]);

  if (categoriesData.error) {
    throw categoriesData.error;
  }

  if (productsData.error) {
    throw productsData.error;
  }

  if (banksData.error) {
    throw banksData.error;
  }

  const categories = categoriesData.data ?? [];
  const products = (productsData.data ?? [])
    .map(mapProduct)
    .map((product) => ({
      ...product,
      variants: product.variants.sort((a, b) => a.position - b.position)
    }));
  const banks = (banksData.data ?? []).map(mapBank);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Catalog & payment configuration</h1>
        <p className="text-sm text-slate-400">Manage categories, products, instant inventory, and bank destinations.</p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-medium text-emerald-300">Create category</h2>
          <form action={createCategoryAction} className="mt-4 space-y-3">
            <div>
              <label className="text-xs uppercase text-slate-400" htmlFor="categoryName">
                Name
              </label>
              <Input id="categoryName" name="name" required />
            </div>
            <div>
              <label className="text-xs uppercase text-slate-400" htmlFor="categoryDescription">
                Description
              </label>
              <TextArea id="categoryDescription" name="description" rows={3} />
            </div>
            <Button type="submit">Create category</Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-medium text-emerald-300">Add bank account</h2>
          <form action={createBankAccountAction} className="mt-4 space-y-3">
            <Input name="bankName" placeholder="KBZ" required />
            <Input name="accountName" placeholder="PremiumCity" required />
            <Input name="accountNo" placeholder="123456789" required />
            <Input name="qrCodeUrl" placeholder="https://example.com/qr.png" />
            <TextArea name="instructions" placeholder="Preferred transfer instructions" rows={3} />
            <Button type="submit">Save bank</Button>
          </form>
          <div className="mt-4 space-y-2 text-sm text-slate-400">
            {banks.map((bank) => (
              <div key={bank.id} className="rounded border border-slate-800 px-3 py-2">
                {bank.bankName} · {bank.accountNo}
              </div>
            ))}
            {banks.length === 0 && <p>No banks configured.</p>}
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <Card>
          <h2 className="text-lg font-medium text-emerald-300">Create product</h2>
          <form action={createProductAction} className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="space-y-3">
              <Input name="name" placeholder="Product name" required />
              <label className="block text-xs uppercase text-slate-400">
                Category
                <select name="categoryId" className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm" required>
                  <option value="">Select</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs uppercase text-slate-400">
                Delivery type
                <select
                  name="productType"
                  className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                  defaultValue="INSTANT"
                >
                  <option value="INSTANT">Instant</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-2 text-xs uppercase text-slate-400">
                <input type="checkbox" name="isInStock" defaultChecked /> In stock
              </label>
            </div>
            <div className="space-y-3">
              <TextArea name="description" placeholder="Description" rows={3} />
              <TextArea name="deliveryNote" placeholder="Delivery note (shown to customers)" rows={3} />
              <TextArea
                name="manualFields"
                placeholder='Manual input fields JSON e.g. [{"id":"email","label":"Account email","required":true}]'
                rows={5}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Create product</Button>
            </div>
          </form>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Existing products</h2>
        {products.map((product) => (
          <Card key={product.id}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500">{product.category?.name}</p>
                <h3 className="text-lg font-medium text-emerald-300">{product.name}</h3>
                <p className="text-sm text-slate-400">{product.productType}</p>
              </div>
              <form action={toggleProductStockAction} className="flex items-center gap-2 text-sm">
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="isInStock" value={(!product.isInStock).toString()} />
                <Button type="submit" variant="secondary">
                  {product.isInStock ? 'Mark out of stock' : 'Mark in stock'}
                </Button>
              </form>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-slate-500">Variants</p>
                <ul className="mt-2 space-y-2 text-sm text-slate-300">
                  {product.variants.map((variant) => (
                    <li key={variant.id} className="rounded border border-slate-800 px-3 py-2">
                      {variant.name} · ${Number(variant.price).toFixed(2)} {variant.isDefault && '(default)'}
                    </li>
                  ))}
                  {product.variants.length === 0 && <li>No variants yet.</li>}
                </ul>
                <form action={createVariantAction} className="mt-3 space-y-2 text-sm">
                  <input type="hidden" name="productId" value={product.id} />
                  <Input name="variantName" placeholder="Variant name" required />
                  <Input name="price" type="number" min={0} step="0.01" placeholder="Price" required />
                  <label className="inline-flex items-center gap-2 text-xs uppercase text-slate-400">
                    <input type="checkbox" name="isDefault" /> Default option
                  </label>
                  <Button type="submit" variant="secondary">
                    Add variant
                  </Button>
                </form>
              </div>
              {product.productType === 'INSTANT' && (
                <div>
                  <p className="text-xs uppercase text-slate-500">Inventory</p>
                  <p className="text-sm text-slate-400">{product.inventoryItems.filter((item) => !item.orderItemId).length} in stock</p>
                  <form action={addInventoryAction} className="mt-3 space-y-2 text-sm">
                    <input type="hidden" name="productId" value={product.id} />
                    <label className="text-xs uppercase text-slate-400">
                      Variant
                      <select
                        name="variantId"
                        className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                      >
                        <option value="">Any</option>
                        {product.variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <TextArea name="payload" rows={4} placeholder='{"email":"user@example.com","password":"secret"}' required />
                    <Button type="submit" variant="secondary">
                      Add credential
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </Card>
        ))}
        {products.length === 0 && <Card>No products yet.</Card>}
      </section>
    </div>
  );
}
