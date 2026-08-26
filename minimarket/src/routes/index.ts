export const ROUTES = {
  dashboard:  "dashboard",
  pos:        "pos",
  products:   "products",
  stock:      "stock",
  suppliers:  "suppliers",
  customers:  "customers",
  finance:    "finance",
  promos:     "promos",
  reports:    "reports",
  staff:      "staff",
  settings:   "settings"
} as const;

export type Route = typeof ROUTES[keyof typeof ROUTES];
