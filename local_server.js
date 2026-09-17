const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const demoDir = __dirname;

const server = http.createServer((req, res) => {
  let decoded = decodeURI(req.url.split('?')[0]);

  // Endpoint API para recibir y guardar confirmaciones RSVP
  if (decoded === '/api/rsvp' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        data.fechaRegistro = new Date().toISOString();

        // 1. Guardar en confirmaciones_rsvp.json
        const jsonPath = path.join(demoDir, 'confirmaciones_rsvp.json');
        let records = [];
        if (fs.existsSync(jsonPath)) {
          try { records = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch(e){}
        }
        records.push(data);
        fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2), 'utf8');

        // 2. Guardar en confirmaciones_rsvp.csv (para abrir en Excel)
        const csvPath = path.join(demoDir, 'confirmaciones_rsvp.csv');
        const csvHeader = 'Fecha,Nombre,Asistencia,Acompañantes,Mensaje\n';
        if (!fs.existsSync(csvPath)) {
          fs.writeFileSync(csvPath, '\uFEFF' + csvHeader, 'utf8');
        }
        const row = [
          new Date().toLocaleString(),
          `"${(data.nombre || data.name || '').replace(/"/g, '""')}"`,
          `"${(data.asistencia || data.attendance || '').replace(/"/g, '""')}"`,
          `"${(data.acompanantes || '0').replace(/"/g, '""')}"`,
          `"${(data.mensaje || data.notes || '').replace(/"/g, '""')}"`
        ].join(',') + '\n';
        fs.appendFileSync(csvPath, row, 'utf8');

        console.log(`\n>>> [NUEVA CONFIRMACIÓN RSVP]`);
        console.log(`    Nombre: ${data.name}`);
        console.log(`    Email: ${data.email}`);
        console.log(`    Asistencia: ${data.attendance}`);
        console.log(`    Menú: ${data.starter} / ${data.entree} / ${data.dessert}\n`);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, message: 'Confirmación guardada con éxito' }));
      } catch (err) {
        console.error('Error guardando RSVP:', err);
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (decoded === '/' || decoded === '') decoded = '/index.html';

  // Si tiene barra al final de un archivo .html (ej. /Home.html/), redirigir
  if (decoded.match(/\.html\/+$/i)) {
    res.writeHead(301, { 'Location': decoded.replace(/\/+$/, '') });
    res.end();
    return;
  }

  // Si el navegador pide /Home.html/assets/... o /Home.html/Home_files/..., corregir la ruta
  decoded = decoded.replace(/^\/[^/]+\.html\//i, '/');

  // Si la petición es para el widget de reservación (RSVP)
  if (decoded.includes('_website-element-widget')) {
    decoded = '/website-element-widget.html';
  }

  // Si la ruta es /rsvp o /Home.html/rsvp
  if (decoded === '/rsvp') {
    decoded = '/RSVP.html';
  }

  let filePath = path.join(demoDir, decoded);
  if (!fs.existsSync(filePath)) {
    // Intentar buscar en RSVP_files por si acaso
    const altPath = path.join(demoDir, 'RSVP_files', path.basename(decoded));
    if (fs.existsSync(altPath)) filePath = altPath;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const stat = fs.statSync(filePath);
    const total = stat.size;

    if (ext === '.mp4' && req.headers.range) {
      const range = req.headers.range;
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const chunksize = (end - start) + 1;

      const file = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4'
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': total,
        'Content-Type': mimeTypes[ext] || 'application/octet-stream'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 No encontrado: ' + req.url);
  }
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}/Home.html`;
  console.log(`\n===========================================`);
  console.log(`  Web de Bodas (demo2) lista y funcionando`);
  console.log(`  URL: ${url}`);
  console.log(`  Presiona Ctrl + C para detener.`);
  console.log(`===========================================\n`);
  exec(`start ${url}`);
});

