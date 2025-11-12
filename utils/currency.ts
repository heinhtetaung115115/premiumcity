export function formatCurrency(amount: number | string | bigint) {
  const value = typeof amount === 'number' ? amount : Number(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}
