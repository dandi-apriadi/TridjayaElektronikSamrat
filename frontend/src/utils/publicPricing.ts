import type { Product } from '../types';

export function getPublicPrice(product: Pick<Product, 'price' | 'displayPrice'>): number {
  return typeof product.displayPrice === 'number' ? product.displayPrice : product.price;
}
