const RENDER_URL = 'https://cubica-photo-app.onrender.com';
const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
});

test.each(['development', 'production'])(
  '%s: sin configuración, las solicitudes van a Render y no al origen del frontend',
  async (environment) => {
    process.env.NODE_ENV = environment;
    delete process.env.REACT_APP_API_URL;
    fetch.mockResolvedValue({ ok: true, status: 200, text: async () => '[]' });
    let http;
    jest.isolateModules(() => {
      http = require('./http').http;
    });

    await http.get('/tiendas');

    expect(fetch).toHaveBeenCalledWith(`${RENDER_URL}/tiendas`, expect.any(Object));
  }
);

test('la configuración explícita de Render elimina espacios y la barra final', () => {
  process.env.REACT_APP_API_URL = ` ${RENDER_URL}/ `;
  jest.isolateModules(() => {
    expect(require('./apiConfig').API_URL).toBe(RENDER_URL);
  });
});
