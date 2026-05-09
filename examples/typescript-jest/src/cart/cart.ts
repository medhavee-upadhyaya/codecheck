/**
 * cart.ts — Shopping cart utilities.
 */

export interface CartItem {
  name: string
  price: number
  quantity: number
}

/** Returns the total price of all items in the cart. */
export function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}

/** Applies a percentage discount to a subtotal. */
export function applyDiscount(subtotal: number, percent: number): number {
  if (percent < 0 || percent > 100) throw new Error('percent must be 0–100')
  return subtotal * (1 - percent / 100)
}

/** Returns the most expensive item's name, uppercased for display. */
export function topItemDisplay(items: CartItem[]): string {
  const top = items.sort((a, b) => b.price - a.price)[0]
  return top.name.toUpperCase()
}
