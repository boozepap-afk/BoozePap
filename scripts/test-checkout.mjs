import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CheckoutCartError, hasCheckoutStock, normalizeCheckoutCart, unavailableProductIds } from '../src/lib/checkout-cart.ts';

const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
assert.deepEqual(normalizeCheckoutCart([{ productId: a, quantity: 1 }]).productIds, [a], 'valid live product');
assert.deepEqual(normalizeCheckoutCart([{ product_id: a, quantity: 1 }, { productId: a, quantity: 2 }]).lines, [{ product_id: a, variant_id: undefined, quantity: 3 }], 'duplicate lines merge');
assert.throws(() => normalizeCheckoutCart([{ productId: 'sample-beer', quantity: 1 }]), CheckoutCartError, 'malformed/sample IDs rejected');
assert.deepEqual(unavailableProductIds([a,b], [{ id:a, is_active:true }]), [b], 'stale ID returned exactly');
assert.deepEqual(unavailableProductIds([a,b], [{ id:a, is_active:true }, { id:b, is_active:false }]), [b], 'inactive product unavailable');
assert.equal(hasCheckoutStock({ stock:0, track_inventory:true }, 1), false, 'tracked out-of-stock rejected');
assert.equal(hasCheckoutStock({ stock:0, track_inventory:false }, 1), true, 'disabled stock tracking accepted');
assert.equal(hasCheckoutStock({}, 1), true, 'missing stock column does not reject');
const route = fs.readFileSync('src/app/api/checkout/order/route.ts','utf8');
assert.match(route, /productsError[\s\S]*status: 500/, 'Supabase product query failure is a server error');
assert.match(route, /variantsError[\s\S]*status: 500/, 'Supabase variant query failure is a server error');
console.log('Checkout validation tests passed.');
