import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { http } from '../services/http';

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
          <button className="btn ghost" type="button" onClick={onCancel} disabled={loading}>
            {cancelText}
          </button>

          <button className="btn danger" type="button" onClick={onConfirm} disabled={loading}>
            {loading ? 'Eliminando...' : confirmText}
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
  const [regionales, setRegionales] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [incidenciaSearch, setIncidenciaSearch] = useState('');
  const [regionalSearch, setRegionalSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    id: '',
    title: '',
    numeroIncidencia: '',
    regional: '',
    includesActa: false
  });

  const token = localStorage.getItem('token') || '';
  const nombreTecnico = localStorage.getItem('nombreTecnico') || 'Tecnico';
  const isAdmin = localStorage.getItem('isAdmin') === '1' || localStorage.getItem('isAdmin') === 'true';

  const limpiarSesionLocal = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('sesionId');
    localStorage.removeItem('nombreTecnico');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('userId');
    localStorage.removeItem('usuario');
    localStorage.removeItem('rol');
    localStorage.removeItem('dashStep');
    localStorage.removeItem('numeroIncidencia');
  }, []);

  const fetchRegionales = useCallback(async () => {
    try {
      const data = await http.get('/tiendas/regionales');
      const lista = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

      setRegionales(lista);
    } catch (err) {
      console.error('Error cargando regionales:', err);
      setRegionales([]);
    }
  }, []);

  const fetchInformes = useCallback(async () => {
    setLoading(true);
    setMensaje('');

    try {
      const data = await http.get('/informes', {
        page,
        limit,
        search,
        incidencia: incidenciaSearch,
        regional: regionalSearch
      });

      setInformes(data?.data || []);
      setTotal(data?.total || 0);
      setTotalPages(data?.totalPages || 1);
    } catch (err) {
      console.error('Error cargando informes:', err);
      setMensaje(err?.response?.data?.error || err?.response?.data?.mensaje || 'Error al cargar los informes');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, incidenciaSearch, regionalSearch]);

  useEffect(() => {
    if (!token) {
      navigate('/');
    }
  }, [navigate, token]);

  useEffect(() => {
    fetchRegionales();
  }, [fetchRegionales]);

  useEffect(() => {
    if (token) {
      fetchInformes();
    }
  }, [token, fetchInformes]);

  const handleCerrarSesion = () => {
    limpiarSesionLocal();
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

    if (!s) return '-';

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

  const handleEdit = (inf) => {
    setEditData({
      id: inf._id,
      title: inf.title || '',
      numeroIncidencia: inf.numeroIncidencia || '',
      regional: inf.regional || '',
      includesActa: Boolean(inf.includesActa)
    });

    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editData.id) return;

    setEditing(true);
    setMensaje('');

    try {
      await http.put(`/informes/${editData.id}`, {
        title: editData.title,
        numeroIncidencia: editData.numeroIncidencia,
        regional: editData.regional,
        includesActa: editData.includesActa
      });

      setEditOpen(false);
      setMensaje('Informe actualizado correctamente');
      fetchInformes();
    } catch (err) {
      setMensaje(err?.response?.data?.error || err?.response?.data?.mensaje || 'No se pudo actualizar el informe');
    } finally {
      setEditing(false);
      setTimeout(() => setMensaje(''), 3000);
    }
  };

  const doDelete = async () => {
    if (!toDelete?._id) return;

    setDeleting(true);
    setMensaje('');

    try {
      await http.delete(`/informes/${toDelete._id}`);

      setConfirmOpen(false);
      setToDelete(null);
      setMensaje('Informe eliminado correctamente');

      if (informes.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        fetchInformes();
      }
    } catch (err) {
      setMensaje(err?.response?.data?.error || err?.response?.data?.mensaje || 'No se pudo eliminar el informe');
    } finally {
      setDeleting(false);
      setTimeout(() => setMensaje(''), 3000);
    }
  };

  return (
    <div className="page-root">
      <header className="topbar">
        <div>
          <h1>{isAdmin ? 'Informes' : 'Mis informes'}</h1>
          <p>{nombreTecnico}</p>
        </div>

        <div className="top-actions">
          <button type="button" className="btn ghost" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>

          {isAdmin && (
            <button type="button" className="btn ghost" onClick={() => navigate('/usuarios')}>
              Usuarios
            </button>
          )}

          <button type="button" className="btn danger" onClick={handleCerrarSesion}>
            Cerrar sesion
          </button>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <div>
            <span className="eyebrow">Cubica PDF App</span>
            <h2>{isAdmin ? 'Gestion de informes' : 'Tus informes generados'}</h2>
            <p>
              Consulta, filtra y revisa los informes tecnicos generados desde la aplicacion.
            </p>
          </div>

          <div className="hero-stat">
            <span>Total</span>
            <strong>{total}</strong>
          </div>
        </section>

        <section className={`card filters-card ${loading ? 'is-busy' : ''}`}>
          {loading && <div className="md-progress" aria-hidden="true" />}

          <div className="section-heading">
            <h3>Buscar informes</h3>
            <p>Filtra por titulo, incidencia o regional.</p>
          </div>

          <div className="controls-grid">
            <div className="field">
              <label>Buscar por titulo</label>
              <input
                type="text"
                placeholder="Escribe para filtrar"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>

            <div className="field">
              <label>Incidencia</label>
              <input
                type="text"
                placeholder="Ej: 12345"
                value={incidenciaSearch}
                onChange={(e) => {
                  setPage(1);
                  setIncidenciaSearch(e.target.value);
                }}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>

            <div className="field">
              <label>Regional</label>
              <select
                value={regionalSearch}
                onChange={(e) => {
                  setPage(1);
                  setRegionalSearch(e.target.value);
                }}
              >
                <option value="">Todas</option>
                {regionales.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Registros</label>
              <select
                value={limit}
                onChange={(e) => {
                  setPage(1);
                  setLimit(parseInt(e.target.value, 10));
                }}
              >
                <option value={5}>5 por pagina</option>
                <option value={10}>10 por pagina</option>
                <option value={20}>20 por pagina</option>
                <option value={50}>50 por pagina</option>
              </select>
            </div>
          </div>

          <div className="filter-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setPage(1);
                setSearch('');
                setIncidenciaSearch('');
                setRegionalSearch('');
              }}
              disabled={loading}
            >
              Limpiar
            </button>

            <button type="button" className="btn primary" onClick={fetchInformes} disabled={loading}>
              {loading ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>

          {mensaje && <p className="message">{mensaje}</p>}
        </section>

        {loading && (
          <section className="list">
            {[1, 2, 3].map((i) => (
              <article className="card item skeleton" key={`sk-${i}`}>
                <div className="sk-line lg" />
                <div className="sk-grid">
                  <div className="sk-line" />
                  <div className="sk-line" />
                </div>
                <div className="sk-actions">
                  <div className="sk-btn" />
                  <div className="sk-btn wide" />
                </div>
              </article>
            ))}
          </section>
        )}

        {!loading && (
          <section className="list">
            {informes.length === 0 && (
              <article className="card empty">
                <h3>No hay informes</h3>
                <p>No se encontraron informes con los filtros seleccionados.</p>
              </article>
            )}

            {informes.map((inf) => (
              <article className="card item" key={inf._id}>
                <div className="item-header">
                  <div>
                    <h3>{inf.title}</h3>
                    <p>{formatFecha(inf.createdAt)}</p>
                  </div>

                  {inf.includesActa && <span className="badge">Incluye acta</span>}
                </div>

                <div className="meta-grid">
                  <div>
                    <span>Generado por</span>
                    <strong>{inf.generatedBy?.nombre || inf.generatedBy?.usuario || '-'}</strong>
                  </div>

                  <div>
                    <span>Incidencia</span>
                    <strong>{formatIncidencia(inf.numeroIncidencia)}</strong>
                  </div>

                  <div>
                    <span>Regional</span>
                    <strong>{inf.regional || '-'}</strong>
                  </div>
                </div>

                <div className="row-actions">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => handleVer(inf.shareUrl || inf.url)}
                  >
                    Ver PDF
                  </button>

                  {isAdmin && (
                    <>
                      <button type="button" className="btn primary" onClick={() => handleEdit(inf)}>
                        Editar
                      </button>

                      <button type="button" className="btn danger" onClick={() => askDelete(inf)}>
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}

        <section className="card pager">
          <div>
            <span>Pagina {page} de {totalPages}</span>
            <strong>Total: {total}</strong>
          </div>

          <div className="pager-buttons">
            <button
              type="button"
              className="btn ghost"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              Anterior
            </button>

            <button
              type="button"
              className="btn primary"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Siguiente
            </button>
          </div>
        </section>
      </main>

      <ConfirmModal
        open={confirmOpen}
        title="Eliminar informe"
        message={toDelete ? `Seguro que deseas eliminar "${toDelete.title}"? Esta accion no se puede deshacer.` : ''}
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={doDelete}
        onCancel={() => {
          if (!deleting) {
            setConfirmOpen(false);
            setToDelete(null);
          }
        }}
        loading={deleting}
      />

      {editOpen && createPortal(
        <div className="modal-overlay" role="presentation">
          <div className="modal-panel" role="dialog" aria-modal="true">
            <h3 className="modal-title">Editar informe</h3>
            <p className="modal-msg">Actualiza la informacion visible del informe.</p>

            <div className="field">
              <label>Titulo</label>
              <input
                value={editData.title}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    title: e.target.value
                  }))
                }
              />
            </div>

            <div className="field">
              <label>Numero de incidencia</label>
              <input
                value={editData.numeroIncidencia}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    numeroIncidencia: e.target.value
                  }))
                }
              />
            </div>

            <div className="field">
              <label>Regional</label>
              <select
                value={editData.regional}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    regional: e.target.value
                  }))
                }
              >
                <option value="">Selecciona regional</option>
                {regionales.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <label className="check-label">
              <input
                type="checkbox"
                checked={editData.includesActa}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    includesActa: e.target.checked
                  }))
                }
              />
              Incluye acta
            </label>

            <div className="modal-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setEditOpen(false)}
                disabled={editing}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn primary"
                onClick={saveEdit}
                disabled={editing}
              >
                {editing ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        *, *::before, *::after {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          min-height: 100%;
        }

        body {
          margin: 0;
          background: #0b0d10;
        }

        .page-root {
          min-height: 100vh;
          min-height: 100dvh;
          background:
            radial-gradient(circle at top left, rgba(255, 242, 0, 0.12), transparent 28%),
            radial-gradient(circle at bottom right, rgba(255, 255, 255, 0.07), transparent 32%),
            linear-gradient(180deg, #101317 0%, #0b0d10 100%);
          color: #f4f4f5;
          font-family: Inter, Roboto, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
          -webkit-tap-highlight-color: transparent;
          padding: max(12px, env(safe-area-inset-top, 0px)) 12px max(18px, env(safe-area-inset-bottom, 0px));
        }

        .topbar {
          position: sticky;
          top: max(8px, env(safe-area-inset-top, 0px));
          z-index: 50;
          width: min(1180px, 100%);
          margin: 0 auto 14px;
          padding: 12px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          box-shadow: 0 14px 44px rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .topbar h1 {
          margin: 0;
          font-size: clamp(22px, 6vw, 34px);
          line-height: 1;
          letter-spacing: -0.05em;
          font-weight: 900;
        }

        .topbar p {
          margin: 5px 0 0;
          color: #c5c8ce;
          font-size: 14px;
          font-weight: 700;
        }

        .top-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .container {
          width: min(980px, 100%);
          margin: 0 auto;
          padding: 6px 0 34px;
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: stretch;
          margin-bottom: 16px;
        }

        .hero > div:first-child,
        .hero-stat {
          padding: clamp(22px, 5vw, 34px);
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.3);
        }

        .eyebrow {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255, 242, 0, 0.12);
          border: 1px solid rgba(255, 242, 0, 0.24);
          color: #fff200;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 14px;
        }

        .hero h2 {
          margin: 0;
          font-size: clamp(28px, 8vw, 48px);
          line-height: 0.98;
          letter-spacing: -0.07em;
          font-weight: 900;
        }

        .hero p {
          margin: 12px 0 0;
          color: #c5c8ce;
          line-height: 1.5;
          max-width: 620px;
        }

        .hero-stat {
          min-width: 148px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 6px;
          background: rgba(255, 242, 0, 0.11);
          border-color: rgba(255, 242, 0, 0.24);
        }

        .hero-stat span {
          color: #c5c8ce;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .hero-stat strong {
          color: #fff200;
          font-size: 44px;
          line-height: 1;
          font-weight: 900;
        }

        .card {
          position: relative;
          width: 100%;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.075);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.32);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          padding: clamp(18px, 4vw, 24px);
          animation: enter 240ms ease-out;
          overflow: hidden;
        }

        .card.is-busy {
          animation: busy 700ms ease-out 1;
        }

        .filters-card {
          margin-bottom: 16px;
        }

        .section-heading {
          margin-bottom: 16px;
        }

        .section-heading h3 {
          margin: 0;
          font-size: clamp(21px, 5vw, 30px);
          line-height: 1;
          letter-spacing: -0.05em;
          font-weight: 900;
        }

        .section-heading p {
          margin: 8px 0 0;
          color: #c5c8ce;
          line-height: 1.4;
        }

        .controls-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
        }

        .field label {
          color: #d7d9dd;
          font-size: 13px;
          font-weight: 800;
        }

        input,
        select {
          width: 100%;
          min-height: 52px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.08);
          color: #f5f5f5;
          border-radius: 16px;
          padding: 0 16px;
          font-size: 16px;
          outline: none;
          transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }

        input::placeholder {
          color: rgba(197, 200, 206, 0.72);
        }

        select {
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23f4f4f5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          background-size: 16px;
          padding-right: 42px;
        }

        option {
          background: #15181c;
          color: #f4f4f5;
        }

        input:focus,
        select:focus {
          border-color: rgba(255, 242, 0, 0.45);
          box-shadow: 0 0 0 4px rgba(255, 242, 0, 0.12);
          background: rgba(255, 255, 255, 0.1);
        }

        .filter-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .btn {
          min-height: 48px;
          border: 0;
          border-radius: 16px;
          padding: 0 18px;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
          transition: transform 120ms ease, opacity 120ms ease, box-shadow 160ms ease, background 160ms ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          user-select: none;
          white-space: nowrap;
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .btn:disabled {
          cursor: not-allowed;
          opacity: 0.58;
        }

        .btn.primary {
          background: #fff200;
          color: #111;
          box-shadow: 0 14px 32px rgba(255, 242, 0, 0.16);
        }

        .btn.ghost {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.14);
        }

        .btn.danger {
          background: rgba(255, 74, 74, 0.14);
          color: #ffb7b7;
          border: 1px solid rgba(255, 74, 74, 0.24);
        }

        .message {
          margin: 14px 0 0;
          padding: 12px 14px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.08);
          color: #f1f1f1;
          font-weight: 800;
          text-align: center;
          line-height: 1.35;
        }

        .list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .item {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .item-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .item-header h3 {
          margin: 0;
          font-size: clamp(18px, 5vw, 24px);
          line-height: 1.1;
          letter-spacing: -0.04em;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .item-header p {
          margin: 6px 0 0;
          color: #c5c8ce;
          font-size: 14px;
          font-weight: 700;
        }

        .badge {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 32px;
          padding: 7px 11px;
          border-radius: 999px;
          background: rgba(255, 242, 0, 0.12);
          border: 1px solid rgba(255, 242, 0, 0.25);
          color: #fff200;
          font-size: 12px;
          font-weight: 900;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .meta-grid div {
          min-width: 0;
          padding: 13px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .meta-grid span {
          display: block;
          color: #b8bcc3;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .meta-grid strong {
          display: block;
          color: #fff;
          font-size: 14px;
          overflow-wrap: anywhere;
        }

        .row-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .empty {
          text-align: center;
        }

        .empty h3 {
          margin: 0;
          font-size: 22px;
          letter-spacing: -0.04em;
        }

        .empty p {
          margin: 8px 0 0;
          color: #c5c8ce;
        }

        .pager {
          margin-top: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .pager span {
          display: block;
          color: #b8bcc3;
          font-size: 13px;
          font-weight: 800;
        }

        .pager strong {
          display: block;
          color: #fff200;
          margin-top: 4px;
          font-size: 18px;
        }

        .pager-buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .md-progress {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          overflow: hidden;
          background: transparent;
        }

        .md-progress::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0, rgba(255, 242, 0, 0.2) 30%, #fff200 52%, rgba(255, 242, 0, 0.2) 74%, transparent 100%);
          transform: translateX(-100%);
          animation: indeterminate 1.2s cubic-bezier(.4, 0, .2, 1) infinite;
        }

        .skeleton .sk-line {
          height: 12px;
          border-radius: 8px;
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06));
          background-size: 200% 100%;
          animation: sk 1.2s linear infinite;
        }

        .skeleton .sk-line.lg {
          height: 20px;
          width: 72%;
          margin-bottom: 10px;
        }

        .skeleton .sk-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          margin: 10px 0;
        }

        .skeleton .sk-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .skeleton .sk-btn {
          width: 100px;
          height: 42px;
          border-radius: 14px;
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06));
          background-size: 200% 100%;
          animation: sk 1.2s linear infinite;
        }

        .skeleton .sk-btn.wide {
          width: 130px;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.52);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
        }

        .modal-panel {
          width: min(520px, 100%);
          max-height: calc(100vh - 36px);
          overflow: auto;
          border-radius: 26px;
          background: rgba(21, 24, 28, 0.96);
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 24px 90px rgba(0, 0, 0, 0.46);
          padding: 22px;
          animation: pop 150ms ease-out;
        }

        .modal-title {
          margin: 0;
          font-size: clamp(24px, 6vw, 32px);
          line-height: 1;
          letter-spacing: -0.05em;
          font-weight: 900;
        }

        .modal-msg {
          margin: 10px 0 18px;
          color: #c5c8ce;
          line-height: 1.45;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .check-label {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #f4f4f5;
          font-weight: 800;
          margin: 4px 0 16px;
        }

        .check-label input {
          width: 18px;
          height: 18px;
          min-height: 18px;
          padding: 0;
        }

        @keyframes enter {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.99);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes busy {
          0% {
            transform: translateY(0) scale(1);
          }

          40% {
            transform: translateY(-1px) scale(1.005);
          }

          100% {
            transform: translateY(0) scale(1);
          }
        }

        @keyframes indeterminate {
          to {
            transform: translateX(100%);
          }
        }

        @keyframes sk {
          0% {
            background-position: 200% 0;
          }

          100% {
            background-position: -200% 0;
          }
        }

        @keyframes pop {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 860px) {
          .page-root {
            padding-left: 10px;
            padding-right: 10px;
          }

          .topbar {
            align-items: stretch;
            flex-direction: column;
          }

          .top-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            width: 100%;
          }

          .top-actions .btn {
            width: 100%;
          }

          .top-actions .btn.danger {
            grid-column: 1 / -1;
          }

          .hero {
            grid-template-columns: 1fr;
          }

          .hero-stat {
            min-width: 0;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }

          .hero-stat strong {
            font-size: 38px;
          }

          .controls-grid {
            grid-template-columns: 1fr;
            gap: 4px;
          }

          .filter-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .filter-actions .btn {
            width: 100%;
          }

          .meta-grid {
            grid-template-columns: 1fr;
          }

          .row-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .row-actions .btn {
            width: 100%;
          }

          .pager {
            align-items: stretch;
            flex-direction: column;
          }

          .pager-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            width: 100%;
          }

          .pager-buttons .btn {
            width: 100%;
          }

          .modal-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .modal-actions .btn {
            width: 100%;
          }
        }

        @media (max-width: 420px) {
          .card,
          .hero > div:first-child,
          .hero-stat,
          .topbar {
            border-radius: 22px;
          }

          .top-actions {
            grid-template-columns: 1fr;
          }

          .filter-actions {
            grid-template-columns: 1fr;
          }

          .pager-buttons {
            grid-template-columns: 1fr;
          }

          .item-header {
            flex-direction: column;
            align-items: stretch;
          }

          .badge {
            width: fit-content;
          }
        }


        @media (hover: none) and (pointer: coarse) {
          .btn,
          input,
          select {
            min-height: 54px;
          }

          .btn:hover:not(:disabled) {
            transform: none;
          }
        }

        @media (max-width: 640px) {
          .page-root {
            padding: max(8px, env(safe-area-inset-top, 0px)) 8px max(18px, env(safe-area-inset-bottom, 0px));
          }

          .topbar {
            top: max(6px, env(safe-area-inset-top, 0px));
            margin-bottom: 10px;
            padding: 10px;
            gap: 10px;
          }

          .topbar h1 {
            font-size: clamp(24px, 9vw, 34px);
          }

          .topbar p {
            font-size: 13px;
          }

          .container {
            padding-top: 2px;
          }

          .hero {
            gap: 10px;
            margin-bottom: 10px;
          }

          .hero > div:first-child,
          .hero-stat {
            padding: 18px;
            border-radius: 22px;
          }

          .eyebrow {
            margin-bottom: 10px;
            padding: 7px 10px;
            font-size: 11px;
          }

          .hero h2 {
            font-size: clamp(28px, 10vw, 38px);
          }

          .hero p {
            font-size: 14px;
          }

          .hero-stat strong {
            font-size: 34px;
          }

          .card {
            border-radius: 22px;
            padding: 16px;
          }

          .filters-card {
            margin-bottom: 10px;
          }

          .section-heading {
            margin-bottom: 12px;
          }

          .section-heading h3 {
            font-size: 24px;
          }

          .section-heading p {
            font-size: 14px;
          }

          .field {
            margin-bottom: 10px;
          }

          .field label {
            font-size: 12px;
          }

          input,
          select {
            min-height: 54px;
            border-radius: 15px;
            font-size: 16px;
          }

          .list {
            gap: 10px;
          }

          .item {
            gap: 12px;
          }

          .item-header h3 {
            font-size: 21px;
          }

          .item-header p {
            font-size: 13px;
          }

          .meta-grid div {
            padding: 12px;
            border-radius: 16px;
          }

          .row-actions,
          .filter-actions,
          .pager-buttons,
          .top-actions {
            gap: 8px;
          }

          .btn {
            min-height: 54px;
            border-radius: 15px;
            padding: 0 14px;
          }

          .pager {
            margin-top: 10px;
          }

          .modal-overlay {
            align-items: flex-end;
            padding: 8px;
          }

          .modal-panel {
            width: 100%;
            max-height: calc(100dvh - 16px);
            border-radius: 24px;
            padding: 18px;
          }
        }

        @media (max-width: 360px) {
          .page-root {
            padding-left: 6px;
            padding-right: 6px;
          }

          .card,
          .hero > div:first-child,
          .hero-stat,
          .topbar,
          .modal-panel {
            border-radius: 20px;
          }

          .hero > div:first-child,
          .hero-stat,
          .card,
          .modal-panel {
            padding: 14px;
          }

          .btn {
            font-size: 13px;
          }
        }

      `}</style>
    </div>
  );
};

export default InformesPage;