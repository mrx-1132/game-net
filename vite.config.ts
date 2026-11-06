import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function smsProxyPlugin(): Plugin {
  return {
    name: 'sms-proxy-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/sms-ir')) {
          return next();
        }

        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Headers', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
          res.end();
          return;
        }

        const targetPath = req.url.replace(/^\/api\/sms-ir/, '') || '/';
        const targetUrl = `https://api.sms.ir/v1${targetPath}`;

        try {
          const headers: Record<string, string> = {
            'Accept': 'application/json',
          };
          if (req.headers['x-api-key']) {
            headers['x-api-key'] = String(req.headers['x-api-key']);
          }
          if (req.headers['content-type']) {
            headers['content-type'] = String(req.headers['content-type']);
          }

          let body: string | undefined = undefined;
          if (req.method === 'POST' || req.method === 'PUT') {
            body = await new Promise<string>((resolve, reject) => {
              let data = '';
              req.on('data', (chunk: any) => { data += chunk; });
              req.on('end', () => resolve(data));
              req.on('error', reject);
            });
          }

          const apiRes = await fetch(targetUrl, {
            method: req.method,
            headers,
            body: body || undefined,
          });

          const resData = await apiRes.text();
          res.statusCode = apiRes.status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Headers', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
          res.end(resData);
        } catch (error: any) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            status: 0,
            message: `خطای پروکسی محلی به سامانه SMS.ir: ${error?.message || error}`
          }));
        }
      });
    }
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), smsProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        // دو صفحه: برنامه اصلی و پنل مدیریت لایسنس (/admin روی سرور)
        input: {
          main: path.resolve(__dirname, 'index.html'),
          admin: path.resolve(__dirname, 'admin.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
