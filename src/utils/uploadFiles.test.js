import {
  ACTA_MAX_BYTES, EVIDENCE_MAX_BYTES, optimizeImage, optimizeMany, validarImagen, validarPdf
} from './uploadFiles';

const jpeg = (name = 'foto.jpg') => new File([new Uint8Array([255, 216, 255, 217])], name, { type: 'image/jpeg' });
const jpegBlob = () => new Blob([new Uint8Array([255, 216, 255, 217])], { type: 'image/jpeg' });

beforeEach(() => {
  window.createImageBitmap = jest.fn(async () => ({ width: 2400, height: 1800, close: jest.fn() }));
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: jest.fn(), drawImage: jest.fn()
  });
  jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback) {
    callback(jpegBlob());
  });
});

afterEach(() => jest.restoreAllMocks());

test('una conversión fallida identifica el archivo y nunca devuelve el original BMP', async () => {
  HTMLCanvasElement.prototype.toBlob.mockImplementation((callback) => callback(null));
  const bmp = new File(['BM...'], 'incompatible.bmp', { type: 'image/bmp' });
  const [result] = await optimizeMany([bmp]);
  expect(result.original).toBe(bmp);
  expect(result.file).toBeNull();
  expect(result.error).toMatch(/incompatible\.bmp.*no pudo procesarse/);
});

test('convierte formatos decodificables a JPEG real y rechaza originales incompatibles', async () => {
  const bmp = new File(['BM...'], 'convertible.bmp', { type: 'image/bmp' });
  await expect(validarImagen(bmp)).rejects.toThrow('JPEG o PNG');
  const converted = await optimizeImage(bmp);
  expect(converted.type).toBe('image/jpeg');
  expect(converted.name).toBe('convertible-opt.jpg');
  await expect(validarImagen(converted)).resolves.toBe(converted);
  HTMLCanvasElement.prototype.toBlob.mockImplementation((callback) => callback(new Blob(['x'], { type: 'image/png' })));
  await expect(optimizeImage(bmp)).rejects.toThrow('convertible.bmp');
});

test.each([EVIDENCE_MAX_BYTES, ACTA_MAX_BYTES])('rechaza un resultado convertido que excede %s bytes', async (maxBytes) => {
  const bytes = new Uint8Array(maxBytes + 1);
  bytes.set([255, 216, 255]);
  HTMLCanvasElement.prototype.toBlob.mockImplementation((callback) => callback(new Blob([bytes], { type: 'image/jpeg' })));
  await expect(optimizeImage(jpeg(), { maxBytes })).rejects.toMatchObject({ kind: 'size' });
});

test('valida el tamaño final justo antes de enviar y acepta el límite inclusivo', async () => {
  const file = jpeg();
  Object.defineProperty(file, 'size', { value: EVIDENCE_MAX_BYTES, configurable: true });
  await expect(validarImagen(file)).resolves.toBe(file);
  Object.defineProperty(file, 'size', { value: EVIDENCE_MAX_BYTES + 1 });
  await expect(validarImagen(file)).rejects.toThrow('15 MiB');
  const corrupted = new File(['not jpeg'], 'corrupta.jpg', { type: 'image/jpeg' });
  await expect(validarImagen(corrupted)).rejects.toThrow('JPEG o PNG válida');
});

test('procesa 80 evidencias secuencialmente y conserva los resultados de todas', async () => {
  let active = 0;
  let peak = 0;
  window.createImageBitmap.mockImplementation(async () => {
    active += 1;
    peak = Math.max(peak, active);
    return { width: 1600, height: 1200, close: () => { active -= 1; } };
  });
  const results = await optimizeMany(Array.from({ length: 80 }, (_, index) => jpeg(`${index}.jpg`)));
  expect(results).toHaveLength(80);
  expect(results.every((item) => item.file && !item.error)).toBe(true);
  expect(peak).toBe(1);
});

test('PDF: comprobación preliminar de cabecera, final, tipo y límite de 25 MiB', async () => {
  const file = new File(['%PDF-1.7\ncontenido\n%%EOF'], 'acta.pdf', { type: 'application/pdf' });
  await expect(validarPdf(file)).resolves.toBe(file);
  await expect(validarPdf(new File(['%PDF-1.7\nincompleto'], 'truncado.pdf', { type: 'application/pdf' }))).rejects.toThrow('truncado.pdf');
  await expect(validarPdf(new File(['BM ... %%EOF'], 'falso.pdf', { type: 'application/pdf' }))).rejects.toThrow('cabecera');
  Object.defineProperty(file, 'size', { value: ACTA_MAX_BYTES + 1 });
  await expect(validarPdf(file)).rejects.toThrow('25 MiB');
});
