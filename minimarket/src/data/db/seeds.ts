import type { Product } from "@/data/types/product";
import type { Customer } from "@/data/types/customer";
import type { Supplier } from "@/data/types/supplier";
import type { Promo, Voucher } from "@/data/types/promo";
import type { Order } from "@/data/types/order";

const now = new Date().toISOString();

export const seedProducts: Product[] = [
  { id:"p1",  name:"Indomie Goreng",          sku:"SKU001", barcode:"8999999001", category:"staples",    buyPrice:2800,  sellPrice:3500,  wholesalePrice:3200, buyUnit:"Karton", sellUnit:"Pcs",    conversionFactor:40, stock:150, minStock:20, maxStock:500, active:true, createdAt:now, updatedAt:now },
  { id:"p2",  name:"Aqua 600ml",              sku:"SKU002", barcode:"8999999002", category:"beverages",  buyPrice:2200,  sellPrice:3000,  wholesalePrice:2700, buyUnit:"Karton", sellUnit:"Botol",  conversionFactor:24, stock:200, minStock:30, maxStock:600, active:true, createdAt:now, updatedAt:now },
  { id:"p3",  name:"Gudang Garam Surya 16",   sku:"SKU003", barcode:"8999999003", category:"tobacco",    buyPrice:21000, sellPrice:25000, buyUnit:"Slop",      sellUnit:"Bungkus", conversionFactor:10, stock:80, minStock:10, maxStock:200, active:true, createdAt:now, updatedAt:now },
  { id:"p4",  name:"Minyak Bimoli 1L",        sku:"SKU004", barcode:"8999999004", category:"staples",    buyPrice:16000, sellPrice:19000, wholesalePrice:17500, buyUnit:"Karton", sellUnit:"Botol", conversionFactor:12, stock:60, minStock:10, maxStock:150, active:true, createdAt:now, updatedAt:now },
  { id:"p5",  name:"Gula Gulaku 1kg",         sku:"SKU005", barcode:"8999999005", category:"staples",    buyPrice:13000, sellPrice:15500, buyUnit:"Karung",    sellUnit:"Kg",     conversionFactor:50, stock:100, minStock:15, maxStock:300, active:true, createdAt:now, updatedAt:now },
  { id:"p6",  name:"Beras Rojolele 5kg",      sku:"SKU006", barcode:"8999999006", category:"staples",    buyPrice:58000, sellPrice:68000, buyUnit:"Karung",    sellUnit:"Sak",    conversionFactor:10, stock:40, minStock:5,  maxStock:100, active:true, createdAt:now, updatedAt:now },
  { id:"p7",  name:"Teh Pucuk Harum 350ml",   sku:"SKU007", barcode:"8999999007", category:"beverages",  buyPrice:3000,  sellPrice:4000,  wholesalePrice:3500, buyUnit:"Karton", sellUnit:"Botol",  conversionFactor:24, stock:120, minStock:20, maxStock:400, active:true, createdAt:now, updatedAt:now },
  { id:"p8",  name:"Pocari Sweat 500ml",      sku:"SKU008", barcode:"8999999008", category:"beverages",  buyPrice:5500,  sellPrice:7000,  buyUnit:"Karton",    sellUnit:"Botol",  conversionFactor:24, stock:96, minStock:15, maxStock:300, active:true, createdAt:now, updatedAt:now },
  { id:"p9",  name:"Sabun Lifebuoy 80g",      sku:"SKU009", barcode:"8999999009", category:"toiletries", buyPrice:3500,  sellPrice:5000,  buyUnit:"Karton",    sellUnit:"Pcs",    conversionFactor:72, stock:144, minStock:20, maxStock:400, active:true, createdAt:now, updatedAt:now },
  { id:"p10", name:"Rinso Cair 800ml",        sku:"SKU010", barcode:"8999999010", category:"household",  buyPrice:18000, sellPrice:22000, buyUnit:"Karton",    sellUnit:"Botol",  conversionFactor:12, stock:36, minStock:6,  maxStock:100, active:true, createdAt:now, updatedAt:now },
  { id:"p11", name:"Chitato Sapi Panggang 68g", sku:"SKU011", barcode:"8999999011", category:"snacks",   buyPrice:8000,  sellPrice:11000, buyUnit:"Karton",   sellUnit:"Pcs",    conversionFactor:20, stock:60, minStock:10, maxStock:200, active:true, createdAt:now, updatedAt:now },
  { id:"p12", name:"Oreo Coklat 133g",        sku:"SKU012", barcode:"8999999012", category:"snacks",     buyPrice:10000, sellPrice:13500, buyUnit:"Karton",   sellUnit:"Pcs",    conversionFactor:12, stock:48, minStock:8,  maxStock:150, active:true, createdAt:now, updatedAt:now },
  { id:"p13", name:"Ultra Milk Full Cream 1L", sku:"SKU013", barcode:"8999999013", category:"dairy",     buyPrice:14000, sellPrice:17500, buyUnit:"Karton",   sellUnit:"Kotak",  conversionFactor:12, stock:72, minStock:12, maxStock:200, active:true, createdAt:now, updatedAt:now },
  { id:"p14", name:"Susu Frisian Flag 400g",  sku:"SKU014", barcode:"8999999014", category:"dairy",      buyPrice:35000, sellPrice:42000, buyUnit:"Karton",   sellUnit:"Kaleng", conversionFactor:12, stock:24, minStock:4, maxStock:80, active:true, createdAt:now, updatedAt:now },
  { id:"p15", name:"Mie Sedaap Goreng",       sku:"SKU015", barcode:"8999999015", category:"staples",    buyPrice:2600,  sellPrice:3200,  wholesalePrice:2900, buyUnit:"Karton", sellUnit:"Pcs",   conversionFactor:40, stock:180, minStock:25, maxStock:500, active:true, createdAt:now, updatedAt:now },
  { id:"p16", name:"Kapal Api Spesial 25g",   sku:"SKU016", barcode:"8999999016", category:"beverages",  buyPrice:1200,  sellPrice:1800,  buyUnit:"Karton",   sellUnit:"Sachet", conversionFactor:50, stock:200, minStock:30, maxStock:600, active:true, createdAt:now, updatedAt:now },
  { id:"p17", name:"Kecap Bango 600ml",       sku:"SKU017", barcode:"8999999017", category:"spices",     buyPrice:17000, sellPrice:21000, buyUnit:"Karton",   sellUnit:"Botol",  conversionFactor:12, stock:36, minStock:6, maxStock:100, active:true, createdAt:now, updatedAt:now },
  { id:"p18", name:"Sarden ABC 425g",         sku:"SKU018", barcode:"8999999018", category:"staples",    buyPrice:12000, sellPrice:15500, buyUnit:"Karton",   sellUnit:"Kaleng", conversionFactor:24, stock:48, minStock:8, maxStock:150, active:true, createdAt:now, updatedAt:now },
  { id:"p19", name:"Nugget So Good 500g",     sku:"SKU019", barcode:"8999999019", category:"frozen",     buyPrice:26000, sellPrice:32000, buyUnit:"Karton",   sellUnit:"Pack",   conversionFactor:12, stock:5, minStock:4, maxStock:50, active:true, createdAt:now, updatedAt:now },
  { id:"p20", name:"Shampoo Pantene 170ml",   sku:"SKU020", barcode:"8999999020", category:"toiletries", buyPrice:15000, sellPrice:19500, buyUnit:"Karton",   sellUnit:"Botol",  conversionFactor:12, stock:36, minStock:6, maxStock:100, active:true, createdAt:now, updatedAt:now },
  { id:"p21", name:"Baygon Semprot 600ml",    sku:"SKU021", barcode:"8999999021", category:"household",  buyPrice:28000, sellPrice:35000, buyUnit:"Karton",   sellUnit:"Kaleng", conversionFactor:12, stock:24, minStock:4, maxStock:80, active:true, createdAt:now, updatedAt:now },
  { id:"p22", name:"Bawang Merah 1kg",        sku:"SKU022", barcode:"8999999022", category:"spices",     buyPrice:20000, sellPrice:25000, buyUnit:"Kg",       sellUnit:"Kg",     conversionFactor:1,  stock:10, minStock:3, maxStock:30, active:true, createdAt:now, updatedAt:now },
  { id:"p23", name:"Good Day Mocacinno 200ml", sku:"SKU023", barcode:"8999999023", category:"beverages", buyPrice:4000,  sellPrice:5500,  buyUnit:"Karton",   sellUnit:"Kaleng", conversionFactor:24, stock:96, minStock:15, maxStock:300, active:true, createdAt:now, updatedAt:now },
  { id:"p24", name:"Pepsodent Complete 190g", sku:"SKU024", barcode:"8999999024", category:"toiletries", buyPrice:15000, sellPrice:20000, buyUnit:"Karton",   sellUnit:"Tube",   conversionFactor:24, stock:48, minStock:8, maxStock:150, active:true, createdAt:now, updatedAt:now },
  { id:"p25", name:"Wipol 675ml",             sku:"SKU025", barcode:"8999999025", category:"household",  buyPrice:12000, sellPrice:16000, buyUnit:"Karton",   sellUnit:"Botol",  conversionFactor:12, stock:2, minStock:4, maxStock:60, active:true, createdAt:now, updatedAt:now },
];

export const seedCustomers: Customer[] = [
  { id:"c1", name:"Ibu Wati",  phone:"081234567890", email:"wati@email.com",   memberCard:"MM-0001", tier:"gold",   points:2500, totalSpent:5200000, debt:0,      memberSince:"2022-01-15", lastVisit:now, active:true },
  { id:"c2", name:"Pak Budi",  phone:"082345678901", email:"budi@email.com",   memberCard:"MM-0002", tier:"silver", points:800,  totalSpent:1800000, debt:0,      memberSince:"2023-03-20", lastVisit:now, active:true },
  { id:"c3", name:"Mbak Sari", phone:"083456789012", memberCard:"MM-0003", tier:"bronze", points:150, totalSpent:350000, debt:50000, memberSince:"2024-01-10", lastVisit:now, active:true },
  { id:"c4", name:"Mas Dika",  phone:"084567890123", memberCard:"MM-0004", tier:"bronze", points:320, totalSpent:680000, debt:0,     memberSince:"2023-08-05", lastVisit:now, active:true },
  { id:"c5", name:"Ibu Aminah", phone:"085678901234", email:"aminah@email.com", memberCard:"MM-0005", tier:"gold", points:4100, totalSpent:8900000, debt:100000, memberSince:"2021-11-20", lastVisit:now, active:true },
];

export const seedSuppliers: Supplier[] = [
  { id:"s1", name:"PT Indofood CBP",       contact:"Bpk. Hendra", phone:"021-111222", email:"hendra@indofood.com",    address:"Jakarta Pusat",   active:true, createdAt:now },
  { id:"s2", name:"Danone Indonesia",      contact:"Ibu. Siska",  phone:"021-333444", email:"siska@danone.com",       address:"Jakarta Selatan", active:true, createdAt:now },
  { id:"s3", name:"PT Unilever Indonesia", contact:"Bpk. Agus",   phone:"021-555666", email:"agus@unilever.com",      address:"Tangerang",       active:true, createdAt:now },
  { id:"s4", name:"UD Sumber Makmur",      contact:"Bpk. Joko",   phone:"0271-789012", email:"joko@sumbermakmur.com", address:"Solo",            active:true, createdAt:now },
];

export const seedPromos: Promo[] = [
  { id:"prm1", name:"Diskon Weekend 10%", type:"percent", discountValue:10,   discountType:"percent", minPurchase:50000, maxDiscount:20000, startDate:now, endDate:later(), active:true, usageCount:0, createdAt:now },
  { id:"prm2", name:"Hemat Rp 5.000",     type:"amount",  discountValue:5000, discountType:"amount",  minPurchase:75000, startDate:now, endDate:later(), active:true, usageCount:0, createdAt:now },
];

export const seedVouchers: Voucher[] = [
  { id:"v1", code:"HEMAT10", promoId:"prm1", discountValue:10,   discountType:"percent", minPurchase:50000, maxDiscount:20000, used:false, expiresAt:later(), createdAt:now },
  { id:"v2", code:"SAVE5K",  promoId:"prm2", discountValue:5000, discountType:"amount",  minPurchase:75000, used:false, expiresAt:later(), createdAt:now },
];

function later(): string {
  return new Date(Date.now() + 30 * 86400000).toISOString();
}

export function seedOrders(demoCashierId: string, demoCashierName: string): Order[] {
  return Array.from({ length: 10 }, (_, i) => {
    const d = new Date(Date.now() - i * 3600000);
    return {
      id: "ord-" + i,
      orderNumber: "INV-" + d.toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(i + 1).padStart(4, "0"),
      items: [
        { id:`oi-${i}a`, productId:"p1", productName:"Indomie Goreng", sku:"SKU001", qty:3, unit:"Pcs",    buyPrice:2800, sellPrice:3500, discount:0, subtotal:10500 },
        { id:`oi-${i}b`, productId:"p2", productName:"Aqua 600ml",     sku:"SKU002", qty:2, unit:"Botol",  buyPrice:2200, sellPrice:3000, discount:0, subtotal:6000 }
      ],
      subtotal:16500, discount:0, tax:1815, total:18315,
      paymentMethod:(["cash","qris","debit"] as const)[i % 3],
      amountPaid:20000, change:1685, status:"completed" as const,
      cashierId:demoCashierId, cashierName:demoCashierName,
      createdAt:d.toISOString()
    };
  });
}
