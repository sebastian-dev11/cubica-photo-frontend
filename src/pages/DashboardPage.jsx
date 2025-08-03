import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [ubicacion, setUbicacion] = useState('');
  const [imagen, setImagen] = useState(null);
  const [tipo, setTipo] = useState('previa');
  const [observacion, setObservacion] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  const sesionId = localStorage.getItem('sesionId');

  useEffect(() => {
    if (!sesionId) navigate('/');
  }, [navigate, sesionId]);

  const handleCerrarSesion = () => {
    localStorage.removeItem('sesionId');
    navigate('/');
  };

  const handleSubirImagen = async (e) => {
    e.preventDefault();

    if (!imagen || !tipo || !ubicacion) {
      setMensaje('Por favor completa todos los campos.');
      return;
    }

    const formData = new FormData();
    formData.append('imagen', imagen);
    formData.append('tipo', tipo);
    formData.append('sesionId', sesionId);
    formData.append('ubicacion', ubicacion);
    formData.append('observacion', observacion);

    setCargando(true);
    try {
      const res = await fetch('https://cubica-photo-app.onrender.com/imagenes/subir', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      setMensaje(data.mensaje || 'Imagen y observación enviadas correctamente');

      // Limpiar campos
      setImagen(null);
      setObservacion('');
      
      // Limpiar mensaje luego de 3 segundos
      setTimeout(() => setMensaje(''), 3000);
    } catch (error) {
      console.error(error);
      setMensaje('Error al subir la imagen');
    } finally {
      setCargando(false);
    }
  };

  const handleGenerarPDF = () => {
    if (!ubicacion) {
      setMensaje('Por favor ingresa la ubicación para generar el PDF.');
      return;
    }

    const url = `https://cubica-photo-app.onrender.com/pdf/generar/${sesionId}?ubicacion=${encodeURIComponent(ubicacion)}`;
    window.open(url, '_blank');

    setTimeout(() => {
      localStorage.removeItem('sesionId');
      navigate('/');
    }, 1200);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #fff200, #ffffff)',
        fontFamily: 'Roboto, sans-serif',
        paddingTop: '40px',
        position: 'relative',
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
        <h1 style={{ color: '#333' }}>Dashboard</h1>
        <p style={{ marginBottom: '20px' }}>
          Bienvenido, <strong>{sesionId}</strong>
        </p>

        <form
          onSubmit={handleSubirImagen}
          style={{
            width: '100%',
            maxWidth: '400px',
            background: '#fff',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ marginBottom: '10px' }}>
            <label><strong>Ubicación del D1:</strong></label>
            <input
              type="text"
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              required
              placeholder="Ej. D1 El Tejar"
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
            />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label><strong>Selecciona imagen:</strong></label>
            <input
              type="file"
              onChange={(e) => setImagen(e.target.files[0])}
              accept="image/*"
              required
            />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label><strong>Tipo de imagen:</strong></label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
            >
              <option value="previa">Previa</option>
              <option value="posterior">Posterior</option>
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label><strong>Observación (opcional):</strong></label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Observaciones de la imagen"
              rows={3}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid #ccc',
                resize: 'vertical'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: cargando ? '#999' : '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: cargando ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              position: 'relative',
            }}
          >
            {cargando ? (
              <span className="spinner" style={{
                display: 'inline-block',
                width: '18px',
                height: '18px',
                border: '3px solid #fff',
                borderTop: '3px solid transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}></span>
            ) : (
              'Subir Imagen'
            )}
          </button>

          {mensaje && <p style={{ marginTop: '10px', color: '#333' }}>{mensaje}</p>}
        </form>

        <button
          onClick={handleGenerarPDF}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#007BFF',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Generar PDF
        </button>
      </div>

      <style>
        {`@keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }`}
      </style>
    </div>
  );
};

export default DashboardPage;
