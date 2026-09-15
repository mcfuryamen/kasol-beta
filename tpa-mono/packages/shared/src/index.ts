// ============================================================
// KASIR SOLO - TPA | Shared Package
// ============================================================

// Types
export * from './types/index';

// Database
export { getSupabase, signIn, signOut, getCurrentUser, onAuthStateChange } from './db/supabase';
export { syncEngine, SyncEngine } from './db/sync';
export * from './db/rxdb-schema';

// Hooks
export { useAuth } from './hooks/useAuth';
export { useOffline } from './hooks/useOffline';
export { useSync } from './hooks/useSync';
export { useNotifications } from './hooks/useNotification';

// Utils
export * from './utils/format';
export * from './utils/date';
export * from './utils/validation';
export * from './utils/print';
export { t, setLocale, getLocale } from './utils/i18n';

// UI - Atoms
export { Button } from './atoms/Button';
export { Input } from './atoms/Input';
export { Badge } from './atoms/Badge';
export { Avatar } from './atoms/Avatar';
export { Card } from './atoms/Card';
export { Modal } from './atoms/Modal';
export { Select } from './atoms/Select';
export { Table } from './atoms/Table';
export { Spinner, FullPageSpinner } from './atoms/Spinner';
export { Textarea } from './atoms/Textarea';
export { showToast, ToastContainer } from './atoms/Toast';
export type { Column } from './atoms/Table';

// UI - Molecules
export { FormField } from './molecules/FormField';
export { SearchBar } from './molecules/SearchBar';
export { StatCard } from './molecules/StatCard';
export { DataTable } from './molecules/DataTable';
export { ConfirmDialog } from './molecules/ConfirmDialog';
export { NotificationBell } from './molecules/NotificationBell';
export { Pagination } from './molecules/Pagination';

// UI - Organisms
export { Sidebar } from './organisms/Sidebar';
export { Header } from './organisms/Header';
export { LoginForm } from './organisms/LoginForm';
export { Layout } from './organisms/Layout';

// Data
export { SEED_CURRICULUM, SEED_SPP_TYPES } from './data/seed';
export { ADMIN_TUTORIALS, GURU_TUTORIALS, WALI_TUTORIALS } from './data/help';
export type { TutorialItem } from './data/help';

// Help Sheet
export { HelpSheet } from './organisms/HelpSheet';
