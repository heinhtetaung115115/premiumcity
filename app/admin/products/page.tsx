import { getServiceSupabaseClient } from '@/lib/supabase';
import {
  createBankAccountAction,
  createCategoryAction,
  createProductAction,
  createVariantAction,
  toggleProductStockAction,
  updateProductAction,
  updateVariantAction,
  deleteVariantAction,
  deleteInventoryItemAction
} from './actions';
import { Button, Card, Input, TextArea } from '@/components/ui';
import { TagEditor } from './TagEditor';
import { InventoryUploadForm } from './InventoryUploadForm';
import { ManualFieldsBuilder } from './ManualFieldsBuilder';
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

function mapProduct(
  row: any
): Product & {
  inventoryItems: {
    id: string;
    orderItemId: string | null;
    variantId: string | null;
    payload: Record<string, unknown> | null;
  }[];
} {
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
    tags: Array.isArray(row.tags) ? row.tags : [],
    variants: (row.variants ?? []).map(mapVariant),
    category: row.category ?? null,
    inventoryItems: (row.inventory_items ?? []).map((item: any) => ({
      id: item.id,
      orderItemId: item.order_item_id ?? null,
      variantId: item.variant_id ?? null,
      payload: item.payload ?? null
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

function Banner({ code }: { code?: string }) {
  if (!code) return null;
  const msg =
    code === 'category_created'
      ? 'Category created.'
      : code === 'product_created'
      ? 'Product created.'
      : code === 'variant_added'
      ? 'Variant added.'
      : code === 'inventory_added'
      ? 'Inventory item added.'
      : code === 'inventory_added_bulk'
      ? 'Inventory items added.'
      : code === 'marked_in_stock'
      ? 'Product marked in stock.'
      : code === 'marked_out_of_stock'
      ? 'Product marked out of stock.'
      : code === 'bank_added'
      ? 'Bank account saved.'
      : code === 'product_updated'
      ? 'Product updated.'
      : code === 'variant_updated'
      ? 'Variant updated.'
      : code === 'variant_deleted'
      ? 'Variant deleted.'
      : code === 'inventory_deleted'
      ? 'Credential deleted.'
      : null;
  if (!msg) return null;
  return (
    <div className="rounded border border-emerald-700 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-200">
      {msg}
    </div>
  );
}

export default async function AdminProductsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = getServiceSupabaseClient();

  const [categoriesData, productsData, banksData] = await Promise.all([
    supabase
      .from('categories')
      .select('id,name')
      .order('name', { ascending: true }),
    supabase
      .from('products')
      .select(
        'id,name,slug,description,category_id,product_type,status,is_in_stock,input_schema,delivery_note,tags,category:categories(id,name),variants:product_variants!product_id(*),inventory_items!product_id(id,order_item_id,variant_id,payload)'
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('bank_accounts')
      .select('*')
      .order('bank_name', { ascending: true })
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

  const categories = (categoriesData.data ?? []) as any[];

  const products = ((productsData.data ?? []) as any[])
    .map(mapProduct)
    .map((product) => ({
      ...product,
      variants: product.variants.sort((a, b) => a.position - b.position)
    }));

  const banks = ((banksData.data ?? []) as any[]).map(mapBank);

  const m = (Array.isArray(searchParams?.m)
    ? searchParams?.m[0]
    : searchParams?.m) as string | undefined;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">
          Catalog &amp; payment configuration
        </h1>
        <p className="text-sm text-slate-400">
          Manage categories, products, instant inventory, and bank destinations.
        </p>
        <Banner code={m} />
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <details>
            <summary className="cursor-pointer list-none text-lg font-medium text-emerald-300">
              + Create category
            </summary>
            {/* 👇 cast action to any to satisfy TS */}
            <form
              action={createCategoryAction as any}
              className="mt-4 space-y-3"
            >
              <div>
                <label
                  className="text-xs uppercase text-slate-400"
                  htmlFor="categoryName"
                >
                  Name
                </label>
                <Input id="categoryName" name="name" required />
              </div>
              <div>
                <label
                  className="text-xs uppercase text-slate-400"
                  htmlFor="categoryDescription"
                >
                  Description
                </label>
                <TextArea id="categoryDescription" name="description" rows={3} />
              </div>
              <Button type="submit">Create category</Button>
            </form>
          </details>
        </Card>

        <Card>
          <details>
            <summary className="cursor-pointer list-none text-lg font-medium text-emerald-300">
              + Add bank account
            </summary>
            <form
              action={createBankAccountAction as any}
              className="mt-4 space-y-3"
            >
              <Input name="bankName" placeholder="KBZ" required />
              <Input name="accountName" placeholder="PremiumCity" required />
              <Input name="accountNo" placeholder="123456789" required />
              <Input name="qrCodeUrl" placeholder="https://example.com/qr.png" />
              <TextArea
                name="instructions"
                placeholder="Preferred transfer instructions"
                rows={3}
              />
              <Button type="submit">Save bank</Button>
            </form>
            <div className="mt-4 space-y-2 text-sm text-slate-400">
              {banks.map((bank) => (
                <div
                  key={bank.id}
                  className="rounded border border-slate-800 px-3 py-2"
                >
                  {bank.bankName} · {bank.accountNo}
                </div>
              ))}
              {banks.length === 0 && <p>No banks configured.</p>}
            </div>
          </details>
        </Card>
      </section>

      <section className="space-y-4">
        <Card>
          <details>
            <summary className="cursor-pointer list-none text-lg font-medium text-emerald-300">
              + Create product
            </summary>
            <form
            action={createProductAction as any}
            className="mt-4 grid gap-3 md:grid-cols-2"
          >
            <div className="space-y-3">
              <Input name="name" placeholder="Product name" required />
              <label className="block text-xs uppercase text-slate-400">
                Category
                <select
                  name="categoryId"
                  className="mt-1 w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select</option>
                  {categories.map((category: any) => (
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
                <input type="checkbox" name="isInStock" defaultChecked /> In
                stock
              </label>
            </div>
            <div className="space-y-3">
              <TextArea name="description" placeholder="Description" rows={3} />
              <TextArea
                name="deliveryNote"
                placeholder="Delivery note (shown to customers)"
                rows={3}
              />
              <ManualFieldsBuilder />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Create product</Button>
            </div>
          </form>
          </details>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Existing products</h2>
        {products.map((product) => (
          <Card key={product.id} className="border-[#26344e] !bg-[#151e30] !p-3">
            <details>
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-3 py-1">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      {product.category?.name}
                    </p>
                    <h3 className="truncate text-base font-semibold text-emerald-300">
                      {product.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[9px] font-medium text-slate-300">
                        {product.productType}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                          product.isInStock
                            ? 'bg-emerald-900/50 text-emerald-300'
                            : 'bg-rose-900/50 text-rose-300'
                        }`}
                      >
                        {product.isInStock ? 'In stock' : 'Out of stock'}
                      </span>
                    </div>
                  </div>
                  <form
                    action={toggleProductStockAction as any}
                    className="flex flex-shrink-0 items-center gap-2 text-sm"
                  >
                    <input type="hidden" name="productId" value={product.id} />
                    <input
                      type="hidden"
                      name="isInStock"
                      value={(!product.isInStock).toString()}
                    />
                    <Button type="submit" variant="secondary" className="whitespace-nowrap px-3 py-1.5 text-xs">
                      {product.isInStock ? 'Mark out' : 'Mark in'}
                    </Button>
                  </form>
                </div>
              </summary>

              {/* Edit product details */}
              <div className="mt-4 border-t border-slate-800 pt-4">
                <p className="mb-2 text-xs uppercase text-slate-500">Edit product</p>
                <form action={updateProductAction as any} className="grid gap-2 md:grid-cols-2">
                  <input type="hidden" name="productId" value={product.id} />
                  <Input name="name" defaultValue={product.name} placeholder="Product name" required className="text-sm" />
                  <TextArea
                    name="deliveryNote"
                    defaultValue={product.deliveryNote ?? ''}
                    placeholder="Delivery note (shown to customers)"
                    rows={2}
                    className="md:row-span-2 text-sm"
                  />
                  <TextArea
                    name="description"
                    defaultValue={product.description ?? ''}
                    placeholder="Description"
                    rows={2}
                    className="text-sm"
                  />
                  <ManualFieldsBuilder initial={product.inputSchema ?? []} compact />
                  <TagEditor initial={product.tags ?? []} />
                  <div className="md:col-span-2">
                    <Button type="submit" variant="secondary" className="text-xs">
                      Save changes
                    </Button>
                  </div>
                </form>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-slate-500">Variants</p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-300">
                    {product.variants.map((variant) => (
                      <li
                        key={variant.id}
                        className="space-y-2 rounded border border-slate-800 px-3 py-2"
                      >
                        <form
                          action={updateVariantAction as any}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="variantId" value={variant.id} />
                          <input type="hidden" name="productId" value={product.id} />
                          <Input
                            name="variantName"
                            defaultValue={variant.name}
                            className="h-8 w-32 text-xs"
                            required
                          />
                          <Input
                            name="price"
                            type="number"
                            min={0}
                            step="0.01"
                            defaultValue={variant.price}
                            className="h-8 w-24 text-xs"
                            required
                          />
                          <label className="inline-flex items-center gap-1 text-[11px] uppercase text-slate-400">
                            <input type="checkbox" name="isDefault" defaultChecked={variant.isDefault} /> Default
                          </label>
                          <Button type="submit" variant="secondary" className="h-8 px-2 text-xs">
                            Save
                          </Button>
                        </form>
                        <form action={deleteVariantAction as any}>
                          <input type="hidden" name="variantId" value={variant.id} />
                          <Button type="submit" variant="ghost" className="h-7 px-2 text-xs text-rose-300 hover:text-rose-200">
                            Delete variant
                          </Button>
                        </form>
                      </li>
                    ))}
                    {product.variants.length === 0 && (
                      <li>No variants yet.</li>
                    )}
                  </ul>
                  <form
                    action={createVariantAction as any}
                    className="mt-3 space-y-2 text-sm"
                  >
                    <input type="hidden" name="productId" value={product.id} />
                    <Input
                      name="variantName"
                      placeholder="Variant name"
                      required
                    />
                    <Input
                      name="price"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Price"
                      required
                    />
                    <label className="inline-flex items-center gap-2 text-xs uppercase text-slate-400">
                      <input type="checkbox" name="isDefault" /> Default option
                    </label>
                    <Button type="submit">Add variant</Button>
                  </form>
                </div>

                {product.productType === 'INSTANT' && (
                  <div>
                    <p className="text-xs uppercase text-slate-500">
                      Inventory
                    </p>
                    {(() => {
                      const unused = product.inventoryItems.filter((item) => !item.orderItemId);
                      return (
                        <>
                          <p className="text-sm text-slate-400">{unused.length} in stock</p>
                          {unused.length > 0 && (
                            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-slate-300">
                              {unused.map((item) => {
                                const preview = item.payload
                                  ? Object.entries(item.payload)
                                      .filter(([k]) => k !== 'type')
                                      .map(([, v]) => String(v))
                                      .join(' · ')
                                  : '';
                                return (
                                  <li
                                    key={item.id}
                                    className="flex items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1"
                                  >
                                    <span className="truncate">{preview || 'credential'}</span>
                                    <form action={deleteInventoryItemAction as any}>
                                      <input type="hidden" name="inventoryItemId" value={item.id} />
                                      <Button
                                        type="submit"
                                        variant="ghost"
                                        className="h-6 flex-shrink-0 px-1.5 text-[11px] text-rose-300 hover:text-rose-200"
                                      >
                                        Delete
                                      </Button>
                                    </form>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </>
                      );
                    })()}
                    <div className="mt-3">
                      <InventoryUploadForm
                        productId={product.id}
                        variants={product.variants.map((v: any) => ({ id: v.id, name: v.name }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </details>
          </Card>
        ))}
        {products.length === 0 && <Card>No products yet.</Card>}
      </section>
    </div>
  );
}
