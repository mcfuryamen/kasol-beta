import { supabase, isDemoMode } from "@/data/supabase";
import {
  activeOutletId, activeShift, businessId, combinedView, currentUser, operatingMode,
  outlets, storeSettings, type Outlet,
} from "@/logic/state/app-state";
import { kvGet, kvSet } from "@/data/db/local-db";
import { generateId } from "@/logic/utils/format";

const OUTLETS_KEY = "outlets";
const ACTIVE_OUTLET_KEY = "active_outlet_id";
const MODE_KEY = "operating_mode";

/** Nilai khusus picker: gabungan semua outlet (multi mode, owner/manager). */
export const ALL_OUTLETS = "all";

/** True bila operasi tulis/withdrawal boleh berjalan (ada outlet konkret). */
export function hasConcreteOutlet(): boolean {
  if (isDemoMode) return true;
  if (combinedView.value) return false;
  return isCloudOutletId(activeOutletId.value);
}

type Result = { ok: boolean; error?: string };

/**
 * Listener perpindahan outlet (Tahap 4) — hydrate.ts mendaftarkan reset state
 * + re-hydrate + pull di sini. Dipanggil HANYA saat outlet aktif benar-benar
 * berubah; force-select boot dengan id sama tidak memicu listener.
 */
const outletSwitchListeners: Array<(outletId: string) => void | Promise<void>> = [];
export function onOutletSwitched(listener: (outletId: string) => void | Promise<void>): void {
  outletSwitchListeners.push(listener);
}

/** Cloud outlets are UUID-backed rows. Local/demo compatibility IDs must not
 * be used to scope Supabase queries or outbound mutations. */
export function isCloudOutletId(id: string | null | undefined): boolean {
  return !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function fromRow(row: any): Outlet {
  return {
    id: row.id,
    businessId: row.business_id || "local-business",
    code: row.code || "",
    name: row.name,
    address: row.address || "",
    phone: row.phone || "",
    taxRate: Number(row.tax_rate ?? 0),
    receiptFooter: row.receipt_footer || "",
    isActive: row.is_active !== false,
    isDefault: row.is_default === true,
    archivedAt: row.archived_at || null,
  };
}

function legacyOutlet(): Outlet {
  return {
    id: "local-default-outlet",
    businessId: "local-business",
    code: "UTM",
    name: storeSettings.value.name,
    address: storeSettings.value.address,
    phone: storeSettings.value.phone,
    taxRate: storeSettings.value.taxRate,
    receiptFooter: storeSettings.value.receiptFooter,
    isActive: true,
    isDefault: true,
    archivedAt: null,
  };
}

function applyOutletSettings(outlet: Outlet) {
  storeSettings.value = {
    ...storeSettings.value,
    name: outlet.name,
    address: outlet.address,
    phone: outlet.phone,
    taxRate: outlet.taxRate,
    receiptFooter: outlet.receiptFooter,
  };
}

export const outletService = {
  /** Outlet boleh dipakai operasional: aktif dan tidak diarsipkan. */
  isOperational(outlet: Outlet): boolean {
    return outlet.isActive && !outlet.archivedAt;
  },

  operational(): Outlet[] {
    return outlets.value.filter(o => this.isOperational(o));
  },

  async load(): Promise<Outlet[]> {
    let rows: Outlet[] = [];
    if (!isDemoMode) {
      const [{ data: oRows, error }, { data: bRows }] = await Promise.all([
        supabase.from("outlets").select("*").order("created_at"),
        supabase.from("businesses").select("id, operating_mode").limit(1),
      ]);
      if (!error) rows = (oRows || []).map(fromRow);
      if (bRows?.length) {
        businessId.value = bRows[0].id;
        operatingMode.value = bRows[0].operating_mode === "multi" ? "multi" : "single";
      }
    }
    if (!rows.length) {
      const cached = await kvGet<Outlet[]>(OUTLETS_KEY);
      // Never fall back to the legacy/local outlet while online: its sentinel
      // id cannot satisfy Supabase outlet RLS and would scope pulls incorrectly.
      rows = isDemoMode
        ? (cached || [legacyOutlet()])
        : (cached || []).filter(o => isCloudOutletId(o.id));
    }
    outlets.value = rows;
    await kvSet(OUTLETS_KEY, rows);

    const savedMode = await kvGet<"single" | "multi">(MODE_KEY);
    if (savedMode && isDemoMode) operatingMode.value = savedMode;

    const saved = await kvGet<string>(ACTIVE_OUTLET_KEY);
    // Mode gabungan ("all") hanya sah di multi mode untuk owner/manager.
    if (
      saved === ALL_OUTLETS &&
      operatingMode.value === "multi" &&
      ["owner", "manager"].includes(currentUser.value?.role || "") &&
      this.operational().length >= 2
    ) {
      combinedView.value = true;
      activeOutletId.value = null;
      return rows;
    }
    combinedView.value = false;
    const current = rows.find(o => o.id === (activeOutletId.value ?? saved));
    // Boot memulihkan context terakhir tanpa guard shift — shift milik outlet itu sendiri.
    const selected =
      (current && this.isOperational(current) && (isDemoMode || isCloudOutletId(current.id)) ? current : undefined) ||
      rows.find(o => this.isOperational(o) && o.isDefault && (isDemoMode || isCloudOutletId(o.id))) ||
      rows.find(o => this.isOperational(o) && (isDemoMode || isCloudOutletId(o.id))) ||
      (isDemoMode ? rows[0] : undefined);
    if (selected) this.select(selected.id, { force: true });
    else activeOutletId.value = null;
    return rows;
  },

  /**
   * Pindah outlet — atau pilih mode gabungan dengan id "all".
   * Kasir/stok dengan shift aktif dicegah pindah (aturan MVP-1); owner/manager
   * bebas. Panggilan dari boot memakai force.
   */
  select(id: string, opts?: { force?: boolean }): Result {
    const user = currentUser.value;
    const previous = activeOutletId.value;
    const wasCombined = combinedView.value;

    // ---- Mode gabungan: semua outlet dalam satu tampilan (baca-saja orientasi).
    if (id === ALL_OUTLETS) {
      if (operatingMode.value !== "multi") {
        return { ok: false, error: "Mode gabungan tersedia pada Multi Outlet" };
      }
      if (user && !["owner", "manager"].includes(user.role)) {
        return { ok: false, error: "Mode gabungan hanya untuk owner/manager" };
      }
      if (this.operational().length < 2) {
        return { ok: false, error: "Minimal dua outlet aktif untuk mode gabungan" };
      }
      if (
        !opts?.force &&
        activeShift.value?.status === "open" &&
        user &&
        !["owner", "manager"].includes(user.role)
      ) {
        return { ok: false, error: "Tutup shift kas dulu sebelum pindah outlet" };
      }
      combinedView.value = true;
      activeOutletId.value = null;
      void kvSet(ACTIVE_OUTLET_KEY, ALL_OUTLETS);
      if (previous !== null || !wasCombined) {
        for (const listener of outletSwitchListeners) void listener(ALL_OUTLETS);
      }
      return { ok: true };
    }

    const outlet = outlets.value.find(o => o.id === id);
    if (!outlet || !this.isOperational(outlet)) {
      return { ok: false, error: "Outlet tidak tersedia" };
    }
    if (
      !opts?.force &&
      activeShift.value?.status === "open" &&
      user &&
      !["owner", "manager"].includes(user.role)
    ) {
      return { ok: false, error: "Tutup shift kas dulu sebelum pindah outlet" };
    }
    combinedView.value = false;
    activeOutletId.value = id;
    applyOutletSettings(outlet);
    void kvSet(ACTIVE_OUTLET_KEY, id);
    // Beri tahu subscriber hanya saat outlet benar-benar berganti.
    if (previous !== id || wasCombined) {
      for (const listener of outletSwitchListeners) {
        void listener(id);
      }
    }
    return { ok: true };
  },

  async save(outlet: Outlet): Promise<Result> {
    if (!outlet.name?.trim()) return { ok: false, error: "Nama outlet wajib diisi" };
    const code = (outlet.code || "").trim().toUpperCase();
    if (!code) return { ok: false, error: "Kode outlet wajib diisi (mis. UTM)" };
    if (outlets.value.some(o => o.code.toUpperCase() === code && o.id !== outlet.id)) {
      return { ok: false, error: `Kode outlet ${code} sudah dipakai outlet lain` };
    }
    if (!outlet.id) outlet.id = generateId();
    if (!outlet.businessId || outlet.businessId === "local-business") {
      outlet.businessId = businessId.value || outlet.businessId;
    }

    if (!isDemoMode) {
      const { error } = await supabase.from("outlets").upsert({
        id: outlet.id,
        business_id: outlet.businessId,
        code,
        name: outlet.name.trim(),
        address: outlet.address,
        phone: outlet.phone,
        tax_rate: outlet.taxRate,
        receipt_footer: outlet.receiptFooter,
        is_active: outlet.isActive,
        is_default: outlet.isDefault,
        ...(outlet.archivedAt ? { archived_at: outlet.archivedAt } : {}),
      });
      if (error) return { ok: false, error: error.message };
    }

    const next = outlets.value.some(o => o.id === outlet.id)
      ? outlets.value.map(o => (o.id === outlet.id ? outlet : o))
      : [...outlets.value, outlet];
    outlets.value = next;
    await kvSet(OUTLETS_KEY, next);
    this.select(outlet.id, { force: true });
    return { ok: true };
  },

  /** Ganti mode operasional — owner saja. Single memaksa kembali ke outlet default. */
  async setOperatingMode(mode: "single" | "multi"): Promise<Result> {
    if (currentUser.value?.role !== "owner") {
      return { ok: false, error: "Hanya owner yang bisa mengubah mode operasional" };
    }
    if (!isDemoMode) {
      if (!businessId.value || !isCloudOutletId(businessId.value)) return { ok: false, error: "Business belum tervalidasi" };
      const { data, error } = await supabase
        .from("businesses")
        .update({ operating_mode: mode })
        .eq("id", businessId.value)
        .select("operating_mode");
      if (error) return { ok: false, error: error.message };
      if (!data?.length || data[0]?.operating_mode !== mode) return { ok: false, error: "Mode operasional tidak terkonfirmasi server" };
    }
    operatingMode.value = mode;
    await kvSet(MODE_KEY, mode);
    if (mode === "single") {
      const def = outlets.value.find(o => o.isDefault && this.isOperational(o))
        || this.operational()[0];
      if (def) this.select(def.id, { force: true });
    }
    return { ok: true };
  },

  /** Arsipkan outlet (multi → single). Tidak pernah menghapus data histori. */
  async setArchived(id: string, archived: boolean): Promise<Result> {
    const outlet = outlets.value.find(o => o.id === id);
    if (!outlet) return { ok: false, error: "Outlet tidak ditemukan" };
    if (archived && outlet.isDefault) {
      return { ok: false, error: "Outlet default tidak bisa diarsipkan" };
    }
    if (archived && this.operational().length <= 1) {
      return { ok: false, error: "Minimal satu outlet harus tetap aktif" };
    }
    const archivedAt = archived ? new Date().toISOString() : null;

    if (!isDemoMode) {
      const { error } = await supabase
        .from("outlets")
        .update({ archived_at: archivedAt, is_active: !archived })
        .eq("id", id);
      if (error) return { ok: false, error: error.message };
    }

    outlets.value = outlets.value.map(o =>
      o.id === id ? { ...o, archivedAt, isActive: !archived } : o
    );
    await kvSet(OUTLETS_KEY, outlets.value);
    if (archived && activeOutletId.value === id) {
      const def = outlets.value.find(o => o.isDefault && this.isOperational(o))
        || this.operational()[0];
      if (def) this.select(def.id, { force: true });
    }
    return { ok: true };
  },
};
