import { useRef, useState } from 'react';
import { CheckCircle2, FileUp } from 'lucide-react';
import { ApiError, api } from '../lib/api';
import { useToast } from '../hooks/toast';
import type { PublicReservation } from '../lib/types';

const MAX_MB = 5;
const MAX_FILES = 3;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * Subida del comprobante desde el ticket. El archivo se guarda en un espacio privado:
 * solo el equipo de la tienda puede verlo desde el panel.
 */
export function ReceiptUpload({ r, phone, onUpdate }: { r: PublicReservation; phone: string; onUpdate: (r: PublicReservation) => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = r.receiptCount ?? 0;
  const full = count >= MAX_FILES;

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!OK_TYPES.includes(file.type)) return setError('Sube una foto (JPG, PNG o WEBP) o un PDF del comprobante.');
    if (file.size > MAX_MB * 1024 * 1024) return setError(`El archivo supera ${MAX_MB} MB. Toma una captura de pantalla del comprobante.`);
    const fd = new FormData();
    fd.append('code', r.code);
    fd.append('phone', phone);
    fd.append('receipt', file);
    setBusy(true);
    try {
      const res = await api.post<{ reservation: PublicReservation }>('/public/reservations/receipt', fd);
      onUpdate(res.reservation);
      toast.ok('Comprobante recibido. Lo verificaremos pronto.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo subir el comprobante. Intenta de nuevo.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="receipt-upload">
      {count > 0 && (
        <p className="receipt-upload__done">
          <CheckCircle2 aria-hidden /> {count === 1 ? 'Recibimos tu comprobante.' : `Recibimos ${count} comprobantes.`}
        </p>
      )}
      {!full && (
        <label className={`btn btn--primary btn--lg btn--block ${busy ? 'is-busy' : ''}`} aria-disabled={busy}>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            disabled={busy}
            onChange={(e) => upload(e.target.files?.[0])}
          />
          {busy ? <span className="spinner" aria-hidden /> : <FileUp aria-hidden />}
          {busy ? 'Subiendo…' : count > 0 ? 'Subir otro comprobante' : 'Subir comprobante de pago'}
        </label>
      )}
      {error && (
        <div className="alert alert--danger" role="alert">
          {error}
        </div>
      )}
      <p className="tiny muted">
        Foto o PDF de hasta {MAX_MB} MB. Solo el equipo de la tienda puede verlo y se elimina a los 12 meses.
      </p>
    </div>
  );
}
