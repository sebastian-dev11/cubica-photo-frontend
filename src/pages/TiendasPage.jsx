import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { http } from '../services/http';

function limpiarTexto(valor) {
  return typeof valor === 'string' ? valor.replace(/\s+/g, ' ').trim() : '';
}

function obtenerMensajeError(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'Ocurrió un error inesperado'
  );
}

function formatearFecha(fecha) {
  if (!fecha) return 'Sin fecha';

  try {
    return new Date(fecha).toLocaleString('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Bogota'
    });
  } catch {
    return 'Sin fecha';
  }
}

function normalizarListaTiendas(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function normalizarListaInformes(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.informes)) return response.informes;
  return [];
}

const estadoInicial = {
  nombre: '',
  regional: '',
  departamento: '',
  ciudad: ''
};

function TiendasPage() {
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const rolUsuario = (localStorage.getItem('rol') || '').toLowerCase();
  const isAdminStorage = (localStorage.getItem('isAdmin') || '').toLowerCase();

  const isAdmin =
    isAdminStorage === 'true' ||
    isAdminStorage === '1' ||
    rolUsuario === 'admin';

  const nombreTecnico = localStorage.getItem('nombreTecnico') || 'Admin';

  const [tiendas, setTiendas] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(estadoInicial);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyTienda, setHistoryTienda] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);

  const tiendasFiltradas = useMemo(() => {
    const q = limpiarTexto(search).toLowerCase();

    if (!q) return tiendas;

    return tiendas.filter((tienda) => {
      const texto = [
        tienda.nombre,
        tienda.regional,
        tienda.departamento,
        tienda.ciudad
      ].join(' ').toLowerCase();

      return texto.includes(q);
    });
  }, [tiendas, search]);

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }

    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }

    cargarTiendas();
  }, [isAdmin, navigate, token]);

  async function cargarTiendas() {
    try {
      setLoading(true);
      setError('');

      const response = await http.get('/tiendas');
      setTiendas(normalizarListaTiendas(response));
    } catch (err) {
      setError(obtenerMensajeError(err));
    } finally {
      setLoading(false);
    }
  }

  function abrirCrear() {
    setEditing(null);
    setForm(estadoInicial);
    setError('');
    setSuccess('');
    setModalOpen(true);
  }

  function abrirEditar(tienda) {
    setEditing(tienda);
    setForm({
      nombre: tienda.nombre || '',
      regional: tienda.regional || '',
      departamento: tienda.departamento || '',
      ciudad: tienda.ciudad || ''
    });
    setError('');
    setSuccess('');
    setModalOpen(true);
  }

  function cerrarModal() {
    if (saving) return;

    setModalOpen(false);
    setEditing(null);
    setForm(estadoInicial);
  }

  function actualizarCampo(campo, valor) {
    setForm((prev) => ({
      ...prev,
      [campo]: valor
    }));
  }

  async function guardarTienda(e) {
    e.preventDefault();

    const payload = {
      nombre: limpiarTexto(form.nombre),
      regional: limpiarTexto(form.regional),
      departamento: limpiarTexto(form.departamento),
      ciudad: limpiarTexto(form.ciudad)
    };

    if (!payload.nombre || !payload.regional || !payload.departamento || !payload.ciudad) {
      setError('Todos los campos son obligatorios');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      if (editing?._id) {
        await http.put(`/tiendas/${editing._id}`, payload);
        setSuccess('Tienda actualizada correctamente');
      } else {
        await http.post('/tiendas', payload);
        setSuccess('Tienda creada correctamente');
      }

      setModalOpen(false);
      setEditing(null);
      setForm(estadoInicial);
      await cargarTiendas();
    } catch (err) {
      setError(obtenerMensajeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function eliminarTienda(tienda) {
    const confirmar = window.confirm(`¿Eliminar la tienda ${tienda.nombre}?`);

    if (!confirmar) return;

    try {
      setError('');
      setSuccess('');
      await http.delete(`/tiendas/${tienda._id}`);
      setSuccess('Tienda eliminada correctamente');
      await cargarTiendas();
    } catch (err) {
      setError(obtenerMensajeError(err));
    }
  }

  async function abrirHistorial(tienda) {
    setHistoryOpen(true);
    setHistoryTienda(tienda);
    setHistoryItems([]);
    setHistoryError('');
    setHistoryLoading(true);

    try {
      const response = await http.get(`/informes/tienda/${tienda._id}`, {
        page: 1,
        limit: 50
      });

      setHistoryItems(normalizarListaInformes(response));
    } catch (err) {
      setHistoryError(obtenerMensajeError(err));
    } finally {
      setHistoryLoading(false);
    }
  }

  function cerrarHistorial() {
    setHistoryOpen(false);
    setHistoryTienda(null);
    setHistoryItems([]);
    setHistoryError('');
  }

  function volverDashboard() {
    navigate('/dashboard');
  }

  function abrirInformes() {
    navigate('/informes');
  }

  return (
    <div className="tiendas-page">
      <div className="bg-orb orb-one" />
      <div className="bg-orb orb-two" />

      <header className="topbar">
        <div>
          <p className="eyebrow">Panel administrativo</p>
          <h1>Tiendas</h1>
          <p className="muted">Administra las tiendas disponibles para la generación de informes.</p>
        </div>

        <div className="top-actions">
          <span className="session-chip">{nombreTecnico}</span>
          <button type="button" className="btn ghost" onClick={abrirInformes}>Informes</button>
          <button type="button" className="btn ghost" onClick={volverDashboard}>Dashboard</button>
        </div>
      </header>

      <main className="dash-container">
        <section className="hero-card">
          <div>
            <p className="eyebrow yellow">Gestión de tiendas</p>
            <h2>Crear, editar y consultar historial</h2>
            <p className="muted">Las tiendas creadas aquí aparecen automáticamente en el selector del Dashboard.</p>
          </div>

          <button type="button" className="btn primary big" onClick={abrirCrear}>Nueva tienda</button>
        </section>

        {(error || success) && (
          <div className={`alert ${error ? 'error' : 'success'}`}>
            {error || success}
          </div>
        )}

        <section className="panel-card">
          <div className="section-head">
            <div>
              <h3>Listado de tiendas</h3>
              <p className="muted small">Total: {tiendasFiltradas.length}</p>
            </div>

            <div className="search-wrap">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, regional, departamento o ciudad"
                autoComplete="off"
              />
            </div>
          </div>

          {loading ? (
            <div className="empty-state">Cargando tiendas...</div>
          ) : tiendasFiltradas.length === 0 ? (
            <div className="empty-state">No hay tiendas para mostrar.</div>
          ) : (
            <div className="store-grid">
              {tiendasFiltradas.map((tienda) => (
                <article className="store-card" key={tienda._id}>
                  <div className="store-main">
                    <span className="store-badge">{tienda.regional || 'Sin regional'}</span>
                    <h4>{tienda.nombre}</h4>
                    <p>{tienda.departamento} · {tienda.ciudad}</p>
                  </div>

                  <div className="store-actions">
                    <button type="button" className="btn soft" onClick={() => abrirHistorial(tienda)}>Historial</button>
                    <button type="button" className="btn ghost" onClick={() => abrirEditar(tienda)}>Editar</button>
                    <button type="button" className="btn danger" onClick={() => eliminarTienda(tienda)}>Eliminar</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {modalOpen && createPortal(
        <div className="modal-backdrop" onMouseDown={cerrarModal}>
          <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <p className="eyebrow yellow">{editing ? 'Editar tienda' : 'Nueva tienda'}</p>
                <h3>{editing ? editing.nombre : 'Agregar tienda'}</h3>
              </div>
              <button type="button" className="icon-btn" onClick={cerrarModal}>×</button>
            </div>

            <form className="form-grid" onSubmit={guardarTienda}>
              <label>
                <span>Nombre de tienda</span>
                <input
                  value={form.nombre}
                  onChange={(e) => actualizarCampo('nombre', e.target.value)}
                  placeholder="Ej. D1 Suba Centro"
                  autoComplete="off"
                />
              </label>

              <label>
                <span>Regional</span>
                <input
                  value={form.regional}
                  onChange={(e) => actualizarCampo('regional', e.target.value)}
                  placeholder="Ej. Centro"
                  autoComplete="off"
                />
              </label>

              <label>
                <span>Departamento</span>
                <input
                  value={form.departamento}
                  onChange={(e) => actualizarCampo('departamento', e.target.value)}
                  placeholder="Ej. Cundinamarca"
                  autoComplete="off"
                />
              </label>

              <label>
                <span>Ciudad</span>
                <input
                  value={form.ciudad}
                  onChange={(e) => actualizarCampo('ciudad', e.target.value)}
                  placeholder="Ej. Bogotá"
                  autoComplete="off"
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={cerrarModal} disabled={saving}>Cancelar</button>
                <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {historyOpen && createPortal(
        <div className="modal-backdrop" onMouseDown={cerrarHistorial}>
          <div className="modal-card wide" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <p className="eyebrow yellow">Historial por tienda</p>
                <h3>{historyTienda?.nombre || 'Tienda'}</h3>
                <p className="muted small">{historyTienda?.departamento} · {historyTienda?.ciudad}</p>
              </div>
              <button type="button" className="icon-btn" onClick={cerrarHistorial}>×</button>
            </div>

            {historyLoading ? (
              <div className="empty-state">Cargando historial...</div>
            ) : historyError ? (
              <div className="alert error">
                {historyError}
                <br />
                Para activar el historial por tienda, agrega el endpoint de backend indicado.
              </div>
            ) : historyItems.length === 0 ? (
              <div className="empty-state">Esta tienda todavía no tiene informes asociados.</div>
            ) : (
              <div className="history-list">
                {historyItems.map((informe) => {
                  const url = informe.shareUrl || informe.url;

                  return (
                    <article className="history-card" key={informe._id}>
                      <div>
                        <h4>{informe.title || 'Informe técnico'}</h4>
                        <p className="muted small">Incidencia: {informe.numeroIncidencia || 'Sin incidencia'}</p>
                        <p className="muted small">Regional: {informe.regional || historyTienda?.regional || 'Sin regional'}</p>
                        <p className="muted small">Generado: {formatearFecha(informe.createdAt)}</p>
                      </div>

                      <div className="history-actions">
                        {url && (
                          <a className="btn soft" href={url} target="_blank" rel="noreferrer">Abrir PDF</a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #070b13;
        }

        .tiendas-page {
          min-height: 100vh;
          padding: 24px 0 54px;
          color: #f7f7f7;
          background:
            radial-gradient(circle at top left, rgba(255, 242, 0, 0.16), transparent 32%),
            radial-gradient(circle at bottom right, rgba(35, 90, 255, 0.18), transparent 34%),
            linear-gradient(135deg, #070b13 0%, #0d1422 48%, #111827 100%);
          position: relative;
          overflow-x: hidden;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .bg-orb {
          position: fixed;
          width: 260px;
          height: 260px;
          border-radius: 999px;
          filter: blur(18px);
          pointer-events: none;
          opacity: 0.32;
        }

        .orb-one {
          left: -90px;
          top: 110px;
          background: rgba(255, 242, 0, 0.18);
        }

        .orb-two {
          right: -80px;
          bottom: 80px;
          background: rgba(65, 105, 225, 0.22);
        }

        .topbar,
        .dash-container {
          width: min(100% - 32px, 1100px);
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 22px;
        }

        h1,
        h2,
        h3,
        h4,
        p {
          margin: 0;
        }

        h1 {
          font-size: clamp(32px, 7vw, 58px);
          line-height: 0.96;
          letter-spacing: -0.06em;
        }

        h2 {
          font-size: clamp(24px, 4vw, 38px);
          line-height: 1.02;
          letter-spacing: -0.04em;
          margin-top: 6px;
        }

        h3 {
          font-size: 22px;
          letter-spacing: -0.03em;
        }

        h4 {
          font-size: 18px;
          letter-spacing: -0.02em;
        }

        .eyebrow {
          color: #b8bcc3;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .yellow {
          color: #fff200;
        }

        .muted {
          color: #b8bcc3;
          margin-top: 8px;
          line-height: 1.5;
        }

        .small {
          font-size: 13px;
        }

        .top-actions,
        .store-actions,
        .modal-actions,
        .history-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .session-chip {
          min-height: 42px;
          padding: 0 14px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          font-weight: 800;
        }

        .btn {
          min-height: 42px;
          border: 0;
          border-radius: 14px;
          padding: 0 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
          transition: transform 0.18s ease, opacity 0.18s ease, border-color 0.18s ease;
          color: #fff;
          white-space: nowrap;
        }

        .btn:hover {
          transform: translateY(-1px);
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .btn.primary {
          background: #fff200;
          color: #090909;
          box-shadow: 0 16px 34px rgba(255, 242, 0, 0.18);
        }

        .btn.big {
          min-height: 52px;
          border-radius: 18px;
          padding: 0 24px;
        }

        .btn.ghost {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.14);
        }

        .btn.soft {
          background: rgba(255, 242, 0, 0.12);
          border: 1px solid rgba(255, 242, 0, 0.22);
          color: #fff200;
        }

        .btn.danger {
          background: rgba(255, 80, 80, 0.12);
          border: 1px solid rgba(255, 80, 80, 0.22);
          color: #ffb3b3;
        }

        .hero-card,
        .panel-card,
        .store-card,
        .modal-card,
        .history-card,
        .alert,
        .empty-state {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 24px 90px rgba(0, 0, 0, 0.26);
          backdrop-filter: blur(18px);
        }

        .hero-card {
          border-radius: 28px;
          padding: 26px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }

        .panel-card {
          border-radius: 28px;
          padding: 20px;
        }

        .section-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }

        .search-wrap {
          width: min(100%, 420px);
        }

        input {
          width: 100%;
          min-height: 48px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          border-radius: 16px;
          padding: 0 14px;
          font: inherit;
          outline: none;
        }

        input::placeholder {
          color: #8d94a3;
        }

        input:focus {
          border-color: rgba(255, 242, 0, 0.45);
          box-shadow: 0 0 0 4px rgba(255, 242, 0, 0.12);
        }

        .alert {
          border-radius: 18px;
          padding: 14px 16px;
          margin-bottom: 16px;
          font-weight: 800;
          line-height: 1.4;
        }

        .alert.error {
          border-color: rgba(255, 80, 80, 0.24);
          color: #ffd0d0;
        }

        .alert.success {
          border-color: rgba(108, 255, 169, 0.22);
          color: #c7ffd9;
        }

        .empty-state {
          border-radius: 22px;
          padding: 22px;
          color: #b8bcc3;
          text-align: center;
        }

        .store-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .store-card {
          border-radius: 22px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          justify-content: space-between;
        }

        .store-main {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .store-main p {
          color: #b8bcc3;
        }

        .store-badge {
          width: fit-content;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          background: rgba(255, 242, 0, 0.12);
          border: 1px solid rgba(255, 242, 0, 0.22);
          color: #fff200;
          font-size: 12px;
          font-weight: 900;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
          padding: 18px;
          background: rgba(0, 0, 0, 0.68);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-card {
          width: min(100%, 560px);
          max-height: min(88vh, 760px);
          overflow: auto;
          border-radius: 28px;
          padding: 20px;
        }

        .modal-card.wide {
          width: min(100%, 820px);
        }

        .modal-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 18px;
        }

        .icon-btn {
          width: 42px;
          height: 42px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          font-size: 26px;
          line-height: 1;
          cursor: pointer;
        }

        .form-grid {
          display: grid;
          gap: 14px;
        }

        label {
          display: grid;
          gap: 8px;
          color: #d6d8de;
          font-size: 13px;
          font-weight: 800;
        }

        .modal-actions {
          justify-content: flex-end;
          margin-top: 6px;
        }

        .history-list {
          display: grid;
          gap: 12px;
        }

        .history-card {
          border-radius: 18px;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        @media (max-width: 780px) {
          .topbar,
          .hero-card,
          .section-head,
          .history-card {
            flex-direction: column;
            align-items: stretch;
          }

          .top-actions,
          .store-actions,
          .modal-actions,
          .history-actions {
            align-items: stretch;
            flex-direction: column;
          }

          .top-actions .btn,
          .store-actions .btn,
          .modal-actions .btn,
          .history-actions .btn {
            width: 100%;
          }

          .search-wrap {
            width: 100%;
          }

          .store-grid {
            grid-template-columns: 1fr;
          }

          .hero-card,
          .panel-card,
          .modal-card {
            border-radius: 24px;
          }
        }

        @media (max-width: 420px) {
          .topbar,
          .dash-container {
            width: min(100% - 22px, 1100px);
          }

          .tiendas-page {
            padding-top: 18px;
          }
        }
      `}</style>
    </div>
  );
}

export default TiendasPage;