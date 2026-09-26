export type ProductCategory =
  | "snacks" | "beverages" | "staples" | "tobacco" | "toiletries"
  | "household" | "frozen" | "spices" | "dairy" | "other";

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category: ProductCategory;
  buyPrice: number;
  sellPrice: number;
  wholesalePrice?: number;
  buyUnit: string;
  sellUnit: string;
  conversionFactor: number;
  stock: number;
  minStock: number;
  maxStock: number;
  photo?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: ProductCategory;
  name: string;
  icon: string;
}
