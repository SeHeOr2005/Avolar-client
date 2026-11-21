import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { PublicSettings } from '../lib/types';

/** Datos públicos de la tienda (WhatsApp, horarios, redes…). Vienen siempre de la BD. */
export function useSettings() {
  return useQuery({
    queryKey: ['public-settings'],
    queryFn: () => api.get<{ settings: PublicSettings }>('/public/settings').then((r) => r.settings),
    staleTime: 60_000,
  });
}

export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · A volar` : 'A volar';
  }, [title]);
}
