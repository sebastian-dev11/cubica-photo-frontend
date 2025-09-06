// src/pages/DashboardPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const BG_URL = "https://blog.generaclatam.com/hubfs/shutterstock_93376264.jpg";

/* =============================
   GlassSelect (custom dropdown con Portal)
============================= */
const GlassSelect = ({
  value,
  onChange,
  options,
  placeholder = 'Selecciona…',
  disabled = false,
  ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 280 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const idx = Math.max(0, options.findIndex(o => o.value === value));
    setActiveIndex(idx === -1 ? 0 : idx);

    // Posicionar el panel justo bajo el trigger (con límites de viewport)
    const rect = triggerRef.current?.getBoundingClientRect?.() || {};
    const vw = window.innerWidth, vh = window.innerHeight;
    const width = Math.min(Math.max(rect.width || 280, 260), 520);
    const left = Math.min(Math.max((rect.left || 0), 8), vw - width - 8);
    const topCandidate = (rect.bottom || 0) + 6;
    setPanelPos({ top: Math.min(topCandidate, vh - 120), left, width });

    setTimeout(() => panelRef.current?.focus?.(), 0);

    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onResize = () => setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open, value, options]);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
    triggerRef.current?.focus?.();
  };

  const onKeyDownTrigger = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onKeyDownPanel = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(options[activeIndex]?.value);
    }
  };

  const selectedLabel = options.find(o => o.value === value)?.label;

  return (
    <div className={`glass-select ${disabled ? 'disabled' : ''}`}>
      <button
        type="button"
        className="select-trigger"
        onClick={() => !disabled && setOpen(true)}
        onKeyDown={onKeyDownTrigger}
        ref={triggerRef}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
      >
        <span className={`selected ${!selectedLabel ? 'placeholder' : ''}`}>
          {selectedLabel || placeholder}
        </span>
        <svg className="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      {open && createPortal(
        <div
          className="dropdown-overlay"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="dropdown-panel"
            role="listbox"
            aria-label={ariaLabel || placeholder}
            tabIndex={0}
            ref={panelRef}
            onKeyDown={onKeyDownPanel}
            style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width }}
            onClick={(e) => e.stopPropagation()}
          >
            {options.length === 0 ? (
              <div className="option empty">Sin opciones</div>
            ) : options.map((opt, idx) => {
              const isSel = value === opt.value;
              const isAct = idx === activeIndex;
              return (
                <div
                  key={String(opt.value) + idx}
                  className={`option ${isSel ? 'selected' : ''} ${isAct ? 'active' : ''}`}
                  role="option"
                  aria-selected={isSel}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleSelect(opt.value)}
                >
                  <span className="label">{opt.label}</span>
                  {isSel && <span className="check">✓</span>}
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

/* =============================
   DashboardPage
============================= */
const DashboardPage = () => {
  const navigate = useNavigate();

  // Imagenes de evidencia
  const [imagen, setImagen] = useState(null);
  const [tipo, setTipo] = useState('previa');
  const [observacion, setObservacion] = useState('');

  // Acta: PDF + imágenes opcionales
  const [acta, setActa] = useState(null);        // PDF opcional
  const [actaImgs, setActaImgs] = useState([]);  // imágenes opcionales

  // Mensajes y carga
  const [mensaje, setMensaje] = useState('');
  const [mensajeActa, setMensajeActa] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cargandoActa, setCargandoActa] = useState(false);

  // Tiendas / filtros
  const [tiendas, setTiendas] = useState([]);
  const [selectedTienda, setSelectedTienda] = useState('');
  const [filtroDepartamento, setFiltroDepartamento] = useState('');
  const [filtroCiudad, setFiltroCiudad] = useState('');

  const sesionId = localStorage.getItem('sesionId');
  const nombreTecnico = localStorage.getItem('nombreTecnico') || 'Técnico';
  const isAdmin = (sesionId || '').toLowerCase() === 'admin';

  useEffect(() => {
    if (!sesionId) navigate('/');
  }, [navigate, sesionId]);

  useEffect(() => {
    const fetchTiendas = async () => {
      try {
        const res = await axios.get('https://cubica-photo-app.onrender.com/tiendas');
        setTiendas(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error('Error al obtener tiendas del backend:', error);
        setTiendas([]);
      }
    };
    fetchTiendas();
  }, []);

  const departamentos = useMemo(() => {
    const set = new Set(
      tiendas.map(t => (t?.departamento ?? '').toString().trim()).filter(Boolean)
    );
    return [...set].sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
  }, [tiendas]);

  const ciudades = useMemo(() => {
    const base = filtroDepartamento
      ? tiendas.filter(t => (t?.departamento ?? '').trim() === filtroDepartamento)
      : tiendas;
    const set = new Set(
      base.map(t => (t?.ciudad ?? '').toString().trim()).filter(Boolean)
    );
    return [...set].sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
  }, [tiendas, filtroDepartamento]);

  const filteredTiendas = useMemo(() => {
    return tiendas
      .filter(t => {
        const okDept = filtroDepartamento ? (t?.departamento ?? '').trim() === filtroDepartamento : true;
        const okCity = filtroCiudad ? (t?.ciudad ?? '').trim() === filtroCiudad : true;
        return okDept && okCity;
      })
      .sort((a,b)=> (a?.nombre||'').localeCompare((b?.nombre||''),'es',{sensitivity:'base'}));
  }, [tiendas, filtroDepartamento, filtroCiudad]);

  useEffect(() => {
    if (selectedTienda && !filteredTiendas.some(t => t._id === selectedTienda)) {
      setSelectedTienda('');
    }
  }, [filteredTiendas, selectedTienda]);

  const limpiarFiltros = () => {
    setFiltroDepartamento('');
    setFiltroCiudad('');
  };

  const handleCerrarSesion = () => {
    localStorage.removeItem('sesionId');
    localStorage.removeItem('nombreTecnico');
    navigate('/');
  };

  /* ===== Subir IMAGEN de evidencia (previa/posterior) ===== */
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

    const tipoEnviado = tipo;

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
      const el = document.getElementById('file-input');
      if (el) el.value = '';

      // Alternar automáticamente (previa ↔ posterior), sin bloquear la elección manual
      setTipo(tipoEnviado === 'previa' ? 'posterior' : 'previa');

      setTimeout(() => setMensaje(''), 3000);
    } catch (error) {
      console.error(error);
      setMensaje('Error al subir la imagen');
    } finally {
      setCargando(false);
    }
  };

  /* ===== Subir ACTA: PDF + imágenes opcionales ===== */
  const handleSubirActa = async (e) => {
    e.preventDefault();

    if (!acta && actaImgs.length === 0) {
      setMensajeActa('Selecciona un PDF y/o una o más imágenes');
      return;
    }

    const formData = new FormData();
    formData.append('sesionId', sesionId);
    if (acta) formData.append('acta', acta);
    actaImgs.forEach(img => formData.append('imagenes', img));

    setCargandoActa(true);
    try {
      const res = await fetch('https://cubica-photo-app.onrender.com/acta/subir', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      setMensajeActa(data?.mensaje || (res.ok ? 'Archivo(s) subido(s) correctamente' : 'Error al subir'));

      // limpiar inputs y estado
      setActa(null);
      setActaImgs([]);
      const pdfEl = document.getElementById('pdf-input');
      const imgsEl = document.getElementById('acta-images-input');
      if (pdfEl) pdfEl.value = '';
      if (imgsEl) imgsEl.value = '';

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

  // Opciones para GlassSelect
  const deptOptions = useMemo(
    () => [{ value: '', label: 'Todos' }, ...departamentos.map(d => ({ value: d, label: d }))],
    [departamentos]
  );
  const cityOptions = useMemo(
    () => [{ value: '', label: 'Todas' }, ...ciudades.map(c => ({ value: c, label: c }))],
    [ciudades]
  );
  const tiendaOptions = useMemo(
    () => filteredTiendas.map(t => ({
      value: t._id,
      label: `${t.nombre} — ${t.departamento}, ${t.ciudad}`,
    })),
    [filteredTiendas]
  );
  const tipoOptions = [
    { value: 'previa', label: 'Previa' },
    { value: 'posterior', label: 'Posterior' },
  ];

  return (
    <div className="dash-root">
      {/* Fondo + Overlay */}
      <div className="bg" style={{ backgroundImage: `url("${BG_URL}")` }} />
      <div className="overlay" />

      {/* Topbar */}
      <div className="topbar">
        <div className="hello">Hola, <strong>{nombreTecnico}</strong></div>
        <div className="actions">
          {isAdmin && (
            <button className="btn-outline" onClick={() => navigate('/informes')}>Ver Informes</button>
          )}
          <button className="btn-danger" onClick={handleCerrarSesion}>Cerrar sesión</button>
        </div>
      </div>

      {/* Contenido */}
      <div className="content">
        <div className="stack">
          <h1 className="title">Dashboard</h1>

          {/* Filtros de Ubicación */}
          <div className="card">
            <h2 className="subtitle">Ubicación — Filtros</h2>

            <div className="filters-grid">
              <div className="field">
                <label className="label">Departamento</label>
                <GlassSelect
                  value={filtroDepartamento}
                  onChange={(val) => { setFiltroDepartamento(val); setFiltroCiudad(''); }}
                  options={deptOptions}
                  placeholder="Todos"
                  ariaLabel="Filtrar por departamento"
                />
              </div>

              <div className="field">
                <label className="label">Ciudad</label>
                <GlassSelect
                  value={filtroCiudad}
                  onChange={(val) => setFiltroCiudad(val)}
                  options={cityOptions}
                  placeholder="Todas"
                  ariaLabel="Filtrar por ciudad"
                  disabled={cityOptions.length <= 1}
                />
              </div>
            </div>

            <div className="filters-actions">
              <div className="hint">
                {filteredTiendas.length} resultado{filteredTiendas.length === 1 ? '' : 's'}
              </div>
              <button type="button" className="btn-outline" onClick={limpiarFiltros}>
                Limpiar filtros
              </button>
            </div>
          </div>

          {/* Subir Imagen de evidencia */}
          <form onSubmit={handleSubirImagen} className="card">
            <h2 className="subtitle">Subir Imagen</h2>

            <div className="field">
              <label className="label"><strong>Ubicación del D1</strong></label>
              <GlassSelect
                value={selectedTienda}
                onChange={setSelectedTienda}
                options={tiendaOptions}
                placeholder={`Selecciona una tienda (${filteredTiendas.length})`}
                ariaLabel="Seleccionar tienda"
                disabled={tiendaOptions.length === 0}
              />
            </div>

            <div className="field">
              <label className="label"><strong>Selecciona imagen</strong></label>
              <input
                id="file-input"
                type="file"
                onChange={(e) => setImagen(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                accept="image/*"
                className="file"
                required
              />
            </div>

            <div className="field">
              <label className="label"><strong>Tipo de imagen</strong></label>
              <GlassSelect
                value={tipo}
                onChange={setTipo}
                options={tipoOptions}
                placeholder="Selecciona tipo"
                ariaLabel="Seleccionar tipo de imagen"
              />
            </div>

            <div className="field">
              <label className="label"><strong>Observación (opcional)</strong></label>
              <textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                rows="3"
                className="textarea"
              />
            </div>

            <button type="submit" className="btn" disabled={cargando}>
              {cargando ? 'Subiendo…' : 'Subir Imagen'}
            </button>

            {mensaje && <p className="msg">{mensaje}</p>}
          </form>

          {/* Subir Acta: PDF + Imágenes opcionales */}
          <form onSubmit={handleSubirActa} className="card">
            <h2 className="subtitle">Subir Acta (PDF + imágenes opcionales)</h2>

            <div className="field">
              <label className="label"><strong>Archivo de Acta (PDF)</strong> — opcional</label>
              <input
                id="pdf-input"
                type="file"
                accept="application/pdf"
                onChange={(e) => setActa(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                className="file"
                aria-label="Seleccionar archivo PDF del acta"
              />
            </div>

            <div className="field">
              <label className="label"><strong>Imágenes del Acta</strong> — opcionales (puedes seleccionar varias)</label>
              <input
                id="acta-images-input"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setActaImgs(files);
                }}
                className="file"
                aria-label="Seleccionar una o varias imágenes para el acta"
              />
              {actaImgs.length > 0 && (
                <div className="hint" style={{ marginTop: 6 }}>
                  {actaImgs.length} imagen{actaImgs.length === 1 ? '' : 'es'} seleccionada{actaImgs.length === 1 ? '' : 's'}
                </div>
              )}
            </div>

            <button type="submit" className="btn" disabled={cargandoActa}>
              {cargandoActa ? 'Subiendo…' : 'Subir Acta e Imágenes'}
            </button>

            {mensajeActa && <p className="msg">{mensajeActa}</p>}
          </form>

          <button onClick={handleGenerarPDF} className="btn-primary">
            Generar PDF
          </button>
        </div>
      </div>

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
          width: 92%; max-width: 520px; padding: 18px; border-radius: 16px;
          background: var(--panel); border:1px solid var(--panel-border);
          box-shadow: 0 10px 36px rgba(0,0,0,0.30);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          transition: box-shadow 180ms ease;
        }
        .card:hover{ box-shadow: 0 12px 42px rgba(0,0,0,0.34); }

        .filters-grid{ display:grid; grid-template-columns: 1fr; gap:10px; }
        @media (min-width: 640px){ .filters-grid{ grid-template-columns: 1fr 1fr; } }

        .filters-actions{ margin-top: 6px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .hint{ font-size: 0.95rem; color: var(--label); }

        .field{ margin-bottom: 10px; }
        .label{ display:block; font-weight:600; color:var(--label); margin-bottom:6px; }

        .input, .textarea, .file{
          width:100%; box-sizing:border-box; border-radius:10px; border:1px solid var(--input-border);
          background: var(--input-bg); color: var(--input-text); outline:none; font-size:16px;
          transition: border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
        }
        .textarea{ padding:10px 12px; resize:vertical; min-height: 84px; }
        .file{ padding:8px 10px; }

        .btn{
          width:100%; height:48px; padding:12px; background: var(--gold); color:#000; border:none; border-radius:10px;
          font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;
          transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease; user-select:none;
        }
        .btn:hover{ transform: translateY(-1px); }
        .btn:active{ transform: translateY(0); }
        .btn:disabled{ opacity:.7; cursor:not-allowed; }

        .btn-primary{
          width: 92%; max-width: 520px; height:48px; padding:12px; background: var(--gold); color:#000; border:none; border-radius:10px;
          font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;
          transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease; user-select:none; box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        }
        .btn-primary:hover{ transform: translateY(-1px); }
        .btn-primary:active{ transform: translateY(0); }

        .btn-outline{
          height:40px; padding: 8px 14px; border-radius:10px; font-weight:700; cursor:pointer;
          background: rgba(255,255,255,0.28); color:#000; border:1px solid var(--panel-border);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); transition: transform 120ms ease, opacity 120ms ease, background 150ms ease;
        }
        @media (prefers-color-scheme: dark){ .btn-outline{ color:#fff; } }
        .btn-outline:hover{ transform: translateY(-1px); }

        .btn-danger{
          height:40px; padding: 8px 14px; border-radius:10px; font-weight:700; cursor:pointer;
          background: var(--danger); color:#fff; border:none; transition: transform 120ms ease, opacity 120ms ease;
        }
        .btn-danger:hover{ transform: translateY(-1px); }

        .msg{ margin-top:10px; font-weight:700; color:var(--msg); text-align:center; }

        /* ===== GlassSelect styles + Portal ===== */
        .glass-select { position: relative; }
        .select-trigger{
          width:100%; height:48px; padding:10px 12px; font-size:16px;
          border-radius:10px; border:1px solid var(--input-border);
          background: var(--input-bg); color: var(--input-text);
          display:flex; align-items:center; justify-content:space-between; gap:8px;
          cursor:pointer;
          transition: border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
        }
        .select-trigger:focus{
          outline:none; box-shadow: 0 0 0 3px var(--focus-ring);
          background: rgba(255,255,255,0.95);
        }
        @media (prefers-color-scheme: dark){
          .select-trigger:focus{ background: rgba(255,255,255,0.14); }
        }
        .select-trigger .selected.placeholder{ opacity: .75; }
        .select-trigger .chev{ flex-shrink:0; opacity:.75; }

        .dropdown-overlay{
          position: fixed; inset: 0;
          z-index: 2147483647;
          background: rgba(0,0,0,0.12);
          backdrop-filter: blur(2.5px) saturate(120%);
          -webkit-backdrop-filter: blur(2.5px) saturate(120%);
          animation: fadeIn 120ms ease forwards;
        }
        .dropdown-panel{
          position: fixed;
          max-height: 60vh; overflow:auto; -webkit-overflow-scrolling: touch;
          background: var(--panel); border:1px solid var(--panel-border);
          border-radius: 14px; box-shadow: 0 16px 40px rgba(0,0,0,0.28);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          padding: 6px; animation: pop 140ms ease;
        }
        .option{
          display:flex; align-items:center; justify-content:space-between; gap:8px;
          padding: 10px 12px; border-radius: 10px; font-size:16px; cursor:pointer;
          transition: background 120ms ease, transform 120ms ease;
        }
        .option:hover, .option.active{ background: rgba(255,255,255,0.42); }
        .option.selected{ font-weight:700; }
        .option.empty{ opacity:.7; cursor: default; }
        .option .check{ opacity:.9; }
        @media (prefers-color-scheme: dark){
          .option:hover, .option.active{ background: rgba(255,255,255,0.12); }
        }

        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pop { from { opacity: 0; transform: translateY(6px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );
};

export default DashboardPage;
