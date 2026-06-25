import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { http } from '../services/http';
import informesService from '../services/informesService';

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

const ADVERTENCIA_PERSISTENCIA = 'Este archivo no cuenta con los datos necesarios para ser reconstruido. Solo los informes generados a partir del 25/06/2026 podrán ser editados.';

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
    includesActa: false,
    motivo: '',
    fotosPrevias: [],
    fotosPosteriores: [],
    acta: [],
    actaImagenes: [],
    fuentesPersistentes: true
  });

  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsInforme, setVersionsInforme] = useState(null);
  const [versiones, setVersiones] = useState([]);
  const [versionsMensaje, setVersionsMensaje] = useState('');

  const token = localStorage.getItem('token') || '';
  const nombreTecnico = localStorage.getItem('nombreTecnico') || 'Técnico';
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
      const data = await informesService.listarInformes({
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

  const getTituloInforme = (inf) => {
    const tiendaNombre = (inf?.tiendaNombre || inf?.tiendaId?.nombre || '').toString().trim();

    return tiendaNombre ? `INFORME TÉCNICO - ${tiendaNombre}` : inf?.title || 'Informe técnico';
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

  const puedeReconstruirInforme = (inf) => Boolean(inf?.fuentesPersistentes);

  const handleEditFiles = (field, fileList, multiple = true) => {
    const archivos = Array.from(fileList || []);

    setEditData((prev) => ({
      ...prev,
      [field]: multiple ? archivos : archivos.slice(0, 1)
    }));
  };

  const resumenArchivos = (archivos, emptyText) => {
    const lista = Array.isArray(archivos) ? archivos : [];

    if (lista.length === 0) return emptyText;

    if (lista.length === 1) return lista[0]?.name || '1 archivo seleccionado';

    return `${lista.length} archivos seleccionados`;
  };


  const getVersionUrl = (version) => (
    version?.pdf?.url ||
    version?.url ||
    version?.shareUrl ||
    ''
  );

  const getEditorVersion = (version) => (
    version?.editadoPor?.nombre ||
    version?.editadoPor?.usuario ||
    version?.generatedBy?.nombre ||
    version?.generatedBy?.usuario ||
    '-'
  );

  const getCambiosVersion = (version) => {
    const cambios = Array.isArray(version?.cambios) ? version.cambios : [];

    return cambios.filter((cambio) => cambio?.campo).slice(0, 4);
  };

  const cerrarVersiones = () => {
    if (versionsLoading) return;

    setVersionsOpen(false);
    setVersionsInforme(null);
    setVersiones([]);
    setVersionsMensaje('');
  };

  const handleVersiones = async (inf) => {
    if (!inf?._id) return;

    setVersionsInforme(inf);
    setVersiones([]);
    setVersionsMensaje('');
    setVersionsOpen(true);
    setVersionsLoading(true);

    try {
      const data = await informesService.listarVersionesInforme(inf._id, {
        page: 1,
        limit: 50
      });

      const lista = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.versiones)
          ? data.versiones
          : [];

      setVersiones(lista);

      if (lista.length === 0) {
        setVersionsMensaje('Este informe no tiene versiones anteriores guardadas.');
      }
    } catch (err) {
      console.error('Error cargando versiones del informe:', err);
      setVersionsMensaje(err?.response?.data?.error || err?.response?.data?.mensaje || 'No se pudieron cargar las versiones del informe');
    } finally {
      setVersionsLoading(false);
    }
  };

  const askDelete = (inf) => {
    setToDelete(inf);
    setConfirmOpen(true);
  };

  const handleEdit = (inf) => {
    setMensaje('');

    setEditData({
      id: inf._id,
      title: inf.title || '',
      numeroIncidencia: inf.numeroIncidencia || '',
      regional: inf.regional || '',
      includesActa: Boolean(inf.includesActa),
      motivo: '',
      fotosPrevias: [],
      fotosPosteriores: [],
      acta: [],
      actaImagenes: [],
      fuentesPersistentes: puedeReconstruirInforme(inf)
    });

    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editData.id || !editData.fuentesPersistentes) return;

    setEditing(true);
    setMensaje('');

    try {
      const payload = {
        title: editData.title,
        numeroIncidencia: editData.numeroIncidencia,
        regional: editData.regional,
        includesActa: editData.includesActa,
        motivo: editData.motivo,
        fotosPrevias: editData.fotosPrevias,
        fotosPosteriores: editData.fotosPosteriores,
        acta: editData.acta,
        actaImagenes: editData.actaImagenes
      };

      delete payload.geolocalizacion;
      delete payload.actualizarGeolocalizacion;
      delete payload.actualizarGPS;
      delete payload.actualizarGps;

      await informesService.editarInformeAvanzado(editData.id, payload);

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
      await informesService.eliminarInforme(toDelete._id);

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
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <div>
            <span className="eyebrow">Cubica PDF App</span>
            <h2>{isAdmin ? 'Gestión de informes' : 'Tus informes generados'}</h2>
            <p>
              Consulta, filtra y revisa los informes técnicos generados desde la aplicación.
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
            <p>Filtra por título, incidencia o regional.</p>
          </div>

          <div className="controls-grid">
            <div className="field">
              <label>Buscar por título</label>
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
                <option value={5}>5 por página</option>
                <option value={10}>10 por página</option>
                <option value={20}>20 por página</option>
                <option value={50}>50 por página</option>
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
                    <h3>{getTituloInforme(inf)}</h3>
                    <p>{formatFecha(inf.createdAt)}</p>
                  </div>

                  <div className="badges">
                    {inf.includesActa && <span className="badge">Incluye acta</span>}
                    {inf.fuentesPersistentes ? (
                      <span className="badge success">Editable</span>
                    ) : (
                      <span className="badge warning">Sin reconstrucción</span>
                    )}
                  </div>
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

                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => handleVersiones(inf)}
                    disabled={versionsLoading && versionsInforme?._id === inf._id}
                  >
                    Versiones
                  </button>

                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => handleEdit(inf)}
                        title="Editar informe"
                      >
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
            <span>Página {page} de {totalPages}</span>
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
        message={toDelete ? `¿Seguro que deseas eliminar "${getTituloInforme(toDelete)}"? Esta acción no se puede deshacer.` : ''}
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
        <div className="modal-overlay" role="presentation" onClick={() => { if (!editing) setEditOpen(false); }}>
          <div className="modal-panel edit-modal-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Editar informe</h3>
            <p className="modal-msg">
              {editData.fuentesPersistentes
                ? 'Actualiza la información visible del informe. También puedes reemplazar las fotos o el acta.'
                : 'Este informe se puede consultar, pero no se puede reconstruir desde sus fuentes originales.'}
            </p>

            {!editData.fuentesPersistentes && (
              <div className="edit-warning" role="alert">
                {ADVERTENCIA_PERSISTENCIA}
              </div>
            )}

            <div className="field">
              <label>Título</label>
              <input
                value={editData.title}
                disabled={!editData.fuentesPersistentes || editing}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    title: e.target.value
                  }))
                }
              />
            </div>

            <div className="field">
              <label>Número de incidencia</label>
              <input
                value={editData.numeroIncidencia}
                disabled={!editData.fuentesPersistentes || editing}
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
                disabled={!editData.fuentesPersistentes || editing}
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
                disabled={!editData.fuentesPersistentes || editing}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    includesActa: e.target.checked
                  }))
                }
              />
              Incluye acta
            </label>

            <div className="field">
              <label>Motivo de edición</label>
              <textarea
                value={editData.motivo}
                disabled={!editData.fuentesPersistentes || editing}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    motivo: e.target.value
                  }))
                }
                placeholder="Ej: corrección de incidencia o reemplazo de evidencia"
              />
            </div>

            <div className="edit-note">
              Si no seleccionas archivos nuevos, se conservarán las evidencias actuales.
            </div>

            <div className="edit-files-grid">
              <div className="file-box">
                <label>Reemplazar fotos del antes</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={!editData.fuentesPersistentes || editing}
                  onChange={(e) => handleEditFiles('fotosPrevias', e.target.files)}
                />
                <small>{resumenArchivos(editData.fotosPrevias, 'No seleccionaste fotos nuevas')}</small>
              </div>

              <div className="file-box">
                <label>Reemplazar fotos del después</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={!editData.fuentesPersistentes || editing}
                  onChange={(e) => handleEditFiles('fotosPosteriores', e.target.files)}
                />
                <small>{resumenArchivos(editData.fotosPosteriores, 'No seleccionaste fotos nuevas')}</small>
              </div>

              <div className="file-box">
                <label>Reemplazar acta PDF o imagen</label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  disabled={!editData.fuentesPersistentes || editing}
                  onChange={(e) => handleEditFiles('acta', e.target.files, false)}
                />
                <small>{resumenArchivos(editData.acta, 'No seleccionaste acta nueva')}</small>
              </div>

              <div className="file-box">
                <label>Reemplazar imágenes del acta</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={!editData.fuentesPersistentes || editing}
                  onChange={(e) => handleEditFiles('actaImagenes', e.target.files)}
                />
                <small>{resumenArchivos(editData.actaImagenes, 'No seleccionaste imágenes nuevas')}</small>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setEditOpen(false)}
                disabled={editing}
              >
                {editData.fuentesPersistentes ? 'Cancelar' : 'Cerrar'}
              </button>

              <button
                type="button"
                className="btn primary"
                onClick={saveEdit}
                disabled={editing || !editData.fuentesPersistentes}
              >
                {!editData.fuentesPersistentes ? 'No editable' : editing ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}



      {versionsOpen && createPortal(
        <div className="modal-overlay" role="presentation" onClick={cerrarVersiones}>
          <div className="modal-panel versions-modal-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="versions-head">
              <div>
                <h3 className="modal-title">Versiones del informe</h3>
                <p className="modal-msg">
                  {versionsInforme ? getTituloInforme(versionsInforme) : 'Informe técnico'}
                </p>
              </div>

              <button type="button" className="btn ghost" onClick={cerrarVersiones} disabled={versionsLoading}>
                Cerrar
              </button>
            </div>

            {versionsInforme && (
              <div className="version-current-card">
                <div>
                  <span>Versión actual</span>
                  <strong>{versionsInforme.versionActual || 1}</strong>
                  <p>{formatFecha(versionsInforme.editadoEn || versionsInforme.createdAt)}</p>
                </div>

                <button
                  type="button"
                  className="btn primary"
                  onClick={() => handleVer(versionsInforme.shareUrl || versionsInforme.url)}
                  disabled={!versionsInforme.shareUrl && !versionsInforme.url}
                >
                  Ver PDF actual
                </button>
              </div>
            )}

            {versionsLoading && (
              <div className="versions-loading">
                Cargando versiones...
              </div>
            )}

            {!versionsLoading && versionsMensaje && (
              <div className="edit-note">
                {versionsMensaje}
              </div>
            )}

            {!versionsLoading && versiones.length > 0 && (
              <div className="versions-list">
                {versiones.map((version) => {
                  const versionUrl = getVersionUrl(version);
                  const cambios = getCambiosVersion(version);

                  return (
                    <article className="version-card" key={version._id || version.version}>
                      <div className="version-card-header">
                        <div>
                          <span>Versión anterior</span>
                          <strong>Versión {version.version || '-'}</strong>
                        </div>

                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => handleVer(versionUrl)}
                          disabled={!versionUrl}
                        >
                          Ver PDF
                        </button>
                      </div>

                      <div className="version-meta-grid">
                        <div>
                          <span>Fecha</span>
                          <strong>{formatFecha(version.createdAt)}</strong>
                        </div>

                        <div>
                          <span>Editado por</span>
                          <strong>{getEditorVersion(version)}</strong>
                        </div>

                        <div>
                          <span>Incidencia</span>
                          <strong>{formatIncidencia(version.numeroIncidencia)}</strong>
                        </div>
                      </div>

                      {version.motivo && (
                        <p className="version-motivo">
                          {version.motivo}
                        </p>
                      )}

                      {cambios.length > 0 && (
                        <div className="version-changes">
                          {cambios.map((cambio, index) => (
                            <span key={`${version._id || version.version}-${cambio.campo}-${index}`}>
                              {cambio.campo}
                            </span>
                          ))}
                        </div>
                      )}
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
        select,
        textarea {
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

        textarea {
          min-height: 94px;
          padding: 14px 16px;
          resize: vertical;
          font-family: inherit;
          line-height: 1.35;
        }

        input:focus,
        select:focus,
        textarea:focus {
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

        .badges {
          display: flex;
          align-items: flex-start;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .badge.success {
          background: rgba(74, 222, 128, 0.12);
          border-color: rgba(74, 222, 128, 0.26);
          color: #b8f7ca;
        }

        .badge.warning {
          background: rgba(255, 180, 72, 0.12);
          border-color: rgba(255, 180, 72, 0.28);
          color: #ffd89a;
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
          overscroll-behavior: contain;
          border-radius: 26px;
          background: rgba(21, 24, 28, 0.96);
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 24px 90px rgba(0, 0, 0, 0.46);
          padding: 22px;
          animation: pop 150ms ease-out;
        }

        .edit-modal-panel {
          width: min(720px, 100%);
          padding-bottom: 18px;
        }

        .versions-modal-panel {
          width: min(860px, 100%);
          padding-bottom: 22px;
        }

        .versions-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 14px;
        }

        .versions-head .modal-msg {
          margin-bottom: 0;
        }

        .version-current-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 14px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255, 242, 0, 0.1);
          border: 1px solid rgba(255, 242, 0, 0.22);
        }

        .version-current-card span,
        .version-card-header span,
        .version-meta-grid span {
          display: block;
          color: #b8bcc3;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .version-current-card strong,
        .version-card-header strong,
        .version-meta-grid strong {
          display: block;
          color: #fff;
          font-size: 15px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .version-current-card p {
          margin: 5px 0 0;
          color: #c5c8ce;
          font-size: 13px;
          font-weight: 800;
        }

        .versions-loading {
          padding: 18px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #f4f4f5;
          font-weight: 900;
          text-align: center;
        }

        .versions-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .version-card {
          padding: 14px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .version-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .version-meta-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .version-meta-grid div {
          min-width: 0;
          padding: 12px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .version-motivo {
          margin: 12px 0 0;
          padding: 12px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #d7d9dd;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.4;
        }

        .version-changes {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
        }

        .version-changes span {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #f4f4f5;
          font-size: 12px;
          font-weight: 900;
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

        .edit-modal-panel .modal-actions {
          position: sticky;
          bottom: -18px;
          z-index: 2;
          margin-left: -22px;
          margin-right: -22px;
          margin-bottom: -18px;
          padding: 14px 22px 18px;
          background: linear-gradient(180deg, rgba(21, 24, 28, 0.78), rgba(21, 24, 28, 0.98) 34%);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
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

        .edit-warning {
          margin: 0 0 14px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255, 193, 7, 0.14);
          border: 1px solid rgba(255, 193, 7, 0.38);
          color: #ffe8a3;
          font-size: 14px;
          font-weight: 900;
          line-height: 1.45;
        }

        .edit-note {
          margin: 8px 0 14px;
          padding: 12px 14px;
          border-radius: 16px;
          background: rgba(255, 242, 0, 0.1);
          border: 1px solid rgba(255, 242, 0, 0.22);
          color: #fff7a1;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.4;
        }

        .edit-files-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .file-box {
          min-width: 0;
          padding: 12px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .file-box label {
          display: block;
          color: #d7d9dd;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .file-box input {
          min-height: 48px;
          padding: 11px;
          font-size: 13px;
        }

        .file-box small {
          display: block;
          margin-top: 8px;
          color: #b8bcc3;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        input:disabled,
        select:disabled,
        textarea:disabled {
          opacity: 0.62;
          cursor: not-allowed;
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
            position: static;
            top: auto;
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

          .edit-files-grid,
          .version-meta-grid {
            grid-template-columns: 1fr;
          }

          .versions-head,
          .version-current-card,
          .version-card-header {
            align-items: stretch;
            flex-direction: column;
          }

          .versions-head .btn,
          .version-current-card .btn,
          .version-card-header .btn {
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
          select,
          textarea {
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
          select,
          textarea {
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
            border-radius: 24px 24px 0 0;
            padding: 16px;
          }

          .edit-modal-panel,
          .versions-modal-panel {
            max-height: calc(100dvh - 8px);
          }

          .edit-modal-panel .modal-actions {
            bottom: -16px;
            margin-left: -16px;
            margin-right: -16px;
            margin-bottom: -16px;
            padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
          }

          .edit-warning,
          .edit-note,
          .file-box,
          .version-card,
          .version-current-card,
          .version-meta-grid div,
          .version-motivo {
            border-radius: 16px;
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