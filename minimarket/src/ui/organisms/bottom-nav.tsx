import { currentPage, mobileNavOpen, activeShift } from "@/logic/state/app-state";
import { currentUser } from "@/logic/state/app-state";
import { Icons } from "@/ui/atoms/icon";
import { visibleNavItems, navItems, type NavItem } from "./sidebar";

/** 4 tujuan utama + tombol "Menu" (sheet semua halaman) — pola khas aplikasi native. */
const PRIMARY = ["dashboard", "pos", "products", "reports"];

function BottomNavButton({ item, active, onClick, badge }: {
  item: NavItem; active: boolean; onClick: () => void; badge?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      class={`touch-target relative flex-1 flex flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 transition-colors ${active
        ? "text-primary-500"
        : "text-gray-400 dark:text-gray-500 active:text-gray-600 dark:active:text-gray-300"}`}
    >
      <span class="relative">
        <Icon size={22} />
        {badge && (
          <span class="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900" />
        )}
      </span>
      <span class="text-[10px] font-semibold leading-none">{item.label}</span>
      {active && (
        <span class="absolute top-0 h-0.5 w-8 rounded-full bg-primary-500" />
      )}
    </button>
  );
}

export function BottomNav() {
  const user = currentUser.value;
  const shift = activeShift.value;
  const items = visibleNavItems(user?.role);
  const primaryItems = PRIMARY
    .map(id => items.find(i => i.id === id))
    .filter((i): i is NavItem => !!i);
  const current = currentPage.value;

  const openMoreSheet = () => { mobileNavOpen.value = true; };
  void navItems;

  // Halaman Kasir tampil layar penuh ala register kasir native (tanpa bottom bar)
  if (current === "pos") return null;

  return (
    <>
      {/* Sheet "Semua Menu" — memanfaatkan drawer yang sudah ada */}
      <nav class="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 pb-safe">
        <div class="flex h-[3.25rem] items-stretch">
          {primaryItems.map(item => (
            <BottomNavButton
              key={item.id}
              item={item}
              active={current === item.id}
              onClick={() => { currentPage.value = item.id; }}
              badge={item.id === "pos" && !shift}
            />
          ))}
          <BottomNavButton
            item={{ id: "__more", label: "Menu", icon: Icons.Menu }}
            active={!PRIMARY.includes(current) && current !== "pos"}
            onClick={openMoreSheet}
          />
        </div>
      </nav>
    </>
  );
}
