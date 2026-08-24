import { h, ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

export interface NavItem {
  icon: string;
  label: string;
  href: string;
  badge?: number;
}

export interface SidebarProps {
  items: NavItem[];
  activeHref: string;
  onNavigate: (href: string) => void;
  appName?: string;
  userContent?: ComponentChildren;
}

export function Sidebar({ items, activeHref, onNavigate, appName = 'Kasir Solo - TPA', userContent }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside class={`bg-white border-r border-gray-200 h-screen flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Header */}
      <div class="px-4 py-5 border-b border-gray-100 flex items-center gap-3">
        <div class="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">
          📖
        </div>
        {!collapsed && (
          <div class="overflow-hidden">
            <h1 class="text-sm font-bold text-gray-800 truncate">{appName}</h1>
            <p class="text-xs text-gray-400">PT Mesin Kasir Solo</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          class="ml-auto text-gray-400 hover:text-gray-600 shrink-0"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Navigation */}
      <nav class="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {items.map(item => {
          const isActive = activeHref === item.href;
          return (
            <button
              key={item.href}
              onClick={() => onNavigate(item.href)}
              class={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                ${isActive
                  ? 'bg-orange-50 text-orange-600 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
              title={collapsed ? item.label : undefined}
            >
              <span class="text-lg shrink-0">{item.icon}</span>
              {!collapsed && (
                <>
                  <span class="flex-1 text-left truncate">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span class="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* User section */}
      {userContent && !collapsed && (
        <div class="px-4 py-3 border-t border-gray-100">
          {userContent}
        </div>
      )}
    </aside>
  );
}
