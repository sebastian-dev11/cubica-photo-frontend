// DashboardPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const BG_URL = 'https://png.pngtree.com/thumb_back/fh260/background/20231226/pngtree-radiant-golden-gradients-glistening-metal-texture-for-banners-and-backgrounds-image_13915236.png';

/* =============================
   GlassSelect
============================= */
const GlassSelect = ({ value, onChange, options, placeholder = 'Selecciona…', disabled = false, ariaLabel }) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 280 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex(o => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);

    const rect = triggerRef.current?.getBoundingClientRect?.() || {};
    const vw = window.innerWidth, vh = window.innerHeight;
    const width = Math.min(Math.max(rect.width || 280, 260), 520);
    const left = Math.min(Math.max((rect.left || 0), 8), vw - width - 8);
    const topCandidate = (rect.bottom || 0) + 6;
    setPanelPos({ top: Math.min(topCandidate, vh - 120), left, width });

    setTimeout(() => panelRef.current?.focus?.(), 0);
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onResize = () => setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
  }, [open, value, options]);

  const handleSelect = (val) => { onChange(val); setOpen(false); triggerRef.current?.focus?.(); };
  const onKeyDownTrigger = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
  };
  const onKeyDownPanel = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const opt = options[activeIndex]; if (opt) handleSelect(opt.value); }
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
        <span className={`selected ${!selectedLabel ? 'placeholder' : ''}`}>{selectedLabel || placeholder}</span>
        <svg className="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      {open && createPortal(
        <div className="dropdown-overlay" onClick={() => setOpen(false)} role="presentation">
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
   Helpers simples
============================= */
const norm = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

/* =============================
   DashboardPage
============================= */
const DashboardPage = () => {
  const navigate = useNavigate();

  // Paso actual del flujo (1 Ubicación, 2 Evidencias, 3 Acta, 4 PDF)
  const [step, setStep] = useState(() => {
    const v = Number(localStorage.getItem('dashStep') || 1);
    return Number.isFinite(v) && v >= 1 && v <= 4 ? v : 1;
  });

  // Evidencias
  const [imagen, setImagen] = useState(null);
  const [tipo, setTipo] = useState('previa');
  const [observacion, setObservacion] = useState('');

  // Contadores
  const [cntPrevias, setCntPrevias] = useState(0);
  const [cntPosteriores, setCntPosteriores] = useState(0);

  // Acta
  const [acta, setActa] = useState(null);
  const [actaImgs, setActaImgs] = useState([]);
  const [actaOK, setActaOK] = useState(false);

  // Previews
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [imgPreviewUrl, setImgPreviewUrl] = useState(null);
  const [evidPreviewUrl, setEvidPreviewUrl] = useState(null);

  // Refs inputs
  const pdfRef = useRef(null);
  const imgsRef = useRef(null);
  const evidenciaRef = useRef(null);

  // UI
  const [mensaje, setMensaje] = useState('');
  const [mensajeActa, setMensajeActa] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cargandoActa, setCargandoActa] = useState(false);

  // Generación / preview
  const [genLoading, setGenLoading] = useState(false);
  const [genUrl, setGenUrl] = useState('');
  const [genErr, setGenErr] = useState('');

  // Tiendas y filtros
  const [tiendas, setTiendas] = useState([]);
  const [selectedTienda, setSelectedTienda] = useState('');
  const [filtroDepartamento, setFiltroDepartamento] = useState('');
  const [filtroCiudad, setFiltroCiudad] = useState('');
  const [searchText, setSearchText] = useState('');

  const sesionId = localStorage.getItem('sesionId');
  const nombreTecnico = localStorage.getItem('nombreTecnico') || 'Técnico';
  const isAdmin = (sesionId || '').toLowerCase() === 'admin';

  useEffect(() => { if (!sesionId) navigate('/'); }, [navigate, sesionId]);

  // Persistir paso
  useEffect(() => { localStorage.setItem('dashStep', String(step)); }, [step]);

  // Tiendas
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

  // Derivados
  const departamentos = useMemo(() => {
    const set = new Set(tiendas.map(t => (t?.departamento ?? '').toString().trim()).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [tiendas]);

  const ciudades = useMemo(() => {
    const base = filtroDepartamento ? tiendas.filter(t => (t?.departamento ?? '').trim() === filtroDepartamento) : tiendas;
    const set = new Set(base.map(t => (t?.ciudad ?? '').toString().trim()).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [tiendas, filtroDepartamento]);

  const filteredTiendas = useMemo(() => {
    const q = norm(searchText);
    return tiendas
      .filter(t => {
        const okDept = filtroDepartamento ? (t?.departamento ?? '').trim() === filtroDepartamento : true;
        const okCity = filtroCiudad ? (t?.ciudad ?? '').trim() === filtroCiudad : true;
        if (!(okDept && okCity)) return false;
        if (!q) return true;
        const hay = [t?.nombre, t?.ciudad, t?.departamento].map(norm).some(s => s.includes(q));
        return hay;
      })
      .sort((a, b) => (a?.nombre || '').localeCompare((b?.nombre || ''), 'es', { sensitivity: 'base' }));
  }, [tiendas, filtroDepartamento, filtroCiudad, searchText]);

  // Asegurar tienda válida
  useEffect(() => {
    if (selectedTienda && !filteredTiendas.some(t => t._id === selectedTienda)) setSelectedTienda('');
  }, [filteredTiendas, selectedTienda]);

  // Previews
  useEffect(() => () => { if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl); }, [pdfPreviewUrl]);
  useEffect(() => {
    if (!acta) {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(acta);
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(url);
  }, [acta]);

  useEffect(() => () => { if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl); }, [imgPreviewUrl]);
  useEffect(() => {
    if (!actaImgs || actaImgs.length === 0) {
      if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl);
      setImgPreviewUrl(null);
      return;
    }
    const first = actaImgs[0];
    if (first && first.type?.startsWith('image/')) {
      const url = URL.createObjectURL(first);
      if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl);
      setImgPreviewUrl(url);
    } else {
      if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl);
      setImgPreviewUrl(null);
    }
  }, [actaImgs]);

  useEffect(() => () => { if (evidPreviewUrl) URL.revokeObjectURL(evidPreviewUrl); }, [evidPreviewUrl]);
  useEffect(() => {
    if (!imagen) {
      if (evidPreviewUrl) URL.revokeObjectURL(evidPreviewUrl);
      setEvidPreviewUrl(null);
      return;
    }
    if (imagen && imagen.type?.startsWith('image/')) {
      const url = URL.createObjectURL(imagen);
      if (evidPreviewUrl) URL.revokeObjectURL(evidPreviewUrl);
      setEvidPreviewUrl(url);
    } else {
      if (evidPreviewUrl) URL.revokeObjectURL(evidPreviewUrl);
      setEvidPreviewUrl(null);
    }
  }, [imagen]);

  // Acciones comunes
  const limpiarFiltros = () => {
    setFiltroDepartamento('');
    setFiltroCiudad('');
    setSearchText('');
  };

  const handleCerrarSesion = () => {
    localStorage.removeItem('sesionId');
    localStorage.removeItem('nombreTecnico');
    navigate('/');
  };

  const pickEvid = () => evidenciaRef.current && evidenciaRef.current.click();

  const clearEvid = (e) => {
    e?.stopPropagation?.();
    setImagen(null);
    if (evidenciaRef.current) evidenciaRef.current.value = '';
    if (evidPreviewUrl) { URL.revokeObjectURL(evidPreviewUrl); setEvidPreviewUrl(null); }
  };

  const handleSubirImagen = async (e) => {
    e.preventDefault();
    if (!imagen || !tipo || !selectedTienda) { setMensaje('Por favor completa todos los campos.'); return; }

    const formData = new FormData();
    formData.append('imagen', imagen);
    formData.append('tipo', tipo);
    formData.append('sesionId', sesionId);
    formData.append('ubicacion', selectedTienda);
    formData.append('observacion', observacion);

    const tipoEnviado = tipo;
    setCargando(true);
    try {
      const res = await fetch('https://cubica-photo-app.onrender.com/imagenes/subir', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        if (tipoEnviado === 'previa') setCntPrevias(x => x + 1);
        else setCntPosteriores(x => x + 1);
      }
      setMensaje(data.mensaje || (res.ok ? 'Imagen y observación enviadas correctamente' : 'Error al subir la imagen'));
      setImagen(null); setObservacion('');
      if (evidenciaRef.current) evidenciaRef.current.value = '';
      setTipo(tipoEnviado === 'previa' ? 'posterior' : 'previa');
      setTimeout(() => setMensaje(''), 3000);
    } catch (error) {
      console.error(error);
      setMensaje('Error al subir la imagen');
    } finally {
      setCargando(false);
    }
  };

  const clearPdf = (e, opts = {}) => {
    e?.stopPropagation?.();
    const keepStatus = !!opts.keepStatus;

    setActa(null);
    if (!keepStatus) setActaOK(false);

    if (pdfRef.current) pdfRef.current.value = '';
    if (pdfPreviewUrl) { URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); }
  };

  const clearImgs = (e, opts = {}) => {
    e?.stopPropagation?.();
    const keepStatus = !!opts.keepStatus;

    setActaImgs([]);
    if (!keepStatus) setActaOK(false);

    if (imgsRef.current) imgsRef.current.value = '';
    if (imgPreviewUrl) { URL.revokeObjectURL(imgPreviewUrl); setImgPreviewUrl(null); }
  };

  const handleSubirActa = async (e) => {
    e.preventDefault();
    if (!acta && actaImgs.length === 0) { setMensajeActa('Selecciona un PDF o una imagen del acta'); return; }

    const formData = new FormData();
    formData.append('sesionId', sesionId);
    if (acta) formData.append('acta', acta);
    actaImgs.forEach(img => formData.append('imagenes', img));

    setCargandoActa(true);
    try {
      const res = await fetch('https://cubica-photo-app.onrender.com/acta/subir', { method: 'POST', body: formData });
      const data = await res.json();
      setMensajeActa(data?.mensaje || (res.ok ? 'Archivo(s) subido(s) correctamente' : 'Error al subir'));
      if (res.ok) {
        clearPdf(null, { keepStatus: true });
        clearImgs(null, { keepStatus: true });
        setActaOK(true);
      }
      setTimeout(() => setMensajeActa(''), 3000);
    } catch (error) {
      console.error(error);
      setMensajeActa('Error en la conexión con el servidor');
    } finally {
      setCargandoActa(false);
    }
  };

  const handleGenerarPDF = async () => {
    if (!selectedTienda) {
      window.alert('Selecciona una tienda antes de generar el PDF.');
      return;
    }
    if (cntPrevias < 1 || cntPosteriores < 1) {
      window.alert('Debes subir al menos 1 imagen PREVIA y 1 POSTERIOR para generar el informe.');
      return;
    }

    setGenErr('');
    setGenUrl('');
    setGenLoading(true);

    try {
      const jsonUrl = `https://cubica-photo-app.onrender.com/pdf/generar/${sesionId}?tiendaId=${selectedTienda}&format=json`;
      const res = await fetch(jsonUrl, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('No se pudo obtener el enlace del informe');
      const data = await res.json();
      const cloudUrl = data?.url;
      if (!cloudUrl) throw new Error('Respuesta sin URL de informe');
      setGenUrl(cloudUrl);
    } catch (err) {
      console.error(err);
      setGenErr('Error al generar/obtener el enlace del informe. Intenta de nuevo.');
    } finally {
      setGenLoading(false);
    }
  };

  // Compartir por WhatsApp y luego cerrar sesión automáticamente
const handleShareWhatsApp = () => {
  if (!genUrl) return;

  const tiendaLabel = (tiendaOptions.find(o => o.value === selectedTienda)?.label || '').trim();
  const texto = `Informe técnico${tiendaLabel ? ` - ${tiendaLabel}` : ''}\n${genUrl}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(texto)}`;

  // 1) Intentar abrir en nueva pestaña/ventana (mejor en escritorio)
  const popup = window.open(waUrl, '_blank', 'noopener,noreferrer');

  if (popup && !popup.closed) {
    // Evita acceso del popup a la ventana original
    popup.opener = null;
    // 2) Pequeño delay para no interferir con el popup y cerrar sesión
    setTimeout(() => {
      handleCerrarSesion(); // limpia storage y navega a '/'
    }, 400);
  } else {
    // 3) Fallback para iOS Safari / bloqueadores: abrir en la misma pestaña
    window.location.href = waUrl;
    // No podremos navegar a '/', pero limpiamos la sesión por si el usuario vuelve con "Atrás"
    setTimeout(() => {
      try {
        localStorage.removeItem('sesionId');
        localStorage.removeItem('nombreTecnico');
      } catch {}
    }, 200);
  }
};

  // Opciones
  const deptOptions = useMemo(() => [{ value: '', label: 'Todos' }, ...departamentos.map(d => ({ value: d, label: d }))], [departamentos]);
  const cityOptions = useMemo(() => [{ value: '', label: 'Todas' }, ...ciudades.map(c => ({ value: c, label: c }))], [ciudades]);
  const tiendaOptions = useMemo(() => filteredTiendas.map(t => ({ value: t._id, label: `${t.nombre} — ${t.departamento}, ${t.ciudad}` })), [filteredTiendas]);
  const tipoOptions = [{ value: 'previa', label: 'Previa' }, { value: 'posterior', label: 'Posterior' }];

  const pickPdf = () => pdfRef.current && pdfRef.current.click();
  const pickImgs = () => imgsRef.current && imgsRef.current.click();

  const onSelectTienda = (val) => {
    if (step > 1) return;
    setSelectedTienda(val);
    setCntPrevias(0);
    setCntPosteriores(0);
    setActaOK(false);
  };

  const canNextFrom1 = !!selectedTienda;
  const hasAnyEvidence = (cntPrevias + cntPosteriores) > 0;
  const canNextFrom2 = hasAnyEvidence;
  const canNextFrom3 = actaOK;

  const goNext = () => setStep(s => Math.min(4, s + 1));
  const goBack = () => setStep(s => Math.max(1, s - 1));
  const resetFlow = () => {
    setStep(1);
    setCntPrevias(0);
    setCntPosteriores(0);
    setActaOK(false);
    setGenLoading(false);
    setGenUrl('');
    setGenErr('');
  };

  return (
    <div className="dash-root">
      <div className="bg" style={{ backgroundImage: `url("${BG_URL}")` }} />
      <div className="overlay" />

      <div className="topbar">
        <div className="hello">Hola, <strong>{nombreTecnico}</strong></div>
        <div className="actions">
          {isAdmin && <button className="btn-outline" onClick={() => navigate('/informes')}>Ver Informes</button>}
          <button className="btn-danger" onClick={handleCerrarSesion}>Cerrar sesión</button>
        </div>
      </div>

      <div className="content">
        <div className="stack">
          <h1 className="title">Dashboard</h1>

          {/* Indicador de pasos */}
          <div className="stepper card">
            <div className="steps">
              <div className={`step ${step >= 1 ? 'done' : ''} ${step === 1 ? 'current' : ''}`}><span>1</span> Ubicación</div>
              <div className={`step ${step >= 2 ? 'done' : ''} ${step === 2 ? 'current' : ''}`}><span>2</span> Evidencias</div>
              <div className={`step ${step >= 3 ? 'done' : ''} ${step === 3 ? 'current' : ''}`}><span>3</span> Acta</div>
              <div className={`step ${step >= 4 ? 'done' : ''} ${step === 4 ? 'current' : ''}`}><span>4</span> PDF</div>
            </div>
            <div className="step-quick">
              <div>Evidencias: {cntPrevias} previas · {cntPosteriores} posteriores</div>
              <div>Acta: {actaOK ? 'Lista' : 'Pendiente'}</div>
              <button type="button" className="btn-outline" onClick={resetFlow}>Reiniciar flujo</button>
            </div>
          </div>

          {/* Paso 1: Ubicación */}
          {step === 1 && (
            <div className="card">
              <h2 className="subtitle">Ubicación — Filtros</h2>

              {/* Filtros primero */}
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

              {/* Buscador inmediatamente antes del selector de Ubicación */}
              <div className="field">
                <label className="label">Buscar tienda</label>
                <input
                  className="input"
                  type="search"
                  inputMode="search"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Nombre, ciudad o departamento"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="label"><strong>Ubicación del D1</strong></label>
                <GlassSelect
                  value={selectedTienda}
                  onChange={onSelectTienda}
                  options={tiendaOptions}
                  placeholder={`Selecciona una tienda (${filteredTiendas.length})`}
                  ariaLabel="Seleccionar tienda"
                  disabled={tiendaOptions.length === 0}
                />
              </div>

              <div className="filters-actions">
                <div className="hint">{filteredTiendas.length} resultado{filteredTiendas.length === 1 ? '' : 's'}</div>
                <button type="button" className="btn-outline" onClick={limpiarFiltros}>Limpiar filtros</button>
              </div>

              <div className="wizard-actions">
                <button className="btn" onClick={() => canNextFrom1 && goNext()} disabled={!canNextFrom1}>Continuar</button>
              </div>
            </div>
          )}

          {/* Paso 2: Evidencias */}
          {step === 2 && (
            <form onSubmit={handleSubirImagen} className="card">
              <h2 className="subtitle">Subir Imagen</h2>

              <div className="info-row">
                <div>Tienda: <strong>{tiendaOptions.find(o => o.value === selectedTienda)?.label || 'Sin tienda'}</strong></div>
                <div>Evidencias: {cntPrevias} previas · {cntPosteriores} posteriores</div>
              </div>

              <div className="upload-toggles upload-toggles--center">
                <button type="button" className="upload-btn" onClick={pickEvid} aria-label="Seleccionar imagen de evidencia">
                  <span className="thumb-wrap">
                    {evidPreviewUrl ? (
                      <span className="thumb-box-lg" aria-label="Imagen de evidencia seleccionada">
                        <img src={evidPreviewUrl} alt="Previsualización evidencia" className="thumb-img-lg" />
                        <span
                          className="clear-x"
                          role="button"
                          tabIndex={0}
                          onClick={(e) => clearEvid(e)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clearEvid(e); } }}
                          aria-label="Quitar imagen"
                        >×</span>
                      </span>
                    ) : (
                      <span className="icon-slab" aria-hidden="true">
                        <svg className="upload-icon" viewBox="0 0 48 48">
                          <path d="M24 30V12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"/>
                          <path d="M17 18l7-8 7 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          <rect x="12" y="32" width="24" height="6" rx="3" fill="currentColor" opacity=".95"/>
                        </svg>
                      </span>
                    )}
                  </span>
                  <span className="upload-label">Subir imagen de evidencia</span>
                </button>
              </div>

              <input
                ref={evidenciaRef}
                id="evidencia-input"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                required
                onChange={(e) => setImagen(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
              />

              {imagen && (
                <div className="hint" style={{ marginTop: 10 }}>
                  Imagen: {imagen.name}
                </div>
              )}

              <div className="field" style={{ marginTop: 10 }}>
                <label className="label"><strong>Tipo de imagen</strong></label>
                <GlassSelect
                  value={tipo}
                  onChange={(v) => setTipo(v)}
                  options={tipoOptions}
                  placeholder="Selecciona tipo"
                  ariaLabel="Seleccionar tipo de imagen"
                />
              </div>

              <div className="field">
                <label className="label"><strong>Observación (opcional)</strong></label>
                <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={3} className="textarea" />
              </div>

              <button type="submit" className="btn" disabled={cargando}>{cargando ? 'Subiendo…' : 'Subir Imagen'}</button>
              {mensaje && <p className="msg">{mensaje}</p>}

              <div className="wizard-actions">
                <button type="button" className="btn-outline" onClick={goBack}>Regresar</button>
                <button type="button" className="btn" onClick={() => canNextFrom2 && goNext()} disabled={!canNextFrom2}>Continuar</button>
              </div>
            </form>
          )}

          {/* Paso 3: Acta */}
          {step === 3 && (
            <form onSubmit={handleSubirActa} className="card">
              <h2 className="subtitle">Subir Acta</h2>

              <div className="info-row">
                <div>Evidencias: {cntPrevias} previas · {cntPosteriores} posteriores</div>
                <div>Acta: {actaOK ? 'Lista' : 'Pendiente'}</div>
              </div>

              <div className="upload-toggles">
                {/* PDF */}
                <button type="button" className="upload-btn" onClick={pickPdf} aria-label="Subir acta formato PDF">
                  <span className="thumb-wrap">
                    {acta ? (
                      <span className="thumb-box-lg pdf" aria-label="PDF seleccionado">
                        <span className="pdf-badge">PDF</span>
                        <span
                          className="clear-x"
                          role="button"
                          tabIndex={0}
                          onClick={(e) => clearPdf(e)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clearPdf(e); } }}
                          aria-label="Quitar PDF"
                        >×</span>
                      </span>
                    ) : (
                      <span className="icon-slab" aria-hidden="true">
                        <svg className="upload-icon" viewBox="0 0 48 48">
                          <path d="M24 30V12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"/>
                          <path d="M17 18l7-8 7 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          <rect x="12" y="32" width="24" height="6" rx="3" fill="currentColor" opacity=".95"/>
                        </svg>
                      </span>
                    )}
                  </span>
                  <span className="upload-label">Subir acta formato PDF</span>
                </button>

                {/* IMAGEN */}
                <button type="button" className="upload-btn" onClick={pickImgs} aria-label="Subir acta formato imagen">
                  <span className="thumb-wrap">
                    {imgPreviewUrl ? (
                      <span className="thumb-box-lg" aria-label="Imagen de acta seleccionada">
                        <img src={imgPreviewUrl} alt="Previsualización acta" className="thumb-img-lg" />
                        {actaImgs.length > 1 && <span className="thumb-count-lg">+{actaImgs.length - 1}</span>}
                        <span
                          className="clear-x"
                          role="button"
                          tabIndex={0}
                          onClick={(e) => clearImgs(e)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clearImgs(e); } }}
                          aria-label="Quitar imágenes"
                        >×</span>
                      </span>
                    ) : (
                      <span className="icon-slab" aria-hidden="true">
                        <svg className="upload-icon" viewBox="0 0 48 48">
                          <path d="M24 30V12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"/>
                          <path d="M17 18l7-8 7 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          <rect x="12" y="32" width="24" height="6" rx="3" fill="currentColor" opacity=".95"/>
                        </svg>
                      </span>
                    )}
                  </span>
                  <span className="upload-label">Subir acta formato imagen</span>
                </button>
              </div>

              <input
                ref={pdfRef}
                id="pdf-input"
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => setActa(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
              />
              <input
                ref={imgsRef}
                id="acta-images-input"
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => setActaImgs(Array.from(e.target.files || []))}
              />

              {(acta || actaImgs.length > 0) && (
                <div className="hint" style={{ marginTop: 10 }}>
                  {acta ? `PDF: ${acta.name}` : ''}
                  {acta && actaImgs.length > 0 ? ' • ' : ''}
                  {actaImgs.length > 0 ? `${actaImgs.length} imagen${actaImgs.length === 1 ? '' : 'es'}` : ''}
                </div>
              )}

              <button type="submit" className="btn" disabled={cargandoActa}>{cargandoActa ? 'Subiendo…' : 'Subir Acta'}</button>
              {mensajeActa && <p className="msg">{mensajeActa}</p>}

              <div className="wizard-actions">
                <button type="button" className="btn-outline" onClick={goBack}>Regresar</button>
                <button type="button" className="btn" onClick={() => canNextFrom3 && goNext()} disabled={!canNextFrom3}>Continuar</button>
              </div>
            </form>
          )}

          {/* Paso 4: Generar / Carga / Preview / Compartir */}
          {step === 4 && (
            <>
              {!genLoading && !genUrl && !genErr && (
                <>
                  <div className="card">
                    <h2 className="subtitle">Resumen</h2>
                    <div className="hint">Ubicación: <strong>{tiendaOptions.find(o => o.value === selectedTienda)?.label || 'Sin tienda'}</strong></div>
                    <div className="hint">Evidencias: {cntPrevias} previas · {cntPosteriores} posteriores</div>
                    <div className="hint">Acta: {actaOK ? 'Lista' : 'Pendiente'}</div>
                    <div className="wizard-actions">
                      <button type="button" className="btn-outline" onClick={goBack}>Regresar</button>
                    </div>
                  </div>
                  <button onClick={handleGenerarPDF} className="btn-primary" disabled={cntPrevias < 1 || cntPosteriores < 1}>
                    Generar informe
                  </button>
                </>
              )}

              {genLoading && (
                <div className="card">
                  <h2 className="subtitle">Generando informe</h2>
                  <div className="loader-wrap">
                    <div className="spinner" aria-label="Cargando" />
                    <div className="hint" style={{ marginTop: 8 }}>Esto puede tardar unos segundos…</div>
                  </div>
                </div>
              )}

              {!genLoading && genErr && (
                <div className="card">
                  <h2 className="subtitle">Error</h2>
                  <p className="msg">{genErr}</p>
                  <div className="wizard-actions">
                    <button type="button" className="btn-outline" onClick={() => { setGenErr(''); setGenUrl(''); }}>Intentar de nuevo</button>
                    <button type="button" className="btn-outline" onClick={goBack}>Regresar</button>
                  </div>
                </div>
              )}

              {!genLoading && genUrl && (
                <>
                  <div className="card">
                    <h2 className="subtitle">Vista previa</h2>
                    <div className="hint" style={{ marginBottom: 8 }}>Si el visor no carga, puedes abrir el PDF en otra pestaña.</div>
                    <iframe
                      title="Informe PDF"
                      src={genUrl}
                      className="pdf-preview"
                    />
                    <div className="wizard-actions" style={{ marginTop: 10 }}>
                      <a className="btn-outline" href={genUrl} target="_blank" rel="noreferrer">Abrir en pestaña</a>
                      <button type="button" className="btn" onClick={handleShareWhatsApp}>Compartir por WhatsApp</button>
                    </div>
                  </div>

                  <div className="wizard-actions">
                    <button type="button" className="btn-outline" onClick={resetFlow}>Reiniciar flujo</button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        :root{
          --gold:#fff200; --ink:#0a0a0a; --text:#333333; --label:#555555;
          --panel:rgba(255,255,255,0.30); --panel-border:rgba(255,255,255,0.24);
          --input-bg:rgba(255,255,255,0.85); --input-text:#111111; --input-border:rgba(0,0,0,0.18);
          --title:#222222; --msg:#444444;
          --overlay:linear-gradient(to bottom, rgba(255,242,0,0.35), rgba(255,255,255,0.05) 40%, rgba(0,0,0,0.10) 100%);
          --focus-ring:rgba(255,255,255,0.25); --danger:#ef4444;
        }
        @media (prefers-color-scheme: dark){
          :root{
            --text:#e9e9e9; --label:#d3d3d3; --panel:rgba(24,24,24,0.42); --panel-border:rgba(255,255,255,0.18);
            --input-bg:rgba(255,255,255,0.10); --input-text:#f2f2f2; --input-border:rgba(255,255,255,0.22);
            --title:#fafafa; --msg:#efefef;
            --overlay:linear-gradient(to bottom, rgba(255,242,0,0.28), rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.45) 100%);
            --focus-ring:rgba(255,255,255,0.35);
          }
        }

        /* Mobile-first base */
        .dash-root{
          position:relative; min-height:100dvh; width:100%;
          padding:max(10px, env(safe-area-inset-top,0px)) 10px max(10px, env(safe-area-inset-bottom,0px));
          box-sizing:border-box; font-family: Roboto, system-ui, -apple-system, Segoe UI, Helvetica, Arial;
          color:var(--text); -webkit-text-size-adjust:100%; text-size-adjust:100%; overflow-x:hidden;
          -webkit-tap-highlight-color: transparent;
        }
        .bg{ position:fixed; inset:0; background-size:cover; background-position:center; background-repeat:no-repeat; z-index:-2; transform:translateZ(0); }
        .overlay{ position:fixed; inset:0; z-index:-1; background:var(--overlay); pointer-events:none; }

        .topbar{
          position:sticky; top:max(8px, env(safe-area-inset-top,0px));
          display:flex; align-items:center; justify-content:space-between; gap:8px; margin:6px auto 10px;
          width:min(100%,960px); padding:10px 12px; border-radius:14px; background:var(--panel); border:1px solid var(--panel-border);
          backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); box-shadow:0 8px 24px rgba(0,0,0,0.18);
        }
        .hello{ font-weight:600; }
        .actions{ display:flex; gap:8px; flex-wrap:wrap; }

        .content{ min-height:calc(100dvh - 90px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));
          display:flex; align-items:flex-start; justify-content:center; }
        .stack{ width:min(100%,960px); display:flex; flex-direction:column; align-items:center; gap:16px; padding:8px 0 28px; }

        .title{ margin:6px 0 0 0; color:var(--title); font-weight:800; font-size:clamp(18px,4.5vw,28px); letter-spacing:.2px; text-align:center; }
        .subtitle{ margin:0 0 10px 0; font-size:clamp(16px,4vw,20px); color:var(--title); font-weight:700; text-align:left; }

        .card{
          width:100%; max-width:560px; padding:16px; border-radius:16px; background:var(--panel); border:1px solid var(--panel-border);
          box-shadow:0 10px 36px rgba(0,0,0,0.30); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); transition:box-shadow 180ms ease;
        }
        .card:hover{ box-shadow:0 12px 42px rgba(0,0,0,0.34); }

        .filters-grid{ display:grid; grid-template-columns:1fr; gap:10px; }
        @media (min-width:640px){ .filters-grid{ grid-template-columns:1fr 1fr; } }
        .filters-actions{ margin-top:6px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .hint{ font-size:.95rem; color:var(--label); }

        .field{ margin-bottom:10px; }
        .label{ display:block; font-weight:600; color:var(--label); margin-bottom:6px; }

        .input, .textarea, .file{
          width:100%; box-sizing:border-box; border-radius:12px; border:1px solid var(--input-border);
          background:var(--input-bg); color:var(--input-text); outline:none; font-size:16px;
          transition:border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
        }
        .input{ height:48px; padding:10px 12px; }
        .textarea{ padding:10px 12px; resize:vertical; min-height:84px; }
        .file{ padding:8px 10px; }

        .btn{
          width:100%; height:52px; padding:12px; background:var(--gold); color:#000; border:none; border-radius:12px;
          font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;
          transition:transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease; user-select:none;
        }
        .btn:hover{ transform:translateY(-1px); }
        .btn:active{ transform:translateY(0); }
        .btn:disabled{ opacity:.7; cursor:not-allowed; }

        .btn-primary{
          width:100%; max-width:560px; height:52px; padding:12px; background:var(--gold); color:#000; border:none; border-radius:12px;
          font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;
          transition:transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease; user-select:none; box-shadow:0 8px 24px rgba(0,0,0,0.18);
        }
        .btn-primary:hover{ transform:translateY(-1px); }
        .btn-primary:active{ transform:translateY(0); }

        .btn-outline{
          height:44px; padding:8px 14px; border-radius:12px; font-weight:700; cursor:pointer;
          background:rgba(255,255,255,0.28); color:#000; border:1px solid var(--panel-border);
          backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); transition:transform 120ms ease, opacity 120ms ease, background 150ms ease;
        }
        @media (prefers-color-scheme: dark){ .btn-outline{ color:#fff; } }
        .btn-outline:hover{ transform:translateY(-1px); }

        .btn-danger{
          height:40px; padding:8px 14px; border-radius:10px; font-weight:700; cursor:pointer;
          background:var(--danger); color:#fff; border:none; transition:transform 120ms ease, opacity 120ms ease;
        }
        .btn-danger:hover{ transform:translateY(-1px); }

        .msg{ margin-top:10px; font-weight:700; color:var(--msg); text-align:center; }

        /* Upload */
        .upload-toggles{ display:grid; grid-template-columns:1fr; gap:10px; margin-bottom:8px; }
        @media (min-width:520px){ .upload-toggles{ grid-template-columns:1fr 1fr; } }

        .upload-toggles--center{ grid-template-columns: 1fr; justify-items: center; }
        @media (min-width:520px){ .upload-toggles--center{ grid-template-columns: 1fr; } }
        .upload-toggles--center .upload-btn{ width:100%; max-width:440px; margin-inline:auto; }

        .upload-btn{
          position:relative; display:flex; align-items:center; gap:12px; width:100%; min-height:76px; padding:12px;
          border-radius:14px; background: var(--panel); border:1px solid var(--panel-border);
          backdrop-filter: blur(14px) saturate(135%); -webkit-backdrop-filter: blur(14px) saturate(135%);
          box-shadow: 0 10px 24px rgba(0,0,0,0.22); cursor:pointer; color:var(--title); font-weight:800;
          transition: transform 120ms ease, box-shadow 150ms ease, background 150ms ease, border-color 150ms ease;
        }
        .upload-btn::after{
          content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
          background: linear-gradient(to bottom, rgba(255,255,255,0.25), rgba(255,255,255,0.06) 38%, rgba(0,0,0,0.08) 100%);
          mix-blend-mode:soft-light;
        }
        .upload-btn:hover{ transform: translateY(-1px); box-shadow: 0 14px 32px rgba(0,0,0,0.28); border-color: rgba(255,255,255,0.32); }

        .thumb-wrap{ position:relative; display:inline-grid; place-items:center; }
        .icon-slab{
          width:84px; height:64px; border-radius:12px; display:grid; place-items:center;
          background: linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0.10));
          border:1px solid var(--panel-border);
          backdrop-filter: blur(10px) saturate(120%); -webkit-backdrop-filter: blur(10px) saturate(120%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), 0 6px 18px rgba(0,0,0,0.14); color: var(--title);
        }
        @media (prefers-color-scheme: dark){
          .icon-slab{ background: linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08)); }
        }
        .upload-icon{ opacity:.95; }

        .thumb-box-lg{
          width:128px; height:84px; border-radius:12px; overflow:hidden; position:relative; display:grid; place-items:center;
          background: linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06)); border:1px solid var(--panel-border);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        }
        .thumb-box-lg.pdf{ background:#e94f37; }
        .thumb-img-lg{ width:100%; height:100%; object-fit:cover; display:block; }
        .thumb-count-lg{
          position:absolute; right:-6px; bottom:-6px; background:rgba(0,0,0,0.78); color:#fff; font-size:12px; border-radius:10px; padding:2px 6px; line-height:1;
        }

        .pdf-badge{
          display:inline-block; padding:6px 10px; border-radius:10px;
          background:#e94f37; color:#fff; font-weight:800; font-size:13px; letter-spacing:.4px;
          box-shadow:0 4px 12px rgba(0,0,0,0.18);
        }

        .clear-x{
          position:absolute; top:6px; right:6px; width:24px; height:24px; line-height:22px; text-align:center; border-radius:10px;
          background: var(--panel); border:1px solid var(--panel-border);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          color: var(--title); font-weight:800; cursor:pointer; user-select:none;
        }

        .upload-label{ flex:1; text-align:left; }

        /* GlassSelect */
        .glass-select { position: relative; }
        .select-trigger{
          width:100%; height:48px; padding:10px 12px; font-size:16px; border-radius:12px; border:1px solid var(--input-border);
          background:var(--input-bg); color:var(--input-text); display:flex; align-items:center; justify-content:space-between; gap:8px; cursor:pointer;
          transition:border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
        }
        .select-trigger:focus{ outline:none; box-shadow:0 0 0 3px var(--focus-ring); background:rgba(255,255,255,0.95); }
        @media (prefers-color-scheme: dark){ .select-trigger:focus{ background:rgba(255,255,255,0.14); } }
        .select-trigger .selected.placeholder{ opacity:.75; }
        .select-trigger .chev{ flex-shrink:0; opacity:.75; }

        .dropdown-overlay{ position:fixed; inset:0; z-index:2147483647; background:rgba(0,0,0,0.12);
          backdrop-filter:blur(2.5px) saturate(120%); -webkit-backdrop-filter:blur(2.5px) saturate(120%); animation:fadeIn 120ms ease forwards; }
        .dropdown-panel{
          position:fixed; max-height:60svh; overflow:auto; -webkit-overflow-scrolling:touch; background:var(--panel); border:1px solid var(--panel-border);
          border-radius:14px; box-shadow:0 16px 40px rgba(0,0,0,0.28); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
          padding:6px; animation:pop 140ms ease;
        }
        .option{ display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 12px; border-radius:10px; font-size:16px; cursor:pointer; transition:background 120ms ease, transform 120ms ease; }
        .option:hover, .option.active{ background:rgba(255,255,255,0.42); }
        .option.selected{ font-weight:700; }
        .option.empty{ opacity:.7; cursor:default; }
        .option .check{ opacity:.9; }
        @media (prefers-color-scheme: dark){ .option:hover, .option.active{ background:rgba(255,255,255,0.12); } }

        @keyframes fadeIn{ from{opacity:0} to{opacity:1} }
        @keyframes pop{ from{opacity:0; transform:translateY(6px) scale(0.98)} to{opacity:1; transform:translateY(0) scale(1)} }

        /* Stepper */
        .stepper .steps{
          display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:8px;
        }
        .stepper .step{
          display:flex; align-items:center; gap:8px; padding:8px; border-radius:12px; border:1px solid var(--panel-border); background:var(--panel);
          font-weight:700; font-size:clamp(12px,3.2vw,14px);
        }
        .stepper .step span{
          width:22px; height:22px; display:inline-grid; place-items:center; border-radius:999px; background:rgba(0,0,0,0.15);
        }
        .stepper .step.current{ outline:2px solid rgba(0,0,0,0.18); }
        .stepper .step.done span{ background:#9ae6b4; }
        .step-quick{
          display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-top:6px; font-size:clamp(12px,3.2vw,14px);
        }

        .wizard-actions{
          display:flex; gap:10px; justify-content:space-between; align-items:center; margin-top:12px;
        }
        /* Sticky actions en móvil */
        @media (max-width: 520px){
          .wizard-actions{
            position: sticky;
            bottom: max(8px, env(safe-area-inset-bottom, 0px));
            background: linear-gradient(180deg, rgba(255,255,255,0.65), rgba(255,255,255,0.25));
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            padding: 8px;
            border-radius: 12px;
            border: 1px solid var(--panel-border);
          }
        }

        .info-row{
          display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px; color:var(--label);
          font-size:.95rem; flex-wrap:wrap;
        }

        /* Loader */
        .loader-wrap{ display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:120px; }
        .spinner{
          width:40px; height:40px; border-radius:50%;
          border:4px solid rgba(0,0,0,0.2); border-top-color: currentColor;
          animation: spin 1s linear infinite;
        }
        @keyframes spin{ to{ transform: rotate(360deg); } }

        /* Visor PDF: usa dvh para barras móviles */
        .pdf-preview{
          width:100%;
          height: clamp(320px, 65dvh, 80dvh);
          border:none; border-radius:12px; background:#fff;
        }
      `}</style>
    </div>
  );
};

export default DashboardPage;
