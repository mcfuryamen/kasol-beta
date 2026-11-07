export const en = {
  app: { name: "Kasir Solo - Minimarket", tagline: "POS Solution for Modern Minimarket" },
  nav: {
    dashboard: "Dashboard", pos: "POS", products: "Products", stock: "Stock",
    suppliers: "Suppliers", customers: "Customers", finance: "Finance",
    promos: "Promos", reports: "Reports", staff: "Staff", settings: "Settings", logout: "Logout"
  },
  auth: {
    login: "Login", logout: "Logout", email: "Email", password: "Password",
    loginBtn: "Sign In", loginAsDemo: "Login as Demo", demoMode: "Demo Mode",
    selectDemoUser: "Select demo user", loginError: "Invalid email or password",
    forgotPassword: "Forgot Password?", welcomeBack: "Welcome Back"
  },
  dashboard: {
    title: "Dashboard", todaySales: "Today's Sales", totalOrders: "Total Orders",
    avgOrder: "Avg. Transaction", activeMembers: "Active Members",
    recentTransactions: "Recent Transactions", topProducts: "Top Products",
    lowStock: "Low Stock", revenue: "Revenue", profit: "Profit",
    weeklyChart: "Weekly Chart", stockAlert: "Stock Alert", newMembers: "New Members",
    kasStatus: "Cash Status", kasAktif: "Cash Active", kasTutup: "Cash Closed"
  },
  pos: {
    title: "POS", searchProduct: "Search product (name/barcode/SKU)...",
    barcodeInput: "Scan barcode...", cart: "Shopping Cart", total: "Total", subtotal: "Subtotal",
    discount: "Discount", tax: "VAT 11%", grandTotal: "Grand Total", pay: "Pay", clear: "Clear All",
    hold: "Hold", recall: "Recall", qty: "Qty", price: "Price",
    paymentMethod: "Payment Method", cash: "Cash", qris: "QRIS", debit: "Debit",
    credit: "Credit", ewallet: "E-Wallet", tempo: "Credit Account",
    amountPaid: "Amount Paid", change: "Change", processPayment: "Process Payment",
    selectCustomer: "Select Customer", memberPrice: "Member Price",
    itemDiscount: "Item Discount", orderDiscount: "Order Discount",
    receipt: "Receipt", printReceipt: "Print Receipt", newTransaction: "New Transaction",
    noItems: "Cart is empty", stock: "Stock", heldOrders: "Held Orders",
    category: "Category", allCategory: "All", scannerReady: "Scanner Ready",
    lastScanned: "Last scanned", scanCount: "Scan count",
    numpadQty: "QTY MODE", numpadDisc: "DISCOUNT MODE", numpadCash: "CASH MODE",
    numpadPrice: "PRICE MODE", payBtn: "PAY [F4]",
    holdBtn: "Hold [F2]", clearBtn: "Clear [F5]",
    kasRequired: "Open Cash Register First",
    kasRequiredMsg: "You must open the cash register before using the POS."
  },
  kas: {
    openKas: "Open Cash Register", closeKas: "Close Cash Register",
    kasAktif: "Cash Active", kasTutup: "Cash Closed",
    modalAwal: "Opening Cash", modalAkhir: "Actual Cash",
    ekspektasiKas: "Expected Cash", selisih: "Difference", surplus: "Surplus",
    deficit: "Deficit", notes: "Notes", openedAt: "Opened", closedAt: "Closed",
    denomination: "Count Denomination", totalDenomination: "Total Denomination"
  },
  cashflow: {
    title: "Cash In/Out", cashIn: "Cash In", cashOut: "Cash Out",
    addCashIn: "Add Cash In", addCashOut: "Add Cash Out",
    setoranTambahan: "Additional Deposit", pengembalian: "Return",
    belanjaOperasional: "Operational", setorBank: "Bank Transfer",
    gaji: "Salary", listrikAir: "Electricity/Water", kebersihan: "Cleaning",
    lainnya: "Other", runningBalance: "Running Balance", amount: "Amount",
    category: "Category", description: "Description", history: "History"
  },
  product: {
    title: "Products", add: "Add Product", edit: "Edit Product", delete: "Delete Product",
    name: "Product Name", sku: "SKU", barcode: "Barcode", category: "Category",
    buyPrice: "Buy Price", sellPrice: "Sell Price", wholesalePrice: "Wholesale Price",
    buyUnit: "Buy Unit", sellUnit: "Sell Unit", conversion: "Conversion",
    stock: "Stock", minStock: "Min Stock", maxStock: "Max Stock",
    photo: "Photo", searchPlaceholder: "Search products...",
    gridView: "Grid", listView: "List", allCategories: "All Categories",
    confirmDelete: "Delete this product?", noProducts: "No products found",
    active: "Active", inactive: "Inactive"
  },
  stock: {
    title: "Stock & Inventory", stockIn: "Stock In", stockOut: "Stock Out",
    stockOpname: "Stock Opname", history: "Movement History", expiry: "Expiry",
    batch: "Batch", lowStock: "Low Stock", overStock: "Overstock",
    quantity: "Quantity", reason: "Reason", date: "Date", notes: "Notes",
    physical: "Physical Stock", system: "System Stock", variance: "Variance"
  },
  supplier: {
    title: "Suppliers", add: "Add Supplier", edit: "Edit Supplier",
    name: "Supplier Name", contact: "Contact", phone: "Phone", email: "Email",
    address: "Address", purchaseOrder: "Purchase Order", createPO: "Create PO",
    poNumber: "PO Number", status: "Status", items: "Items", totalAmount: "Total",
    draft: "Draft", approved: "Approved", ordered: "Ordered", received: "Received",
    approve: "Approve", order: "Order", receive: "Receive", confirmDelete: "Delete supplier?"
  },
  customer: {
    title: "Customers & Members", add: "Add Customer", edit: "Edit",
    name: "Name", phone: "Phone", email: "Email", address: "Address",
    memberCard: "Member Card", tier: "Tier", points: "Points", totalSpent: "Total Spent",
    debt: "Debt", bronze: "Bronze", silver: "Silver", gold: "Gold",
    memberSince: "Member since", lastVisit: "Last Visit", noCustomers: "No customers"
  },
  finance: {
    title: "Finance & Cash", openShift: "Open Shift", closeShift: "Close Shift",
    cashDrawer: "Cash Drawer", openingBalance: "Opening Balance", closingBalance: "Closing Balance",
    pettyCash: "Petty Cash", addExpense: "Add Expense", cashFlow: "Cash Flow",
    shift: "Shift", shiftStart: "Shift Start", shiftEnd: "Shift End",
    operator: "Operator", expectedCash: "Expected", actualCash: "Actual",
    difference: "Difference", description: "Description", amount: "Amount",
    noActiveShift: "No active shift", tabKasAktif: "Active Cash",
    tabCashFlow: "Cash In/Out", tabRiwayat: "Shift History", tabVoid: "Void & Returns"
  },
  promo: {
    title: "Discounts & Promos", add: "Add Promo", edit: "Edit Promo",
    name: "Promo Name", type: "Type", discountPercent: "Discount %",
    discountAmount: "Discount Amount", startDate: "Start Date", endDate: "End Date",
    active: "Active", inactive: "Inactive", voucher: "Voucher", code: "Code",
    minPurchase: "Min Purchase", maxDiscount: "Max Discount", used: "Used"
  },
  report: {
    title: "Reports", sales: "Sales Report", profit: "P&L",
    stock: "Stock Report", customer: "Customer Report", daily: "Daily",
    weekly: "Weekly", monthly: "Monthly", export: "Export", period: "Period",
    revenue: "Revenue", cogs: "COGS", grossProfit: "Gross Profit",
    netProfit: "Net Profit", topProducts: "Top Products",
    byPayment: "By Payment Method", stockValue: "Stock Value"
  },
  staff: {
    title: "Staff Management", add: "Add Staff", edit: "Edit Staff",
    name: "Name", email: "Email", role: "Role", active: "Active",
    owner: "Owner", manager: "Manager", kasir: "Cashier", gudang: "Warehouse"
  },
  settings: {
    title: "Settings", storeName: "Store Name", address: "Address", phone: "Phone",
    taxRate: "Tax Rate", receiptFooter: "Receipt Footer", currency: "Currency",
    language: "Language", darkMode: "Dark Mode", save: "Save",
    printer: "Printer", printerType: "Printer Type", paperSize: "Paper Size",
    connectionType: "Connection", autoPrint: "Auto Print", copies: "Copies",
    testPrint: "Test Print", printerEnabled: "Printer Enabled",
    headerText: "Receipt Header", footerText: "Receipt Footer", printBarcode: "Print Barcode"
  },
  shortcuts: {
    title: "Keyboard Shortcuts", f1: "Focus Barcode/Search", f2: "Hold Order",
    f3: "Show Held Orders", f4: "Pay / Process", f5: "Clear Cart",
    f6: "Toggle Numpad Mode", f7: "Select Customer", f8: "Open Cash Drawer",
    f9: "Print Last Receipt", f10: "Void Last Item", f12: "Fullscreen",
    esc: "Close Modal", enter: "Confirm", plus: "Increase Qty", minus: "Decrease Qty",
    delete: "Remove Item", question: "Show/Hide Help"
  },
  common: {
    save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit", add: "Add",
    search: "Search", filter: "Filter", export: "Export", import: "Import",
    yes: "Yes", no: "No", ok: "OK", close: "Close", back: "Back",
    loading: "Loading...", error: "Error", success: "Success", warning: "Warning",
    noData: "No data", all: "All", active: "Active", inactive: "Inactive"
  }
};
