import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Trash2 } from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import { useToast } from '../../hooks/toast';
import type { Image } from '../../lib/types';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';
const MAX_MB = 5;

/**
 * Subida, orden y borrado de imágenes. El backend valida de nuevo el formato real,
 * el tamaño y las dimensiones; aquí solo se filtra para dar respuesta rápida.
 */
export function ImageManager<T>({
  images,
  basePath,
  onChange,
}: {
  images: Image[];
  basePath: string; // p. ej. /admin/consoles/:id
  onChange: (entity: T) => void;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    const bad = list.find((f) => !ACCEPT.split(',').includes(f.type) || f.size > MAX_MB * 1024 * 1024);
    if (bad) {
      toast.error(`"${bad.name}" no es válido. Usa JPG, PNG, WEBP o AVIF de hasta ${MAX_MB} MB.`);
      return;
    }
    if (!list.length) return;
    const fd = new FormData();
    list.slice(0, 8).forEach((f) => fd.append('images', f));
    setBusy(true);
    try {
      const r = await api.post<Record<string, T>>(`${basePath}/images`, fd);
      onChange(Object.values(r)[0]);
      toast.ok(list.length > 1 ? 'Imágenes subidas' : 'Imagen subida');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo subir la imagen.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar esta imagen?')) return;
    try {
      const r = await api.del<Record<string, T>>(`${basePath}/images/${id}`);
      onChange(Object.values(r)[0]);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar.');
    }
  }

  async function move(idx: number, dir: -1 | 1) {
    const ids = images.map((i) => i.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    try {
      const r = await api.put<Record<string, T>>(`${basePath}/images/order`, { imageIds: ids });
      onChange(Object.values(r)[0]);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo reordenar.');
    }
  }

  return (
    <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
      <div className="img-grid">
        {images.map((im, i) => (
          <div key={im.id} className="img-tile">
            <img src={im.url} alt={im.alt ?? ''} loading="lazy" />
            {i === 0 && <span className="badge badge--plain img-tile__badge" style={{ background: 'var(--surface)' }}>Portada</span>}
            <div className="img-tile__actions">
              <span className="row" style={{ '--gap': '4px' } as React.CSSProperties}>
                <button type="button" className="btn btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mover antes">
                  <ChevronLeft />
                </button>
                <button type="button" className="btn btn--sm" onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label="Mover después">
                  <ChevronRight />
                </button>
              </span>
              <button type="button" className="btn btn--sm btn--danger" onClick={() => remove(im.id)} aria-label="Eliminar imagen">
                <Trash2 />
              </button>
            </div>
          </div>
        ))}
        <label
          className={`dropzone ${over ? 'is-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void upload(e.dataTransfer.files);
          }}
        >
          <input ref={input} type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => e.target.files && upload(e.target.files)} disabled={busy} />
          <span>
            {busy ? <span className="spinner" style={{ margin: '0 auto' }} /> : <ImagePlus aria-hidden />}
            <span>{busy ? 'Subiendo…' : 'Agregar fotos'}</span>
          </span>
        </label>
      </div>
      <p className="tiny muted">JPG, PNG, WEBP o AVIF · máx. {MAX_MB} MB · mín. 200×200 px. Se optimizan y se les quitan los metadatos.</p>
    </div>
  );
}
