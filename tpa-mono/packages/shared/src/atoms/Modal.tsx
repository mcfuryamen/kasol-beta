import { h, ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ComponentChildren;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ComponentChildren;
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/50" onClick={onClose} />
      <div class={`relative bg-white rounded-xl shadow-xl w-full mx-4 ${sizeClasses[size]} max-h-[90vh] flex flex-col`}>
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 class="text-lg font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div class="px-6 py-4 overflow-y-auto flex-1">
          {children}
        </div>
        {footer && (
          <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
