Cubica Photo App - Frontend

Frontend de la aplicación Cubica Photo App, desarrollada en React, que permite a los técnicos subir imágenes de instalaciones, agregar observaciones opcionales, subir actas en PDF y generar informes visuales.

Tecnologías y librerías

React (v18+)

React Router DOM para manejo de rutas

Axios para llamadas HTTP al backend

CSS inline y fuentes Roboto para estilo visual

Navegador moderno con soporte para ES6+

Estructura del proyecto
cubica-photo-app-frontend/
├─ src/
│  ├─ pages/
│  │  ├─ LoginPage.jsx
│  │  ├─ DashboardPage.jsx
│  │  └─ InformesPage.jsx
│  ├─ services/
│  │  └─ authService.js
│  ├─ App.js
│  └─ index.js
├─ public/
│  └─ index.html
├─ package.json
└─ README.md

Descripción de los componentes
1. LoginPage.jsx

Página de inicio de sesión.

Permite que los usuarios ingresen su cédula y contraseña.

Llama al servicio login del backend.

Guarda sesionId y nombreTecnico en localStorage si el login es exitoso.

Redirige al dashboard.

Muestra mensajes de error y spinner de carga.

Estilo: degradado amarillo-blanco, formulario centrado con backdrop blur, logo de Cubica, tipografía Roboto.

2. DashboardPage.jsx

Página principal del dashboard.

Subida de imágenes con:

Selección de tienda (ubicacion)

Tipo de imagen (previa o posterior)

Observaciones opcionales

Subida de actas en PDF.

Generación de PDF con todas las imágenes y actas asociadas a la tienda seleccionada.

Cierre de sesión que limpia localStorage.

Botón para navegar a la página de informes.

Indicadores de carga y mensajes de estado.

Estilo: degradado amarillo-blanco, formularios y botones con bordes redondeados y sombras suaves.

3. InformesPage.jsx

Página para visualizar y gestionar informes generados.

Listado de informes con paginación y búsqueda por título.

Muestra: título, generado por, fecha, si incluye acta PDF.

Botón “Ver” abre el PDF en nueva pestaña.

Navegación entre páginas de informes.

Cierre de sesión y botón para volver al dashboard.

Estilo consistente con el resto de la app.

4. services/authService.js

Servicio de autenticación.

Función login(usuario, contraseña):

Envía solicitud POST al backend (/auth/login).

Retorna { mensaje, nombre }.

Maneja errores de conexión y credenciales incorrectas.

5. App.js

Componente principal que define rutas.

Rutas:

/ → LoginPage

/dashboard → DashboardPage

/informes → InformesPage

Permite navegación interna sin recargar la app.

6. index.js

Archivo de entrada principal.

Renderiza <App /> dentro del root.

Envuelto en <React.StrictMode> para habilitar comprobaciones adicionales durante el desarrollo.

Instalación

Clonar el repositorio:

git clone <url-del-repositorio-frontend>
cd cubica-photo-app-frontend


Instalar dependencias:

npm install


Ejecutar la aplicación en modo desarrollo:

npm start


La app se ejecutará por defecto en http://localhost:3000.

Uso

Ingresar con cédula y contraseña en el login.

En el dashboard:

Seleccionar tienda.

Subir imágenes (previa/posterior) con observaciones opcionales.

Subir actas en PDF.

Generar PDF consolidado.

Consultar informes desde la sección “Informes”.

Cerrar sesión para salir de la aplicación.

Estilo visual

Degradado amarillo a blanco en todas las páginas.

Tipografía Roboto.

Formularios y botones con bordes redondeados, sombras suaves y colores consistentes.

Logo de Cubica siempre visible en login.

Notas adicionales

La URL del backend se configura con `REACT_APP_API_URL`; consulta la preparación de despliegue siguiente.

Todos los datos subidos (imágenes y actas) se asocian al usuario y la tienda seleccionada.

Los PDFs generados abren en una nueva pestaña del navegador.

## Preparación del frontend para R2

La compilación utilizada sigue siendo **Create React App (`react-scripts`)**:
`npm start`, `npm test -- --watchAll=false --runInBand` y `npm run build`.
Los scripts Vite existentes no forman parte de este despliegue.

### Configuración

- `src/services/apiConfig.js` centraliza la URL para HTTP y autenticación.
- Define **`REACT_APP_API_URL=https://<dominio-del-backend>` antes de compilar**.
  CRA incorpora su valor al JavaScript: cambiar la variable en el hosting después
  del build no cambia la aplicación. Hay que reconstruir y publicar `build/`.
- Sin esa variable se utiliza `/api` en el mismo origen. En producción esto
  requiere configurar el reverse proxy del hosting; `src/setupProxy.js` solo
  funciona con `npm start`.
- Para desarrollo, copia `.env.example` a `.env.local`: frontend en 3001 y proxy
  hacia el backend local en 3000, configurable con `API_PROXY_TARGET`.
  El proxy de desarrollo ya no apunta por defecto a producción.
- El backend debe permitir el origen HTTPS del frontend y `Authorization: Bearer`.
  Las cargas siguen pasando por él. Para `FormData` el navegador establece
  `Content-Type` y el boundary; no se incluyen credenciales R2 en el frontend.
- Timeouts por operación, en milisegundos (también requieren reconstruir):

  | Variable | Predeterminado |
  | --- | ---: |
  | `REACT_APP_REQUEST_TIMEOUT_MS` | 30000 |
  | `REACT_APP_UPLOAD_TIMEOUT_MS` | 180000 |
  | `REACT_APP_PDF_TIMEOUT_MS` | 600000 |

  `0` desactiva el timeout. El margen de generación es de diez minutos, superior
  a los aproximadamente 62 s observados para 80 fotos; un proxy puede cortar
  antes. Un timeout del navegador **no cancela el trabajo en el backend**.

### Cargas, validaciones y recuperación

- La cola guarda el estado de cada evidencia y retira cada éxito confirmado;
  los contadores se actualizan inmediatamente. El reintento manual envía solo
  los archivos no confirmados, secuencialmente y sin límite de 20 evidencias.
  Los archivos con errores de conversión quedan identificados y pueden quitarse
  o seleccionarse nuevamente. Una nueva selección sustituye la cola pendiente,
  no los contadores confirmados.
- Se mantienen los campos `imagen`, `tipo`, `sesionId`, `ubicacion`,
  `observacion` en `POST /imagenes/subir`; y `sesionId`, `acta`, `imagenes`
  en `POST /acta/subir`.
- Solo `ok === true && persistido === true` confirma el acta. Una selección
  nueva invalida inmediatamente el estado anterior; un fallo conserva los archivos.
- Las imágenes se convierten a JPEG y se verifica el resultado y su tamaño
  antes de enviar: **15 MiB por evidencia**, **25 MiB por archivo del acta**.
  Una conversión fallida nunca envía silenciosamente el original.
  La comprobación de tipo, cabecera y final del PDF es **preliminar**:
  estructura, contenido y procesamiento seguro deben validarse en el backend.
- Se requiere al menos una previa y una posterior, **sin exigir igualdad**.
  Tras confirmar el informe se mantiene el descarte intencional de todas las
  evidencias temporales, incluidas las sobrantes sin pareja.
- Preparación, carga y generación bloquean edición, navegación del flujo,
  reinicio y cierre de sesión incompatibles. Los errores HTTP diferencian
  autenticación, permisos, validación, tamaño, servidor y conexión.
  Un 401 no redirige automáticamente borrando el estado del formulario.
- No hay reintentos automáticos de cargas ni de `GET /pdf/generar`, que
  **crea** un informe aunque utilice GET.
- Si la generación pierde la respuesta, vence o recibe un fallo de servidor,
  se consulta únicamente `GET /informes/utils/ultimo-por-sesion?sesionId=...`.
  Se verifica sesión, incidencia, ID de tienda y `createdAt >= inicio del intento`
  (sin aceptar fechas futuras). Se realizan hasta seis consultas separadas por
  15 s. Un 404 o un informe anterior no demuestra que la generación haya fallado.
  Si no se confirma, queda **incierto**, conservando los datos y ofreciendo
  “Consultar resultado”, sin limpiar la sesión ni habilitar otra generación.
  El resumen del intento se guarda en `sessionStorage` para recuperarlo al
  recargar esa pestaña. Los archivos de una cola de subida viven en memoria.
- La comparación de fechas es conservadora: relojes desincronizados pueden
  dejar el resultado incierto; nunca se recupera deliberadamente un informe con
  fecha anterior al intento. Un identificador de operación en el backend es
  necesario para correlación inequívoca entre pestañas o clientes concurrentes.
- Confirmar el informe y limpiar la sesión son resultados independientes:
  un fallo de limpieza conserva su enlace. “Nuevo informe” confirma la limpieza
  antes de habilitar una sesión vacía.
- Dashboard, Informes y los históricos de Tiendas reutilizan
  `GET /pdf/preview-link/:informeId`. Abrir/compartir usa `previewUrl`; no se
  reconstruyen URLs de almacenamiento ni se comparten enlaces temporales R2.
  El nombre `INFORME TÉCNICO-NUMERO DE INCIDENCIA-TIENDA.pdf` lo entrega y aplica
  el backend. La ventana se reserva antes de solicitar el enlace para mantener
  compatibilidad con bloqueadores de ventanas emergentes.

### Dependencias pendientes del backend

1. **Persistencia del acta:** corregir el guardado y su manejo transaccional.
   La respuesta `200 / ok:true / persistido:false` sigue siendo un fallo de
   persistencia; el frontend solo impide presentarlo como éxito. Reenviar imágenes
   del acta podría agregarlas otra vez si quedaron en memoria/almacenamiento.
2. **Control de errores y formatos:** validar realmente imágenes y PDFs, controlar
   errores de decodificación/PDF y evitar que un BMP u otro archivo cierre el
   proceso. La conversión del frontend no corrige ese fallo del servidor.
3. **Idempotencia/consulta de estado:** tras perder una respuesta, el servidor
   puede haber guardado una imagen aunque el contador local no la incluya.
   No es posible garantizar ausencia de duplicados con el contrato actual:
   hace falta idempotencia por archivo/operación o una consulta de estado.
   No se supone que exista ni se inventa un endpoint. El reintento manual de una
   carga incierta muestra ese riesgo. Para informes se necesita además un estado
   definitivo de operación que permita decidir cuándo regenerar con seguridad;
   consultar el último informe solo permite confirmar coincidencias.

### Verificación local

Las pruebas usan `fetch`, conversión de imágenes, ventanas y relojes simulados;
una ruta no simulada falla sin acceder a la red. Cubren fallo parcial y reintento,
contadores, acta no persistida y sustitución, conversión/tamaños, lotes de 40/80,
generación de 62 s, recuperación tardía frente a 404/históricos y vistas previas.
No escriben en producción. `package.json` incluye un mapeo solo para Jest 27
(CRA 5) porque React Router 7 distribuye sus entradas mediante `exports`.

No se han añadido retención ni eliminación programada; no se modifica ni
despliega el backend desde este proyecto.
