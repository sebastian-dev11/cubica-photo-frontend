// Create React App sustituye estas variables durante npm run build.
// Local y producción utilizan el mismo backend en Render.
export const API_URL = (
  process.env.REACT_APP_API_URL?.trim() || 'https://cubica-photo-app.onrender.com'
).replace(/\/+$/, '');

function timeout(value, fallback) {
  const number = Number(value);
  return value !== undefined && Number.isFinite(number) && number >= 0 ? number : fallback;
}

export const API_TIMEOUTS = {
  request: timeout(process.env.REACT_APP_REQUEST_TIMEOUT_MS, 30000),
  upload: timeout(process.env.REACT_APP_UPLOAD_TIMEOUT_MS, 180000),
  generate: timeout(process.env.REACT_APP_PDF_TIMEOUT_MS, 600000)
};
