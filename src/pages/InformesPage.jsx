// InformesPage.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';

const API_BASE = 'https://cubica-photo-app.onrender.com';

/* Modal de confirmación con estilo glass */
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

  /* Estado de datos y filtros */
  const [informes, setInformes] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [incidenciaSearch, setIncidenciaSearch] = useState('');

  /* Estado de UI */
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  /* Confirmación de borrado */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const nombreTecnico = localStorage.getItem('nombreTecnico') || 'Técnico';

  const fetchInformes = async () => {
    setLoading(true);
    setMensaje('');
    try {
      const res = await axios.get(`${API_BASE}/informes`, {
        params: { page, limit, search, incidencia: incidenciaSearch }
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
  }, [page, limit, search, incidenciaSearch]);

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

  const formatIncidencia = (raw) => {
    const s = (raw || '').toString().trim();
    if (!s) return '—';

    const upper = s.toUpperCase();
    if (upper.startsWith('INC-')) return s.slice(4).trim();
    if (upper.startsWith('INC')) {
      const rest = s.slice(3).trim();
      return rest.startsWith('-') ? rest.slice(1).trim() : rest;
    }
    return s;
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
      const sesionId = localStorage.getItem('sesionId');
      await axios.delete(`${API_BASE}/informes/${toDelete._id}`, {
        params: { sesionId }
      });

      setConfirmOpen(false);
      setToDelete(null);
      setMensaje('Informe eliminado correctamente');

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
        <div className="stack" aria-busy={loading}>
          <h1 className="title">Informes</h1>

          {/* Controles */}
          <div className={`card ${loading ? 'is-busy' : ''}`}>
            {loading && <div className="md-progress" aria-hidden="true" />}
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
                <label className="label">Buscar por incidencia</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: 12345"
                  value={incidenciaSearch}
                  onChange={(e) => { setPage(1); setIncidenciaSearch(e.target.value); }}
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

          {/* Skeleton mientras carga */}
          {loading && (
            <div className="list">
              {[1, 2, 3].map((i) => (
                <div className="card item skeleton" key={`sk-${i}`}>
                  <div className="sk-line lg" />
                  <div className="sk-grid">
                    <div className="sk-line" />
                    <div className="sk-line" />
                  </div>
                  <div className="sk-actions">
                    <div className="sk-btn" />
                    <div className="sk-btn wide" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lista de informes */}
          {!loading && (
            <div className="list">
              {informes.length === 0 && (
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
                    <div><span className="meta-label">Incidencia:</span> {formatIncidencia(inf.numeroIncidencia)}</div>
                  </div>

                  <div className="row-actions">
                    <button className="btn-outline" onClick={() => handleVer(inf.url)}>Ver</button>
                    <button className="btn-danger" onClick={() => askDelete(inf)}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}

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

      {/* Estilos unificados con el patrón material de Login/Dashboard */}
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body, #root { height: 100%; }
        html, body { margin: 0; background: #0f1113; }

        :root{
          --primary:#fff200;
          --on-primary:#111111;
          --bg:#0f1113;
          --surface:#15181c;
          --on-surface:#e9eaec;
          --outline:rgba(255,255,255,0.18);
          --outline-strong:rgba(255,255,255,0.28);
          --label:#b8bcc3;
          --danger:#ef4444;
          --focus:rgba(255,242,0,0.35);
        }

        .dash-root{
          min-height:100svh; min-height:100dvh; width:100%;
          background:var(--bg); color:var(--on-surface);
          font-family: Inter, Roboto, system-ui, -apple-system, Segoe UI, Helvetica, Arial;
          -webkit-tap-highlight-color: transparent;
          padding: max(10px, env(safe-area-inset-top,0px)) 10px max(10px, env(safe-area-inset-bottom,0px));
        }

        .topbar{
          position:sticky; top:max(8px, env(safe-area-inset-top,0px));
          display:flex; align-items:center; justify-content:space-between; gap:8px; margin:6px auto 10px;
          width:min(100%,960px); padding:10px 12px; border-radius:14px; background:rgba(255,255,255,0.06);
          border:1px solid var(--outline); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
          box-shadow:0 8px 24px rgba(0,0,0,0.18);
        }
        .hello{ font-weight:600; }
        .actions{ display:flex; gap:8px; flex-wrap:wrap; }

        .content{ display:flex; justify-content:center; }
        .stack{ width:min(100%,960px); display:flex; flex-direction:column; align-items:center; gap:16px; padding:12px 12px 28px; }

        .title{ margin:6px 0 0 0; font-weight:800; font-size:clamp(18px,4.5vw,28px); letter-spacing:.2px; text-align:center; }

        .card{
          position:relative;
          width:100%; max-width:960px; padding:16px; border-radius:16px; background:var(--surface);
          border:1px solid var(--outline); color:var(--on-surface);
          box-shadow:0 10px 36px rgba(0,0,0,0.30); transition:transform 160ms ease, box-shadow 180ms ease;
          animation: md-enter 260ms cubic-bezier(.2,.8,.2,1);
        }
        .card:hover{ transform: translateY(-1px); box-shadow: 0 12px 42px rgba(0,0,0,0.34); }
        .card.is-busy{ animation: md-busy 700ms ease-out 1; }
        .card.empty{ text-align:center; }

        .subtitle{ margin:0 0 10px 0; font-size:clamp(16px,4vw,20px); font-weight:700; }

        .controls-grid{ display:grid; grid-template-columns:1fr; gap:10px; align-items:end; }
        @media (min-width:640px){ .controls-grid{ grid-template-columns:minmax(320px,2fr) minmax(220px,1fr) 200px 140px; align-items:end; } }
        .controls-grid .field{ margin-bottom:0; }
        .controls-grid .label{ min-height:34px; }


        .field{ margin-bottom:8px; }
        .label{ display:block; font-weight:600; color:var(--label); margin-bottom:6px; }

        .input, .select{
          width:100%; border-radius:12px; border:1px solid var(--outline); background:transparent; color:var(--on-surface);
          font-size:16px; outline:none; transition:border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
          height:48px; padding:10px 12px;
        }
        .select{ appearance:none; }

        .input:focus, .select:focus{ box-shadow:0 0 0 4px var(--focus); border-color:var(--outline-strong); }

        .btn{
          height:48px; padding:12px; background:var(--primary); color:var(--on-primary); border:none; border-radius:12px;
          font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;
          transition:transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease; user-select:none;
          box-shadow:0 8px 24px rgba(0,0,0,0.18);
        }
        .btn:hover{ transform:translateY(-1px); }
        .btn:active{ transform:translateY(0); }
        .btn:disabled{ opacity:.7; cursor:not-allowed; }

        .btn-outline{
          height:48px; padding:10px 14px; border-radius:12px; font-weight:700; cursor:pointer;
          background:rgba(255,255,255,0.08); color:var(--on-surface); border:1px solid var(--outline);
          backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
          transition:transform 120ms ease, opacity 120ms ease, background 150ms ease, border-color 150ms ease;
        }
        .btn-outline:hover{ transform:translateY(-1px); }

        .btn-danger{
          height:48px; padding:10px 14px; border-radius:12px; font-weight:700; cursor:pointer;
          background:var(--danger); color:#fff; border:none; transition:transform 120ms ease, opacity 120ms ease;
        }
        .btn-danger:hover{ transform:translateY(-1px); }

        .msg{ margin-top:10px; font-weight:700; text-align:center; }

        .list{ width:min(100%,960px); display:flex; flex-direction:column; gap:12px; }
        .item-header{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .item-title{ margin:0; font-size:clamp(16px,2.8vw,20px); font-weight:800; }
        .badge{
          display:inline-block; padding:6px 10px; border-radius:999px; background:rgba(255,255,255,0.10);
          border:1px solid var(--outline); font-weight:800; font-size:13px;
        }

        .meta{
          display:grid; grid-template-columns:1fr; gap:6px; margin:8px 0 10px; color:var(--label);
        }
        @media (min-width:560px){ .meta{ grid-template-columns:1fr 1fr; } }
        .meta-label{ font-weight:700; color:var(--on-surface); margin-right:6px; }

        .row-actions{ display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }

        .pager .pager-row{ display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
        .pager-buttons{ display:flex; gap:8px; }

        .md-progress{
          position:absolute; top:0; left:0; right:0; height:3px; overflow:hidden;
          border-top-left-radius:16px; border-top-right-radius:16px; background:transparent;
        }
        .md-progress::before{
          content:""; position:absolute; inset:0;
          background: linear-gradient(90deg, transparent 0, rgba(255,242,0,.2) 30%, var(--primary) 52%, rgba(255,242,0,.2) 74%, transparent 100%);
          transform: translateX(-100%);
          animation: md-indeterminate 1.2s cubic-bezier(.4,0,.2,1) infinite;
        }

        /* Skeletons */
        .skeleton .sk-line{ height:12px; border-radius:8px; background:linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.12), rgba(255,255,255,0.06)); background-size:200% 100%; animation: sk 1.2s linear infinite; }
        .skeleton .sk-line.lg{ height:18px; width:60%; margin-bottom:10px; }
        .skeleton .sk-grid{ display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:8px 0 10px; }
        .skeleton .sk-actions{ display:flex; gap:8px; justify-content:flex-end; }
        .skeleton .sk-btn{ width:92px; height:40px; border-radius:10px; background:linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.12), rgba(255,255,255,0.06)); background-size:200% 100%; animation: sk 1.2s linear infinite; }
        .skeleton .sk-btn.wide{ width:120px; }

        /* Modal glass */
        .modal-overlay{
          position:fixed; inset:0; z-index:2147483647; background:rgba(0,0,0,0.12);
          backdrop-filter:blur(2.5px) saturate(120%); -webkit-backdrop-filter:blur(2.5px) saturate(120%);
          display:flex; align-items:center; justify-content:center; padding:12px; animation: fadeIn 120ms ease forwards;
        }
        .modal-panel{
          width:min(520px,92vw); background:var(--surface); border:1px solid var(--outline); color:var(--on-surface);
          border-radius:16px; box-shadow:0 16px 40px rgba(0,0,0,0.28); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
          padding:16px; animation: pop 140ms ease;
        }
        .modal-title{ margin:0 0 8px; font-size:clamp(18px,3vw,22px); font-weight:800; }
        .modal-msg{ margin:0 0 14px; color:var(--label); }
        .modal-actions{ display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }

        @keyframes md-enter{ from{ opacity:0; transform: translateY(4px) scale(.995);} to{ opacity:1; transform: translateY(0) scale(1);} }
        @keyframes md-busy{ 0%{transform:translateY(0) scale(1);} 40%{transform:translateY(-1px) scale(1.005);} 100%{transform:translateY(0) scale(1);} }
        @keyframes md-indeterminate{ to { transform: translateX(100%); } }
        @keyframes sk{ 0%{ background-position:200% 0; } 100%{ background-position:-200% 0; } }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pop { from { opacity: 0; transform: translateY(6px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );
};

export default InformesPage;
