import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Card, Button } from '@shared/index';
import { useAuth } from '@shared/hooks/useAuth';
import { getSupabase } from '@shared/db/supabase';

export function StudentProgress() {
  const { user } = useAuth();

  return (
    <div class="space-y-6">
      <Card>
        <div class="text-center py-12 text-gray-400">
          <span class="text-4xl block mb-3">📈</span>
          <p class="text-lg font-medium">Progres Santri</p>
          <p class="text-sm mt-1">Lihat progres seluruh santri yang diampu</p>
        </div>
      </Card>
    </div>
  );
}
