export type Product = {
  id: number;
  slug: string;
  name: string;
  brand: string;
  description: string;
  abv: number;
  country: string;
  bottleSize: string;
  price: number;
  oldPrice?: number;
  stock: number;
  images: string[];
  category: string;
  rating: number;
};

export type Category = {
  slug: string;
  name: string;
  icon: string;
  image: string;
  color: string;
};

export type OrderStatus = 'pending' | 'paid' | 'packing' | 'out_for_delivery' | 'completed' | 'cancelled' | 'refunded';
