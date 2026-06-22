import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { http } from '../services/http';

const emptyForm = {
  usuario: '',
  nombre: '',
  contraseña: '',
  rol: 'tecnico',
  activo: true
};

const UsuariosPage = () => {
  const navigate = useNavigate();

  const [usuarios, setUsuarios] = useState([]);
  const [search, setSearch] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    usuario: '',
    nombre: '',
    rol: 'tecnico',
    activo: true
  });

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    id: '',
    usuario: '',
    contraseña: '',
    confirmar: ''
  });

  const token = localStorage.getItem('token') || '';
  const isAdmin = localStorage.getItem('isAdmin') === '1' || localStorage.getItem('isAdmin') === 'true';
  const nombreTecnico = localStorage.getItem('nombreTecnico') || 'Admin';

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

  const cargarUsuarios = useCallback(async () => {
    setLoading(true);
    setMensaje('');

    try {
      const data = await http.get('/usuarios');
      const lista = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

      setUsuarios(lista);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      setMensaje(err?.response?.data?.error || err?.response?.data?.mensaje || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }

    if (!isAdmin) {
      navigate('/dashboard');
    }
  }, [token, isAdmin, navigate]);

  useEffect(() => {
    if (token && isAdmin) {
      cargarUsuarios();
    }
  }, [token, isAdmin, cargarUsuarios]);

  const usuariosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return usuarios;

    return usuarios.filter((u) => {
      return [
        u.usuario,
        u.nombre,
        u.rol,
        u.activo ? 'activo' : 'inactivo'
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [usuarios, search]);

  const handleCerrarSesion = () => {
    limpiarSesionLocal();
    navigate('/');
  };

  const abrirCrear = () => {
    setCreateForm(emptyForm);
    setCreateOpen(true);
    setMensaje('');
  };

  const abrirEditar = (usuario) => {
    setEditForm({
      id: usuario._id,
      usuario: usuario.usuario || '',
      nombre: usuario.nombre || '',
      rol: usuario.rol || 'tecnico',
      activo: usuario.activo !== false
    });

    setEditOpen(true);
    setMensaje('');
  };

  const abrirPassword = (usuario) => {
    setPasswordForm({
      id: usuario._id,
      usuario: usuario.usuario || '',
      contraseña: '',
      confirmar: ''
    });

    setPasswordOpen(true);
    setMensaje('');
  };

  const crearUsuario = async () => {
    if (!createForm.usuario.trim()) {
      setMensaje('El usuario es obligatorio');
      return;
    }

    if (!createForm.contraseña || createForm.contraseña.length < 8) {
      setMensaje('La contraseña debe tener minimo 8 caracteres');
      return;
    }

    setCreating(true);
    setMensaje('');

    try {
      await http.post('/usuarios', {
        usuario: createForm.usuario.trim(),
        nombre: createForm.nombre.trim(),
        contraseña: createForm.contraseña,
        rol: createForm.rol,
        activo: createForm.activo
      });

      setCreateOpen(false);
      setCreateForm(emptyForm);
      setMensaje('Usuario creado correctamente');
      await cargarUsuarios();
    } catch (err) {
      setMensaje(err?.response?.data?.error || err?.response?.data?.mensaje || 'No se pudo crear el usuario');
    } finally {
      setCreating(false);
    }
  };

  const guardarEdicion = async () => {
    if (!editForm.id) return;

    if (!editForm.usuario.trim()) {
      setMensaje('El usuario es obligatorio');
      return;
    }

    setEditing(true);
    setMensaje('');

    try {
      await http.put(`/usuarios/${editForm.id}`, {
        usuario: editForm.usuario.trim(),
        nombre: editForm.nombre.trim(),
        rol: editForm.rol,
        activo: editForm.activo
      });

      setEditOpen(false);
      setMensaje('Usuario actualizado correctamente');
      await cargarUsuarios();
    } catch (err) {
      setMensaje(err?.response?.data?.error || err?.response?.data?.mensaje || 'No se pudo actualizar el usuario');
    } finally {
      setEditing(false);
    }
  };

  const cambiarPassword = async () => {
    if (!passwordForm.id) return;

    if (!passwordForm.contraseña || passwordForm.contraseña.length < 8) {
      setMensaje('La nueva contraseña debe tener minimo 8 caracteres');
      return;
    }

    if (passwordForm.contraseña !== passwordForm.confirmar) {
      setMensaje('Las contraseñas no coinciden');
      return;
    }

    setChangingPassword(true);
    setMensaje('');

    try {
      await http.patch(`/usuarios/${passwordForm.id}/password`, {
        contraseña: passwordForm.contraseña
      });

      setPasswordOpen(false);
      setMensaje('Contraseña actualizada correctamente');
    } catch (err) {
      setMensaje(err?.response?.data?.error || err?.response?.data?.mensaje || 'No se pudo cambiar la contraseña');
    } finally {
      setChangingPassword(false);
    }
  };

  const cambiarEstado = async (usuario) => {
    setMensaje('');

    try {
      await http.patch(`/usuarios/${usuario._id}/status`, {
        activo: usuario.activo === false
      });

      await cargarUsuarios();
      setMensaje(usuario.activo === false ? 'Usuario activado correctamente' : 'Usuario desactivado correctamente');
    } catch (err) {
      setMensaje(err?.response?.data?.error || err?.response?.data?.mensaje || 'No se pudo cambiar el estado');
    }
  };

  return (
    <div className="page-root">
      <header className="topbar">
        <div>
          <h1>Usuarios</h1>
          <p>{nombreTecnico}</p>
        </div>

        <div className="top-actions">
          <button type="button" className="btn ghost" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>

          <button type="button" className="btn ghost" onClick={() => navigate('/informes')}>
            Informes
          </button>

          <button type="button" className="btn danger" onClick={handleCerrarSesion}>
            Cerrar sesion
          </button>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <div>
            <h2>Gestion de usuarios</h2>
            <p>Administra tecnicos, roles, estados y contraseñas.</p>
          </div>

          <button type="button" className="btn primary" onClick={abrirCrear}>
            Nuevo usuario
          </button>
        </section>

        <section className="card">
          <div className="toolbar">
            <div className="field">
              <label>Buscar</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, usuario, rol o estado"
              />
            </div>

            <button type="button" className="btn ghost" onClick={cargarUsuarios} disabled={loading}>
              {loading ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>

          {mensaje && <p className="message">{mensaje}</p>}
        </section>

        <section className="list">
          {loading && (
            <div className="card empty">
              <p>Cargando usuarios...</p>
            </div>
          )}

          {!loading && usuariosFiltrados.length === 0 && (
            <div className="card empty">
              <p>No hay usuarios para mostrar.</p>
            </div>
          )}

          {!loading && usuariosFiltrados.map((usuario) => (
            <article className="card user-card" key={usuario._id}>
              <div className="user-main">
                <div>
                  <h3>{usuario.nombre || 'Sin nombre'}</h3>
                  <p>{usuario.usuario}</p>
                </div>

                <div className="badges">
                  <span className={`badge ${usuario.rol === 'admin' ? 'admin' : ''}`}>
                    {usuario.rol === 'admin' ? 'Admin' : 'Tecnico'}
                  </span>

                  <span className={`badge ${usuario.activo === false ? 'inactive' : 'active'}`}>
                    {usuario.activo === false ? 'Inactivo' : 'Activo'}
                  </span>
                </div>
              </div>

              <div className="meta">
                <div>
                  <span>Creado</span>
                  <strong>{usuario.createdAt ? new Date(usuario.createdAt).toLocaleDateString('es-CO') : '-'}</strong>
                </div>

                <div>
                  <span>Actualizado</span>
                  <strong>{usuario.updatedAt ? new Date(usuario.updatedAt).toLocaleDateString('es-CO') : '-'}</strong>
                </div>
              </div>

              <div className="actions-row">
                <button type="button" className="btn ghost" onClick={() => abrirEditar(usuario)}>
                  Editar
                </button>

                <button type="button" className="btn ghost" onClick={() => abrirPassword(usuario)}>
                  Cambiar contraseña
                </button>

                <button
                  type="button"
                  className={usuario.activo === false ? 'btn primary' : 'btn danger'}
                  onClick={() => cambiarEstado(usuario)}
                >
                  {usuario.activo === false ? 'Activar' : 'Desactivar'}
                </button>
              </div>
            </article>
          ))}
        </section>
      </main>

      {createOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Nuevo usuario</h3>

            <div className="field">
              <label>Usuario</label>
              <input
                type="text"
                value={createForm.usuario}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, usuario: e.target.value }))}
                placeholder="usuario"
              />
            </div>

            <div className="field">
              <label>Nombre</label>
              <input
                type="text"
                value={createForm.nombre}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Nombre completo"
              />
            </div>

            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                value={createForm.contraseña}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, contraseña: e.target.value }))}
                placeholder="Minimo 8 caracteres"
              />
            </div>

            <div className="field">
              <label>Rol</label>
              <select
                value={createForm.rol}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, rol: e.target.value }))}
              >
                <option value="tecnico">Tecnico</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <label className="check">
              <input
                type="checkbox"
                checked={createForm.activo}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, activo: e.target.checked }))}
              />
              Usuario activo
            </label>

            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancelar
              </button>

              <button type="button" className="btn primary" onClick={crearUsuario} disabled={creating}>
                {creating ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Editar usuario</h3>

            <div className="field">
              <label>Usuario</label>
              <input
                type="text"
                value={editForm.usuario}
                onChange={(e) => setEditForm((prev) => ({ ...prev, usuario: e.target.value }))}
              />
            </div>

            <div className="field">
              <label>Nombre</label>
              <input
                type="text"
                value={editForm.nombre}
                onChange={(e) => setEditForm((prev) => ({ ...prev, nombre: e.target.value }))}
              />
            </div>

            <div className="field">
              <label>Rol</label>
              <select
                value={editForm.rol}
                onChange={(e) => setEditForm((prev) => ({ ...prev, rol: e.target.value }))}
              >
                <option value="tecnico">Tecnico</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <label className="check">
              <input
                type="checkbox"
                checked={editForm.activo}
                onChange={(e) => setEditForm((prev) => ({ ...prev, activo: e.target.checked }))}
              />
              Usuario activo
            </label>

            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setEditOpen(false)} disabled={editing}>
                Cancelar
              </button>

              <button type="button" className="btn primary" onClick={guardarEdicion} disabled={editing}>
                {editing ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Cambiar contraseña</h3>
            <p className="modal-subtitle">{passwordForm.usuario}</p>

            <div className="field">
              <label>Nueva contraseña</label>
              <input
                type="password"
                value={passwordForm.contraseña}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, contraseña: e.target.value }))}
                placeholder="Minimo 8 caracteres"
              />
            </div>

            <div className="field">
              <label>Confirmar contraseña</label>
              <input
                type="password"
                value={passwordForm.confirmar}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmar: e.target.value }))}
                placeholder="Repite la contraseña"
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setPasswordOpen(false)} disabled={changingPassword}>
                Cancelar
              </button>

              <button type="button" className="btn primary" onClick={cambiarPassword} disabled={changingPassword}>
                {changingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        *, *::before, *::after {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #0f1113;
        }

        .page-root {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(255, 242, 0, 0.12), transparent 28%),
            linear-gradient(180deg, #101317 0%, #0b0d10 100%);
          color: #f4f4f5;
          font-family: Inter, Roboto, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
        }

        .topbar {
          width: min(1180px, calc(100% - 32px));
          margin: 0 auto;
          padding: 22px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .topbar h1 {
          margin: 0;
          font-size: clamp(22px, 3vw, 34px);
          letter-spacing: -0.04em;
        }

        .topbar p {
          margin: 4px 0 0;
          color: #b8bcc3;
          font-size: 14px;
        }

        .top-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .container {
          width: min(980px, calc(100% - 32px));
          margin: 0 auto;
          padding: 10px 0 48px;
        }

        .hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
          padding: 24px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(18px);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
        }

        .hero h2 {
          margin: 0;
          font-size: clamp(24px, 4vw, 42px);
          letter-spacing: -0.05em;
        }

        .hero p {
          margin: 8px 0 0;
          color: #c5c8ce;
          line-height: 1.5;
        }

        .card {
          background: rgba(255, 255, 255, 0.075);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 22px;
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.32);
          backdrop-filter: blur(22px);
          padding: 18px;
        }

        .toolbar {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
          align-items: end;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
        }

        .field label {
          font-size: 13px;
          color: #d7d9dd;
          font-weight: 700;
        }

        input,
        select {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.08);
          color: #f5f5f5;
          border-radius: 16px;
          padding: 14px 16px;
          font-size: 15px;
          outline: none;
          transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }

        select {
          cursor: pointer;
        }

        input:focus,
        select:focus {
          border-color: rgba(255, 242, 0, 0.45);
          box-shadow: 0 0 0 4px rgba(255, 242, 0, 0.12);
          background: rgba(255, 255, 255, 0.1);
        }

        .btn {
          min-height: 44px;
          border: 0;
          border-radius: 14px;
          padding: 0 18px;
          font-weight: 800;
          cursor: pointer;
          color: #111;
          transition: transform 120ms ease, opacity 120ms ease, box-shadow 160ms ease;
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .btn:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .btn.primary {
          background: #fff200;
          box-shadow: 0 12px 28px rgba(255, 242, 0, 0.16);
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
          margin: 12px 0 0;
          padding: 12px 14px;
          border-radius: 14px;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.08);
          color: #f1f1f1;
        }

        .list {
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .empty {
          text-align: center;
          color: #c5c8ce;
        }

        .user-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .user-main {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
        }

        .user-main h3 {
          margin: 0;
          font-size: 22px;
          letter-spacing: -0.03em;
        }

        .user-main p {
          margin: 5px 0 0;
          color: #c5c8ce;
        }

        .badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: #fff;
        }

        .badge.admin {
          background: rgba(255, 242, 0, 0.13);
          border-color: rgba(255, 242, 0, 0.28);
          color: #fff200;
        }

        .badge.active {
          background: rgba(38, 201, 111, 0.14);
          border-color: rgba(38, 201, 111, 0.28);
          color: #aef2ca;
        }

        .badge.inactive {
          background: rgba(255, 74, 74, 0.14);
          border-color: rgba(255, 74, 74, 0.24);
          color: #ffb7b7;
        }

        .meta {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .meta div {
          padding: 12px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .meta span {
          display: block;
          color: #b8bcc3;
          font-size: 12px;
          margin-bottom: 4px;
        }

        .meta strong {
          color: #fff;
          font-size: 14px;
        }

        .actions-row {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.52);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
        }

        .modal {
          width: min(520px, 100%);
          max-height: calc(100vh - 36px);
          overflow: auto;
          border-radius: 24px;
          background: #15181c;
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 24px 90px rgba(0, 0, 0, 0.46);
          padding: 22px;
        }

        .modal h3 {
          margin: 0 0 18px;
          font-size: 26px;
          letter-spacing: -0.04em;
        }

        .modal-subtitle {
          margin: -10px 0 16px;
          color: #c5c8ce;
          font-weight: 700;
        }

        .check {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #f4f4f5;
          font-weight: 700;
          margin: 8px 0 16px;
        }

        .check input {
          width: 18px;
          height: 18px;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        @media (max-width: 760px) {
          .topbar,
          .hero,
          .user-main,
          .toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .toolbar {
            display: flex;
          }

          .top-actions,
          .actions-row,
          .badges {
            justify-content: stretch;
          }

          .top-actions .btn,
          .actions-row .btn,
          .hero .btn,
          .toolbar .btn {
            width: 100%;
          }

          .meta {
            grid-template-columns: 1fr;
          }
        }


        @media (max-width: 900px) {
          .topbar,
          .container {
            width: min(100% - 24px, 980px);
          }

          .topbar {
            align-items: stretch;
            padding: 18px 0 12px;
          }

          .top-actions {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            width: 100%;
          }

          .top-actions .btn {
            width: 100%;
            padding: 0 10px;
            font-size: 13px;
          }

          .hero {
            align-items: stretch;
            padding: 20px;
          }

          .hero .btn {
            width: 100%;
          }
        }

        @media (max-width: 560px) {
          .page-root {
            background:
              radial-gradient(circle at top left, rgba(255, 242, 0, 0.16), transparent 34%),
              linear-gradient(180deg, #101317 0%, #0b0d10 100%);
          }

          .topbar,
          .container {
            width: min(100% - 20px, 980px);
          }

          .topbar {
            gap: 14px;
          }

          .topbar h1 {
            font-size: 30px;
          }

          .topbar p {
            font-size: 13px;
          }

          .top-actions {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .container {
            padding-bottom: 34px;
          }

          .hero,
          .card {
            border-radius: 20px;
            padding: 16px;
          }

          .hero h2 {
            font-size: 28px;
            line-height: 1.03;
          }

          .hero p {
            font-size: 14px;
          }

          .toolbar {
            gap: 8px;
          }

          .field {
            margin-bottom: 12px;
          }

          .field label {
            font-size: 12px;
          }

          input,
          select {
            min-height: 50px;
            border-radius: 14px;
            padding: 13px 14px;
            font-size: 16px;
          }

          .btn {
            width: 100%;
            min-height: 48px;
            border-radius: 14px;
            padding: 0 14px;
            font-size: 14px;
          }

          .message {
            font-size: 14px;
            line-height: 1.35;
          }

          .list {
            gap: 12px;
          }

          .user-card {
            gap: 12px;
          }

          .user-main {
            gap: 10px;
          }

          .user-main h3 {
            font-size: 20px;
            line-height: 1.12;
          }

          .user-main p {
            font-size: 14px;
            word-break: break-word;
          }

          .badges {
            justify-content: flex-start;
          }

          .badge {
            min-height: 30px;
          }

          .meta div {
            padding: 10px 12px;
          }

          .meta strong {
            font-size: 13px;
          }

          .actions-row {
            flex-direction: column;
            gap: 8px;
          }

          .modal-overlay {
            align-items: flex-end;
            padding: 10px;
          }

          .modal {
            width: 100%;
            max-height: min(88vh, 720px);
            border-radius: 22px 22px 18px 18px;
            padding: 18px;
          }

          .modal h3 {
            font-size: 24px;
            margin-bottom: 16px;
          }

          .modal-actions {
            flex-direction: column-reverse;
            gap: 8px;
          }

          .check {
            align-items: center;
            padding: 10px 0;
          }
        }

        @media (max-width: 380px) {
          .topbar,
          .container {
            width: min(100% - 16px, 980px);
          }

          .hero,
          .card,
          .modal {
            padding: 14px;
          }

          .hero h2 {
            font-size: 25px;
          }

          .user-main h3 {
            font-size: 18px;
          }
        }

      `}</style>
    </div>
  );
};

export default UsuariosPage;