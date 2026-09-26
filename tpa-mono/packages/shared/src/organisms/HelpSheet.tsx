import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { TutorialItem } from '../data/help';

interface HelpSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tutorials: TutorialItem[];
}

export function HelpSheet({ isOpen, onClose, tutorials }: HelpSheetProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (!isOpen) return null;

  const selected = selectedIdx !== null ? tutorials[selectedIdx] : null;

  return (
    <div class="fixed inset-0 z-[100]">
      <div class="absolute inset-0 bg-black/40" onClick={() => { setSelectedIdx(null); onClose(); }} />
      <div class="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl animate-slide-up">
        <div class="w-8 h-1 bg-gray-300 rounded-full mx-auto mt-3 shrink-0" />

        {!selected ? (
          <>
            <div class="px-5 py-4 flex items-center justify-between border-b border-gray-100 shrink-0">
              <h3 class="text-lg font-bold">📚 Bantuan & Tutorial</h3>
              <button onClick={onClose} class="text-gray-400 text-xl">✕</button>
            </div>
            <div class="overflow-y-auto flex-1 pb-8">
              <div class="text-center py-4">
                <div class="text-4xl mb-2">📚</div>
                <p class="text-sm text-gray-500">Tap topik untuk panduan langkah demi langkah</p>
              </div>
              {tutorials.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedIdx(i)}
                  class="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 active:bg-gray-100 border-b border-gray-50"
                >
                  <div class="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-lg shrink-0">{t.icon}</div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm">{t.title}</div>
                    <div class="text-xs text-gray-400 truncate">{t.description}</div>
                  </div>
                  <span class="text-orange-500 font-bold">›</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div class="px-5 py-4 flex items-center justify-between border-b border-gray-100 shrink-0">
              <button onClick={() => setSelectedIdx(null)} class="text-sm text-orange-600 font-semibold">← Kembali</button>
              <button onClick={() => { setSelectedIdx(null); onClose(); }} class="text-gray-400 text-xl">✕</button>
            </div>
            <div class="overflow-y-auto flex-1 px-5 py-4 pb-8">
              <div class="bg-orange-50 rounded-2xl p-5 text-center mb-5">
                <div class="text-4xl mb-2">{selected.icon}</div>
                <div class="text-lg font-extrabold">{selected.title}</div>
                <p class="text-sm text-gray-500 mt-1">{selected.description}</p>
              </div>
              <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">📋 Langkah-langkah</div>
              <div class="bg-gray-50 rounded-xl p-3 space-y-0.5">
                {selected.steps.map((step, i) => (
                  <div key={i} class="flex gap-3 py-2.5 border-b border-gray-100 last:border-0">
                    <div class="w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0">{i + 1}</div>
                    <div class="text-sm text-gray-700">{step}</div>
                  </div>
                ))}
              </div>
              <div class="mt-5 text-center">
                <button onClick={() => { setSelectedIdx(null); onClose(); }} class="px-6 py-2.5 bg-orange-100 text-orange-600 rounded-full font-semibold text-sm">
                  Mengerti 👍
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
