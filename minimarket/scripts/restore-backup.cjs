/**
 * Restore cadangan MVP-0 (logical JSON export) ke Supabase.
 *
 * Pemakaian:
 *   node scripts/restore-backup.cjs backups/mvp0-backup-2026-10-05.json
 *
 * - Baca service-role key dari .env.local (tidak pernah di-commit).
 * - Restore = upsert per tabel sesuai urutan dependensi FK; row dihitung & dilaporkan.
 * - Tidak menghapus baris yang tidak ada di dump (aditif) — untuk restore bersih,
 *   kosongkan tabel manual dulu dengan persetujuan pemilik.
 */
const fs = require("fs");

const REF = "hhywrvedlwljawgxzpkq";
const file = process.argv[2];
if (!file) { console.error("Pemakaian: node scripts/restore-backup.cjs <file-backup.json>"); process.exit(1); }

const SRK = fs.readFileSync("C:/Users/Admin/Documents/kasol/.env.local", "utf8")
  .split(/\r?\n/).find(l => l.startsWith("SUPABASE_SERVICE_ROLE_KEY=")).split("=").slice(1).join("=").trim();

// Urutan upsert mengikuti ketergantungan FK induk → anak.
const ORDER = [
  "profiles", "businesses", "outlets", "outlet_memberships", "categories",
  "pos_products", "suppliers", "customers", "shifts", "orders", "order_items",
  "cash_flows", "petty_cash", "void_records", "stock_mutations",
  "purchase_orders", "promos", "vouchers", "loyalty_transactions",
  "store_settings", "settings", "site_content", "clients",
  "outreach_contacts", "wa_prospects", "wa_broadcast_log",
  "agent_tasks", "agent_outputs", "social_posts", "sync_errors",
];

(async () => {
  const bucket = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log("Restore dari:", file, "| dumped_at:", bucket.meta.dumped_at);
  let restored = 0;
  for (const t of ORDER) {
    const rows = bucket.data[t] || [];
    if (rows.length === 0) { console.log(`  ${t}: 0 row (skip)`); continue; }
    for (let i = 0; i < rows.length; i += 500) {
      const res = await fetch(`https://${REF}.supabase.co/rest/v1/${t}?on_conflict=id`, {
        method: "POST",
        headers: {
          apikey: SRK, Authorization: `Bearer ${SRK}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(rows.slice(i, i + 500)),
      });
      if (!res.ok) {
        // Tabel komposit pakai on_conflict berbeda — coba tanpa on_conflict.
        const res2 = await fetch(`https://${REF}.supabase.co/rest/v1/${t}`, {
          method: "POST",
          headers: {
            apikey: SRK, Authorization: `Bearer ${SRK}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify(rows.slice(i, i + 500)),
        });
        if (!res2.ok) {
          console.error(`  ${t}: GAGAL ${res.status}/${res2.status} — ${await res2.text()}`);
          process.exit(1);
        }
      }
    }
    restored += rows.length;
    console.log(`  ${t}: ${rows.length} row upserted`);
  }
  console.log(`SELESAI — total ${restored} baris dipulihkan dari ${bucket.meta.tables.length} tabel.`);
})();
