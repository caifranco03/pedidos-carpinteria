const https = require('https');

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: 'ok' };
  }

  try {
    const body = JSON.parse(event.body);
    const {
      nombre_cliente, tel_cliente, descripcion,
      turno_fecha, turno_hora, resumen_piezas,
      total_piezas, fecha_pedido, excel_base64, excel_filename
    } = body;

    console.log('Iniciando envío para:', nombre_cliente);
    console.log('Excel base64 length:', excel_base64 ? excel_base64.length : 0);

    const emailData = {
      from: 'onboarding@resend.dev',
      to: ['caifranco03@gmail.com'],
      subject: `Nuevo pedido de corte — ${nombre_cliente}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#5C3210,#B5651D);padding:20px;border-radius:12px 12px 0 0">
            <h1 style="color:white;margin:0;font-size:22px">🪵 Nuevo Pedido de Corte</h1>
          </div>
          <div style="background:#FDF6EC;padding:20px;border:1px solid #E2C99A;border-top:none">
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
              <tr><td style="padding:8px;font-weight:bold;color:#5C3210;width:140px">Cliente</td><td style="padding:8px">${nombre_cliente}</td></tr>
              <tr style="background:#F5E6D0"><td style="padding:8px;font-weight:bold;color:#5C3210">Teléfono</td><td style="padding:8px">${tel_cliente}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;color:#5C3210">Trabajo</td><td style="padding:8px">${descripcion || 'Sin descripción'}</td></tr>
              <tr style="background:#F5E6D0"><td style="padding:8px;font-weight:bold;color:#5C3210">Turno</td><td style="padding:8px">${turno_fecha} a las ${turno_hora} hs</td></tr>
              <tr><td style="padding:8px;font-weight:bold;color:#5C3210">Fecha pedido</td><td style="padding:8px">${fecha_pedido}</td></tr>
              <tr style="background:#F5E6D0"><td style="padding:8px;font-weight:bold;color:#5C3210">Total piezas</td><td style="padding:8px"><strong>${total_piezas} unidades</strong></td></tr>
            </table>
            <div style="background:white;border:1px solid #E2C99A;border-radius:8px;padding:16px;margin-bottom:16px">
              <h3 style="color:#5C3210;margin:0 0 12px 0">📐 Detalle de piezas</h3>
              <pre style="font-size:13px;color:#444;white-space:pre-wrap;margin:0">${resumen_piezas}</pre>
            </div>
            <div style="background:#7B4A1E;color:white;border-radius:8px;padding:14px;text-align:center">
              <strong>${excel_base64 ? 'El archivo Excel para la máquina está adjunto.' : 'Ver detalle de piezas arriba.'}</strong>
            </div>
          </div>
        </div>
      `
    };

    // Solo agregar adjunto si el Excel tiene contenido real
    if (excel_base64 && excel_base64.length > 100) {
      emailData.attachments = [{
        filename: excel_filename || 'pedido.xlsx',
        content: excel_base64
      }];
      console.log('Adjunto Excel incluido, tamaño:', excel_base64.length);
    } else {
      console.log('Sin adjunto Excel — base64 vacío o muy chico');
    }

    const emailPayload = JSON.stringify(emailData);
    console.log('Payload total:', emailPayload.length, 'bytes');

    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(emailPayload)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log('Resend status:', res.statusCode);
          console.log('Resend response:', data);
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        });
      });
      req.on('error', (e) => { console.error('Request error:', e); reject(e); });
      req.write(emailPayload);
      req.end();
    });

    if (result.status >= 400) throw new Error(JSON.stringify(result.body));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, id: result.body.id })
    };

  } catch (err) {
    console.error('Handler error:', String(err));
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: String(err) })
    };
  }
};
