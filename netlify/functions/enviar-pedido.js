const https = require('https');

function escXml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function writeU16(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }
function writeU32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; }

function crc32(buf) {
  const t = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function buildZip(files) {
  const entries = [], cd = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nb = Buffer.from(name, 'utf8');
    const db = Buffer.from(content, 'utf8');
    const crc = crc32(db);
    const lh = Buffer.concat([
      Buffer.from([0x50,0x4B,0x03,0x04]),
      writeU16(20), writeU16(0), writeU16(0), writeU16(0), writeU16(0),
      writeU32(crc), writeU32(db.length), writeU32(db.length),
      writeU16(nb.length), writeU16(0), nb, db
    ]);
    cd.push(Buffer.concat([
      Buffer.from([0x50,0x4B,0x01,0x02]),
      writeU16(20), writeU16(20), writeU16(0), writeU16(0), writeU16(0), writeU16(0),
      writeU32(crc), writeU32(db.length), writeU32(db.length),
      writeU16(nb.length), writeU16(0), writeU16(0), writeU16(0), writeU16(0),
      writeU32(0), writeU32(offset), nb
    ]));
    entries.push(lh);
    offset += lh.length;
  }
  const cdb = Buffer.concat(cd);
  const eocd = Buffer.concat([
    Buffer.from([0x50,0x4B,0x05,0x06]),
    writeU16(0), writeU16(0),
    writeU16(cd.length), writeU16(cd.length),
    writeU32(cdb.length), writeU32(offset),
    writeU16(0)
  ]);
  return Buffer.concat([...entries, cdb, eocd]).toString('base64');
}

function generarXlsx(piezas, cliente, fechaSol, fechaEnt) {
  const matMap = {
    'MDF 3mm':['MDF','3mm'],'MDF 6mm':['MDF','6mm'],'MDF 9mm':['MDF','9mm'],
    'MDF 15mm':['MDF','15mm'],'MDF 18mm':['MDF','18mm'],'MDF 25mm':['MDF','25mm'],
    'Melamina 18mm':['FAPLAC','18mm'],'Melamina 25mm':['FAPLAC','25mm'],
    'Terciado 4mm':['TERCIADO','4mm'],'Terciado 9mm':['TERCIADO','9mm'],
    'Terciado 18mm':['TERCIADO','18mm'],'OSB 15mm':['OSB','15mm']
  };

  const rows = [
    ['MATHER-PLAC','','','','','','','',''],
    ['AYACUCHO 3239 LANUS ESTE','','','','','','','',''],
    ['SOLICITUD DE SERVICIO INTERNO','','','','','','','',''],
    ['CLIENTE: '+cliente,'','','','','FECHA: '+fechaSol,'','',''],
    ['ORDEN','Filos / Código','LARGO','ANCHO','Cantidad','VETA','No llenar Codigo Maquina','MATERIAL','COLOR'],
    ...piezas.map((p, i) => {
      const largos = (p.cantos&&p.cantos.izq?1:0)+(p.cantos&&p.cantos.der?1:0);
      const cortos = (p.cantos&&p.cantos.sup?1:0)+(p.cantos&&p.cantos.inf?1:0);
      let cod = '';
      if (largos===2&&cortos===2) cod='4F';
      else { if(largos===1)cod+='1L'; if(largos===2)cod+='2L'; if(cortos===1)cod+='1C'; if(cortos===2)cod+='2C'; }
      const mc = matMap[p.mat]||['FAPLAC',p.mat];
      return [i+1, cod, Math.round(p.alto*10), Math.round(p.ancho*10), p.cant, 0, '', mc[0], mc[1]];
    })
  ];

  const xmlRows = rows.map((row, ri) =>
    `<row r="${ri+1}">${row.map((v, ci) => {
      const ref = String.fromCharCode(65+ci)+(ri+1);
      return typeof v==='number'
        ? `<c r="${ref}"><v>${v}</v></c>`
        : `<c r="${ref}" t="inlineStr"><is><t>${escXml(v)}</t></is></c>`;
    }).join('')}</row>`
  ).join('');

  return buildZip({
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Pedido" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRows}</sheetData></worksheet>`
  });
}

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers, body:'ok' };

  try {
    const b = JSON.parse(event.body);
    console.log('Pedido de:', b.nombre_cliente, '| Piezas:', b.piezas ? b.piezas.length : 0);

    const xlsxB64 = generarXlsx(b.piezas||[], b.nombre_cliente, b.fecha_pedido, b.turno_fecha);
    console.log('Excel generado, length:', xlsxB64.length);

    const hoy = new Date();
    const fname = `Pedido_${(b.nombre_cliente||'Cliente').replace(/\s+/g,'_')}_${String(hoy.getDate()).padStart(2,'0')}${String(hoy.getMonth()+1).padStart(2,'0')}${hoy.getFullYear()}.xlsx`;

    const payload = JSON.stringify({
      from: 'onboarding@resend.dev',
      to: ['caifranco03@gmail.com'],
      subject: `Nuevo pedido de corte — ${b.nombre_cliente}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:linear-gradient(135deg,#5C3210,#B5651D);padding:20px;border-radius:12px 12px 0 0"><h1 style="color:white;margin:0">🪵 Nuevo Pedido de Corte</h1></div><div style="background:#FDF6EC;padding:20px;border:1px solid #E2C99A;border-top:none"><table style="width:100%;border-collapse:collapse;margin-bottom:20px"><tr><td style="padding:8px;font-weight:bold;color:#5C3210">Cliente</td><td>${b.nombre_cliente}</td></tr><tr style="background:#F5E6D0"><td style="padding:8px;font-weight:bold;color:#5C3210">Teléfono</td><td>${b.tel_cliente}</td></tr><tr><td style="padding:8px;font-weight:bold;color:#5C3210">Trabajo</td><td>${b.descripcion||'—'}</td></tr><tr style="background:#F5E6D0"><td style="padding:8px;font-weight:bold;color:#5C3210">Turno</td><td>${b.turno_fecha} a las ${b.turno_hora} hs</td></tr><tr><td style="padding:8px;font-weight:bold;color:#5C3210">Total piezas</td><td><strong>${b.total_piezas} unidades</strong></td></tr></table><div style="background:white;border:1px solid #E2C99A;border-radius:8px;padding:16px;margin-bottom:16px"><h3 style="color:#5C3210;margin:0 0 12px 0">📐 Detalle</h3><pre style="font-size:13px;color:#444;white-space:pre-wrap;margin:0">${b.resumen_piezas}</pre></div><div style="background:#7B4A1E;color:white;border-radius:8px;padding:14px;text-align:center"><strong>El Excel para la máquina está adjunto.</strong></div></div></div>`,
      attachments: [{ filename: fname, content: xlsxB64 }]
    });

    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname:'api.resend.com', path:'/emails', method:'POST',
        headers:{ 'Authorization':`Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(payload) }
      }, (res) => {
        let data='';
        res.on('data', c => data+=c);
        res.on('end', () => { console.log('Resend:', res.statusCode, data); resolve({status:res.statusCode, body:JSON.parse(data)}); });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    if (result.status >= 400) throw new Error(JSON.stringify(result.body));
    return { statusCode:200, headers, body:JSON.stringify({ok:true}) };

  } catch(err) {
    console.error('Error:', String(err));
    return { statusCode:500, headers, body:JSON.stringify({ok:false, error:String(err)}) };
  }
};
