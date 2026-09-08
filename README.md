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

La app requiere que el backend esté corriendo en https://cubica-photo-app.onrender.com.

Todos los datos subidos (imágenes y actas) se asocian al usuario y la tienda seleccionada.

Los PDFs generados abren en una nueva pestaña del navegador.