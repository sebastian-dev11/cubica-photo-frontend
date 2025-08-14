import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const DashboardPage = () => {
  const navigate = useNavigate();
  //const [ubicacion, setUbicacion] = useState('');
  const [imagen, setImagen] = useState(null);
  const [tipo, setTipo] = useState('previa');
  const [observacion, setObservacion] = useState('');
  const [acta, setActa] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [mensajeActa, setMensajeActa] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cargandoActa, setCargandoActa] = useState(false);
  const [tiendas, setTiendas] = useState([]);
  const [selectedTienda, setSelectedTienda] = useState('');

  const sesionId = localStorage.getItem('sesionId');
  const nombreTecnico = localStorage.getItem('nombreTecnico') || 'Técnico';

  useEffect(() => {
    if (!sesionId) navigate('/');
  }, [navigate, sesionId]);

  useEffect(() => {
    // Cargar tiendas desde el backend
    const fetchTiendas = async () => {
      try {
        const res = await axios.get('https://cubica-photo-app.onrender.com/tiendas');
        setTiendas(res.data);
      } catch (error) {
        console.error('Error al obtener tiendas del backend:', error);
      }
    };
    fetchTiendas();
  }, []);

  const handleCerrarSesion = () => {
    localStorage.removeItem('sesionId');
    localStorage.removeItem('nombreTecnico');
    navigate('/');
  };

  const handleSubirImagen = async (e) => {
    e.preventDefault();
    if (!imagen || !tipo || !selectedTienda) {
      setMensaje('Por favor completa todos los campos.');
      return;
    }

    const formData = new FormData();
    formData.append('imagen', imagen);
    formData.append('tipo', tipo);
    formData.append('sesionId', sesionId);
    formData.append('ubicacion', selectedTienda);
    formData.append('observacion', observacion);

    setCargando(true);
    try {
      const res = await fetch('https://cubica-photo-app.onrender.com/imagenes/subir', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setMensaje(data.mensaje || 'Imagen y observación enviadas correctamente');

      setImagen(null);
      setObservacion('');
      setTipo('previa');
      document.getElementById('file-input').value = '';
      setTimeout(() => setMensaje(''), 3000);
    } catch (error) {
      console.error(error);
      setMensaje('Error al subir la imagen');
    } finally {
      setCargando(false);
    }
  };

  const handleSubirActa = async (e) => {
    e.preventDefault();
    if (!acta) {
      setMensajeActa('Por favor selecciona un archivo PDF');
      return;
    }

    const formData = new FormData();
    formData.append('acta', acta);
    formData.append('sesionId', sesionId);

    setCargandoActa(true);
    try {
      const res = await fetch('https://cubica-photo-app.onrender.com/acta/subir', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setMensajeActa(res.ok ? 'Acta subida correctamente' : data.mensaje || 'Error al subir el acta');
      setTimeout(() => setMensajeActa(''), 3000);
    } catch (error) {
      console.error(error);
      setMensajeActa('Error en la conexión con el servidor');
    } finally {
      setCargandoActa(false);
    }
  };

  const handleGenerarPDF = () => {
    if (!selectedTienda) {
      setMensaje('Por favor selecciona una tienda para generar el PDF.');
      return;
    }

    const url = `https://cubica-photo-app.onrender.com/pdf/generar/${sesionId}?tiendaId=${selectedTienda}`;
    window.open(url, '_blank');

    setTimeout(() => {
      localStorage.removeItem('sesionId');
      localStorage.removeItem('nombreTecnico');
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

      <button
  onClick={() => navigate('/informes')}
  style={{
    marginTop: '12px',
    padding: '10px 20px',
    backgroundColor: '#ffffff',
    color: '#000',
    border: '1px solid #ccc',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold'
  }}
>
  Ver Informes
</button>

      

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1 style={{ color: '#333' }}>Dashboard</h1>
        <p style={{ marginBottom: '20px' }}>
          Bienvenido, <strong>{nombreTecnico}</strong>
        </p>

        {/* FORMULARIO SUBIR IMAGEN */}
        <form
          onSubmit={handleSubirImagen}
          style={{
            width: '100%',
            maxWidth: '400px',
            background: '#fff',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
            marginBottom: '20px'
          }}
        >
          <div style={{ marginBottom: '10px' }}>
            <label><strong>Ubicación del D1:</strong></label>
            <select
              value={selectedTienda}
              onChange={(e) => setSelectedTienda(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
            >
              <option value="">Selecciona una tienda</option>
              {tiendas.map(tienda => (
                <option key={tienda._id} value={tienda._id}>
                  {tienda.nombre} - {tienda.departamento}, {tienda.ciudad}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label><strong>Selecciona imagen:</strong></label>
            <input
              id="file-input"
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

          <div style={{ marginBottom: '10px' }}>
            <label><strong>Observación (opcional):</strong></label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows="3"
              placeholder="Observación sobre la imagen"
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
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
              fontWeight: 'bold'
            }}
          >
            {cargando ? 'Subiendo...' : 'Subir Imagen'}
          </button>

          {mensaje && <p style={{ marginTop: '10px', color: '#333' }}>{mensaje}</p>}
        </form>

        {/* FORMULARIO SUBIR ACTA */}
        <form
          onSubmit={handleSubirActa}
          style={{
            width: '100%',
            maxWidth: '400px',
            background: '#fff',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
          }}
        >
          <div style={{ marginBottom: '10px' }}>
            <label><strong>Subir Acta (PDF):</strong></label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setActa(e.target.files[0])}
            />
          </div>

          <button
            type="submit"
            disabled={cargandoActa}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: cargandoActa ? '#999' : '#fff200',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              cursor: cargandoActa ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {cargandoActa ? 'Subiendo...' : 'Subir Acta'}
          </button>

          {mensajeActa && <p style={{ marginTop: '10px', color: '#333' }}>{mensajeActa}</p>}
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
    </div>
  );
};

export default DashboardPage;
