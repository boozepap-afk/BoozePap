import assert from 'node:assert/strict';
import { manualPriceFields, saveSizePrice } from '../src/lib/admin-price-save.ts';

// Model Supabase's filtered writes, including RLS returning no updated row.
function database(rows, error = null) {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push(table);
      let fields;
      const filters = [];
      return {
        update(value) { fields = value; return this; },
        eq(column, value) { filters.push([column, value]); return this; },
        select() { return this; },
        async maybeSingle() {
          if (error) return { data: null, error };
          const row = rows.find(item => filters.every(([column, value]) => item[column] === value));
          if (!row) return { data: null, error: null };
          Object.assign(row, fields);
          return { data: { ...row }, error: null };
        },
      };
    },
  };
}

const rows = [
  { id: '750ml', product_id: 'cuervo', price: 4500, old_price: 5000, discount_ends_at: '2000-01-01' },
  { id: '1l', product_id: 'cuervo', price: 6000 },
  { id: 'other', product_id: 'another-product', price: 2000 },
];
const db = database(rows);
assert.equal(await saveSizePrice(db, 'cuervo', '750ml', 3999), 3999);
assert.equal(rows[0].price, 3999, 'the selected bottle price is persisted');
assert.equal(rows[0].old_price, null, 'old discounts cannot override the manual price');
assert.equal(rows[0].discount_ends_at, null);
assert.equal(rows[1].price, 6000, 'other sizes keep their prices');
assert.equal(rows[2].price, 2000, 'other products are untouched');
assert.deepEqual(db.calls, ['product_variants']);
await assert.rejects(() => saveSizePrice(db, 'wrong-parent', '750ml', 100), /did not confirm/, 'a stale or wrong product selection cannot update another product');
assert.equal(rows[0].price, 3999);
await assert.rejects(() => saveSizePrice(database([]), 'cuervo', '750ml', 3999), /did not confirm/, 'RLS-filtered writes do not report success');
const denied = { message: 'permission denied', code: '42501' };
await assert.rejects(() => saveSizePrice(database(rows, denied), 'cuervo', '750ml', 3999), error => error === denied, 'database errors reach the admin');
assert.throws(() => manualPriceFields(-1), /valid price/);
assert.throws(() => manualPriceFields(NaN), /valid price/);
assert.equal(await saveSizePrice(db, 'cuervo', '750ml', 0), 0, 'zero is a supported explicit price');
console.log('Admin size-price persistence, product isolation, discount reset, validation, and failed-save handling passed.');
