import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';

const API_BASE = 'https://cubica-photo-app.onrender.com';
const BG_URL = "https://blog.generaclatam.com/hubfs/shutterstock_93376264.jpg";

/*Modal de confirmación (glass)*/
const ConfirmModal = ({
  open,
  title = 'Confirmar',
  message,
  confirmText = 'Eliminar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  loading = false
}) => {
  if (!open) return null;
  return createPortal(
    <div className="modal-overlay" onClick={onCancel} role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title" className="modal-title">{title}</h3>
        <p className="modal-msg">{message}</p>
        <div className="modal-actions">
          <button className="btn-outline" type="button" onClick={onCancel} disabled={loading}>
            {cancelText}
          </button>
          <button className="btn-danger" type="button" onClick={onConfirm} disabled={loading}>
            {loading ? 'Eliminando…' : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const InformesPage = () => {
  const navigate = useNavigate();

  const [informes, setInformes] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const nombreTecnico = localStorage.getItem('nombreTecnico') || 'Técnico';

  const fetchInformes = async () => {
    setLoading(true);
    setMensaje('');
    try {
      const res = await axios.get(`${API_BASE}/informes`, {
        params: { page, limit, search }
      });
      setInformes(res.data.data || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error('Error cargando informes:', err);
      setMensaje('Error al cargar los informes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInformes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, search]);

  const handleCerrarSesion = () => {
    localStorage.removeItem('sesionId');
    localStorage.removeItem('nombreTecnico');
    navigate('/');
  };

  const handleVer = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const formatFecha = (isoString) => {
    try {
      return new Date(isoString).toLocaleString('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Bogota'
      });
    } catch {
      return '-';
    }
  };

  const askDelete = (inf) => {
    setToDelete(inf);
    setConfirmOpen(true);
  };

  const doDelete = async () => {
    if (!toDelete?._id) return;
    setDeleting(true);
    setMensaje('');

    try {
      const sesionId = localStorage.getItem('sesionId'); // importante para autorización en backend
      await axios.delete(`${API_BASE}/informes/${toDelete._id}`, {
        params: { sesionId }
      });

      setConfirmOpen(false);
      setToDelete(null);
      setMensaje('Informe eliminado correctamente');

      // Si la página queda vacía tras borrar, retrocede una página
      if (informes.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        fetchInformes();
      }
    } catch (err) {
      const status = err?.response?.status;
      const apiMsg = err?.response?.data?.error;

      if (status === 403) {
        setMensaje('No estás autorizado para eliminar este informe. Verifica que la sesión actual sea la que lo generó.');
      } else {
        setMensaje(apiMsg || 'No se pudo eliminar el informe');
      }
    } finally {
      setDeleting(false);
      setTimeout(() => setMensaje(''), 3000);
    }
  };

  return (
    <div className="dash-root">
      {/* Fondo + Overlay */}
      <div className="bg" style={{ backgroundImage: `url("${BG_URL}")` }} />
      <div className="overlay" />

      {/* Topbar */}
      <div className="topbar">
        <div className="hello">Hola, <strong>{nombreTecnico}</strong></div>
        <div className="actions">
          <button className="btn-outline" onClick={() => navigate('/dashboard')}>← Volver</button>
          <button className="btn-danger" onClick={handleCerrarSesion}>Cerrar sesión</button>
        </div>
      </div>

      {/* Contenido */}
      <div className="content">
        <div className="stack">
          <h1 className="title">Informes</h1>

          {/* Controles */}
          <div className="card">
            <h2 className="subtitle">Buscar y paginar</h2>
            <div className="controls-grid">
              <div className="field">
                <label className="label">Buscar por título</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Escribe para filtrar…"
                  value={search}
                  onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>

              <div className="field">
                <label className="label">Registros por página</label>
                <select
                  className="select"
                  value={limit}
                  onChange={(e) => { setPage(1); setLimit(parseInt(e.target.value, 10)); }}
                >
                  <option value={5}>5 por página</option>
                  <option value={10}>10 por página</option>
                  <option value={20}>20 por página</option>
                  <option value={50}>50 por página</option>
                </select>
              </div>

              <div className="field">
                <label className="label">&nbsp;</label>
                <button className="btn-outline" onClick={fetchInformes} disabled={loading}>
                  {loading ? 'Cargando…' : 'Actualizar'}
                </button>
              </div>
            </div>

            {mensaje && <p className="msg" role="status">{mensaje}</p>}
          </div>

          {/* Lista de informes (cards) */}
          <div className="list">
            {informes.length === 0 && !loading && (
              <div className="card empty">
                <p className="hint">No hay informes para mostrar.</p>
              </div>
            )}

            {informes.map((inf) => (
              <div className="card item" key={inf._id}>
                <div className="item-header">
                  <h3 className="item-title">{inf.title}</h3>
                  {inf.includesActa && <span className="badge">Incluye acta</span>}
                </div>

                <div className="meta">
                  <div><span className="meta-label">Generado por:</span> {inf.generatedBy?.nombre || inf.generatedBy?.usuario || '—'}</div>
                  <div><span className="meta-label">Fecha:</span> {formatFecha(inf.createdAt)}</div>
                </div>

                <div className="row-actions">
                  <button className="btn-outline" onClick={() => handleVer(inf.url)}>Ver</button>
                  <button className="btn-danger" onClick={() => askDelete(inf)}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>

          {/* Paginación */}
          <div className="card pager">
            <div className="pager-row">
              <span className="hint">Página {page} de {totalPages} • Total: {total}</span>
              <div className="pager-buttons">
                <button
                  className="btn-outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  Anterior
                </button>
                <button
                  className="btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmación */}
      <ConfirmModal
        open={confirmOpen}
        title="Eliminar informe"
        message={toDelete ? `¿Seguro que deseas eliminar “${toDelete.title}”? Esta acción no se puede deshacer.` : ''}
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={doDelete}
        onCancel={() => { if (!deleting) { setConfirmOpen(false); setToDelete(null); } }}
        loading={deleting}
      />

      <style>{`
        :root{
          --gold:#fff200;
          --ink:#0a0a0a;
          --text:#333333;
          --label:#555555;
          --panel:rgba(255,255,255,0.30);
          --panel-border:rgba(255,255,255,0.24);
          --input-bg:rgba(255,255,255,0.85);
          --input-text:#111111;
          --input-border:rgba(0,0,0,0.18);
          --placeholder:rgba(0,0,0,0.45);
          --title:#222222;
          --msg:#444444;
          --overlay:linear-gradient(to bottom,
                      rgba(255,242,0,0.35),
                      rgba(255,242,0,0.05) 40%,
                      rgba(0,0,0,0.10) 100%);
          --focus-ring:rgba(255,242,0,0.25);
          --danger:#ef4444;
        }
        @media (prefers-color-scheme: dark){
          :root{
            --text:#e9e9e9;
            --label:#d3d3d3;
            --panel:rgba(24,24,24,0.42);
            --panel-border:rgba(255,255,255,0.18);
            --input-bg:rgba(255,255,255,0.10);
            --input-text:#f2f2f2;
            --input-border:rgba(255,255,255,0.22);
            --title:#fafafa;
            --msg:#efefef;
            --overlay:linear-gradient(to bottom,
                        rgba(255,242,0,0.28),
                        rgba(0,0,0,0.25) 45%,
                        rgba(0,0,0,0.45) 100%);
            --focus-ring:rgba(255,242,0,0.35);
          }
        }

        .dash-root{
          position:relative; min-height:100vh; width:100%;
          padding: max(12px, env(safe-area-inset-top,0px)) 12px max(12px, env(safe-area-inset-bottom,0px));
          box-sizing:border-box; font-family: Roboto, system-ui, -apple-system, Segoe UI, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
          color:var(--text);
          -webkit-text-size-adjust:100%; text-size-adjust:100%;
          overflow-x:hidden;
        }
        .bg{ position:fixed; inset:0; background-size:cover; background-position:center; background-repeat:no-repeat; z-index:-2; transform:translateZ(0); }
        .overlay{ position:fixed; inset:0; z-index:-1; background:var(--overlay); pointer-events:none; }

        .topbar{
          display:flex; align-items:center; justify-content:space-between;
          gap:8px; margin: 6px auto 10px; width: min(100%, 960px);
          padding: 10px 12px; border-radius: 14px;
          background: var(--panel); border:1px solid var(--panel-border);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        }
        .hello{ font-weight:600; }
        .actions{ display:flex; gap:8px; flex-wrap:wrap; }

        .content{ min-height: calc(100vh - 90px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px)); display:flex; align-items:flex-start; justify-content:center; }
        .stack{ width:min(100%, 960px); display:flex; flex-direction:column; align-items:center; gap:16px; padding: 8px 0 28px; }

        .title{ margin: 10px 0 0 0; color: var(--title); font-weight:800; font-size: clamp(20px, 3.6vw, 28px); letter-spacing:.2px; text-align:center; text-shadow: 0 1px 0 rgba(255,255,255,0.3); }
        .subtitle{ margin:0 0 10px 0; font-size: clamp(16px, 2.8vw, 20px); color: var(--title); font-weight:700; text-align:left; }

        .card{
          width: 92%; max-width: 960px;
          padding: 18px; border-radius: 16px;
          background: var(--panel); border:1px solid var(--panel-border);
          box-shadow: 0 10px 36px rgba(0,0,0,0.30);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          transition: box-shadow 180ms ease;
        }
        .card:hover{ box-shadow: 0 12px 42px rgba(0,0,0,0.34); }
        .card.empty{ text-align:center; }

        .controls-grid{
          display:grid; grid-template-columns: 1fr; gap:10px;
        }
        @media (min-width: 640px){
          .controls-grid{ grid-template-columns: 1fr 220px 140px; }
        }

        .field{ margin-bottom: 8px; }
        .label{ display:block; font-weight:600; color:var(--label); margin-bottom:6px; }

        .input, .select{
          width:100%; box-sizing:border-box; border-radius:10px; border:1px solid var(--input-border);
          background: var(--input-bg); color: var(--input-text); outline:none;
          transition: border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
          font-size:16px;
        }
        .input{ height:48px; padding:10px 12px; }
        .select{ height:48px; padding:10px 12px; appearance:none; }

        .input:focus, .select:focus{
          border-color: var(--input-border);
          box-shadow: 0 0 0 3px var(--focus-ring);
          background: rgba(255,255,255,0.95);
        }
        @media (prefers-color-scheme: dark){
          .input:focus, .select:focus{ background: rgba(255,255,255,0.14); }
        }

        .btn{
          height:48px; padding:12px;
          background: var(--gold); color:#000; border:none; border-radius:10px;
          font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;
          transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease; user-select:none;
        }
        .btn:hover{ transform: translateY(-1px); }
        .btn:active{ transform: translateY(0); }
        .btn:disabled{ opacity:.7; cursor:not-allowed; }

        .btn-outline{
          height:48px; padding: 10px 14px; border-radius:10px; font-weight:700; cursor:pointer;
          background: rgba(255,255,255,0.28); color:#000; border:1px solid var(--panel-border);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          transition: transform 120ms ease, opacity 120ms ease, background 150ms ease;
        }
        @media (prefers-color-scheme: dark){
          .btn-outline{ color:#fff; }
        }
        .btn-outline:hover{ transform: translateY(-1px); }

        .btn-danger{
          height:48px; padding: 10px 14px; border-radius:10px; font-weight:700; cursor:pointer;
          background: var(--danger); color:#fff; border: none;
          transition: transform 120ms ease, opacity 120ms ease;
        }
        .btn-danger:hover{ transform: translateY(-1px); }

        .msg{ margin-top:10px; font-weight:700; color:var(--msg); text-align:center; }

        .list{ width:min(100%, 960px); display:flex; flex-direction:column; gap:12px; }
        .item-header{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .item-title{ margin:0; font-size: clamp(16px, 2.8vw, 20px); color:var(--title); font-weight:800; }
        .badge{
          display:inline-block; padding:6px 10px; border-radius:999px;
          background: rgba(255,255,255,0.5); border:1px solid var(--panel-border); font-weight:700;
        }
        @media (prefers-color-scheme: dark){
          .badge{ background: rgba(255,255,255,0.12); }
        }

        .meta{
          display:grid; grid-template-columns: 1fr; gap:6px; margin: 8px 0 10px;
          color: var(--label);
        }
        @media (min-width: 560px){
          .meta{ grid-template-columns: 1fr 1fr; }
        }
        .meta-label{ font-weight:700; color:var(--text); margin-right:6px; }

        .row-actions{
          display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;
        }

        .pager .pager-row{
          display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;
        }
        .hint{ color: var(--label); }

        /* ===== Modal glass ===== */
        .modal-overlay{
          position: fixed; inset: 0;
          z-index: 2147483647;
          background: rgba(0,0,0,0.12);
          backdrop-filter: blur(2.5px) saturate(120%);
          -webkit-backdrop-filter: blur(2.5px) saturate(120%);
          display:flex; align-items:center; justify-content:center;
          animation: fadeIn 120ms ease forwards;
          padding: 12px;
        }
        .modal-panel{
          width: min(520px, 92vw);
          background: var(--panel); border:1px solid var(--panel-border);
          border-radius: 16px; box-shadow: 0 16px 40px rgba(0,0,0,0.28);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          padding: 16px;
          animation: pop 140ms ease;
        }
        .modal-title{ margin:0 0 8px; color:var(--title); font-size: clamp(18px, 3vw, 22px); font-weight:800; }
        .modal-msg{ margin: 0 0 14px; color: var(--text); }
        .modal-actions{ display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }

        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pop { from { opacity: 0; transform: translateY(6px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );
};

export default InformesPage;
