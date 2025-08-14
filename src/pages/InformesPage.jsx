import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'https://cubica-photo-app.onrender.com';

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

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #fff200, #ffffff)',
        fontFamily: 'Roboto, sans-serif',
        paddingTop: '40px',
        position: 'relative'
      }}
    >
      <button
        onClick={handleCerrarSesion}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          backgroundColor: '#007BFF',
          color: '#fff',
          border: 'none',
          padding: '8px 14px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        Cerrar sesión
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1 style={{ color: '#333' }}>Informes</h1>
        <p style={{ marginBottom: '10px' }}>
          Bienvenido, <strong>{nombreTecnico}</strong>
        </p>

        {/* Botón para volver al dashboard */}
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            marginBottom: '20px',
            backgroundColor: '#28a745',
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
          }}
        >
          ← Volver al dashboard
        </button>

        <div
          style={{
            width: '100%',
            maxWidth: '900px',
            background: '#fff',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
            marginBottom: '20px'
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px 140px 140px',
              gap: '10px',
              marginBottom: '16px'
            }}
          >
            <input
              type="text"
              placeholder="Buscar por título"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid #ccc'
              }}
            />
            <select
              value={limit}
              onChange={(e) => {
                setPage(1);
                setLimit(parseInt(e.target.value, 10));
              }}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
            >
              <option value={5}>5 por página</option>
              <option value={10}>10 por página</option>
              <option value={20}>20 por página</option>
              <option value={50}>50 por página</option>
            </select>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '10px',
                backgroundColor: '#ffffff',
                border: '1px solid #ccc',
                color: '#000',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Volver
            </button>
            <button
              onClick={fetchInformes}
              disabled={loading}
              style={{
                padding: '10px',
                backgroundColor: loading ? '#999' : '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              {loading ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #eee' }}>Título</th>
                  <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #eee' }}>Generado por</th>
                  <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #eee' }}>Fecha</th>
                  <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #eee' }}>Incluye acta</th>
                  <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #eee' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {informes.length === 0 && !loading && (
                  <tr>
                    <td colSpan="5" style={{ padding: '14px', color: '#555' }}>
                      No hay informes para mostrar.
                    </td>
                  </tr>
                )}

                {informes.map((inf) => (
                  <tr key={inf._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '10px' }}>{inf.title}</td>
                    <td style={{ padding: '10px' }}>
                      {inf.generatedBy?.name || inf.generatedBy?.email || '—'}
                    </td>
                    <td style={{ padding: '10px' }}>{formatFecha(inf.createdAt)}</td>
                    <td style={{ padding: '10px' }}>{inf.includesActa ? 'Sí' : 'No'}</td>
                    <td style={{ padding: '10px' }}>
                      <button
                        onClick={() => handleVer(inf.url)}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#007BFF',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          marginRight: '8px'
                        }}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '16px'
            }}
          >
            <span style={{ color: '#333' }}>
              Página {page} de {totalPages} • Total: {total}
            </span>
            <div>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                style={{
                  padding: '8px 12px',
                  backgroundColor: page <= 1 || loading ? '#999' : '#fff',
                  color: '#000',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  cursor: page <= 1 || loading ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  marginRight: '8px'
                }}
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                style={{
                  padding: '8px 12px',
                  backgroundColor: page >= totalPages || loading ? '#999' : '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: page >= totalPages || loading ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Siguiente
              </button>
            </div>
          </div>

          {mensaje && (
            <p style={{ marginTop: '12px', color: '#333' }}>
              {mensaje}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default InformesPage;
