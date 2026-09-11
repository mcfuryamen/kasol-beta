import { h } from 'preact';
import { Modal } from '../atoms/Modal';
import { Button } from '../atoms/Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Hapus',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button variant={variant} onClick={onConfirm} isLoading={isLoading}>{confirmLabel}</Button>
        </>
      }
    >
      <p class="text-gray-600">{message}</p>
    </Modal>
  );
}
