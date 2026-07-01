const https = require('https');

// ── CRC32 ──
const CRC_TABLE = (() => {
  const t = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── ZIP builder ──
function u16(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; }

function buildZip(files) {
  const locals = [], cds = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nb = Buffer.from(name, 'utf8');
    const db = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const crc = crc32(db);
    const local = Buffer.concat([
      Buffer.from([0x50,0x4B,0x03,0x04]),
      u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(db.length), u32(db.length),
      u16(nb.length), u16(0), nb, db
    ]);
    cds.push(Buffer.concat([
      Buffer.from([0x50,0x4B,0x01,0x02]),
      u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(db.length), u32(db.length),
      u16(nb.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(offset), nb
    ]));
    locals.push(local);
    offset += local.length;
  }
  const cdBuf = Buffer.concat(cds);
  const eocd = Buffer.concat([
    Buffer.from([0x50,0x4B,0x05,0x06]),
    u16(0), u16(0), u16(cds.length), u16(cds.length),
    u32(cdBuf.length), u32(offset), u16(0)
  ]);
  return Buffer.concat([...locals, cdBuf, eocd]);
}

// ── Colores como bytes ARGB → packed int para xl/styles ──
// Usamos styles.xml mínimo con fills indexados
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// fillId mapping: 0=none,1=gray(pattern),2=green,3=pink,4=red,5=purple,6=gray2,7=yellow
const FILL_IDS = { none:0, green:2, pink:3, red:4, purple:5, gray:6, yellow:7 };

function genStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="5">
  <font><sz val="11"/><name val="Calibri"/></font>
  <font><sz val="48"/><name val="Tahoma"/></font>
  <font><sz val="8"/><b/><name val="Tahoma"/></font>
  <font><sz val="10"/><b/><name val="Tahoma"/></font>
  <font><sz val="10"/><name val="Tahoma"/></font>
</fonts>
<fills count="8">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF00B050"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFFCCFF"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFF0000"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF7030A0"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFDDDDDD"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/></patternFill></fill>
</fills>
<borders count="3">
  <border><left/><right/><top/><bottom/></border>
  <border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom></border>
  <border><left style="medium"><color auto="1"/></left><right style="medium"><color auto="1"/></right><top style="medium"><color auto="1"/></top><bottom style="medium"><color auto="1"/></bottom></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="5" borderId="2" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="6" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="7" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
</cellXfs>
</styleSheet>`;
}

// xfId para cada header column: ORDEN=3,FilosCod=3,LARGO=5,ANCHO=6,Cant=8 (medium+nofill wait→8 purple),VETA=7,NoLlenar=8,MATERIAL=9,COLOR=10
// Corregido: Cantidad usa border medium sin fill → xf especial
// xf index: 0=default,1=tahoma48center,2=tahoma8bold,3=tahoma10bold-center,4=tahoma10-center,5=LARGO,6=ANCHO,7=VETA,8=NoLlenar,9=MATERIAL,10=COLOR,11=data(thin)

function cell(ref, val, s) {
  if (val === null || val === undefined || val === '') return `<c r="${ref}" s="${s}"/>`;
  if (typeof val === 'number') return `<c r="${ref}" t="n" s="${s}"><v>${val}</v></c>`;
  return `<c r="${ref}" t="inlineStr" s="${s}"><is><t>${esc(val)}</t></is></c>`;
}

function genSheet(piezas, cliente, fechaSol, fechaEnt, obs) {
  obs = obs || '';
  const matMap = {
    'Egger Liso':  ['EGGER','LISO'],
    'Egger Veta':  ['EGGER','VETA'],
    'Faplac Liso': ['FAPLAC','LISO'],
    'Faplac Veta': ['FAPLAC','VETA']
  };
  function cantos(c) {
    const l=(c.izq?1:0)+(c.der?1:0), k=(c.sup?1:0)+(c.inf?1:0);
    if(!l&&!k) return '';
    if(l===2&&k===2) return '4F';
    return (l===1?'1L':l===2?'2L':'')+(k===1?'1C':k===2?'2C':'');
  }

  const colW = [
    {min:1,max:1,width:8.55},{min:2,max:2,width:8.44},{min:3,max:3,width:22.33},
    {min:4,max:4,width:7.11},{min:5,max:5,width:7.33},{min:6,max:6,width:10.44},
    {min:7,max:7,width:11.0},{min:8,max:8,width:25.44},{min:9,max:9,width:17.66},
    {min:10,max:10,width:19.33},{min:11,max:11,width:8.55}
  ];
  const colXml = colW.map(c=>`<col min="${c.min}" max="${c.max}" width="${c.width}" customWidth="1"/>`).join('');

  const rowH = 15.9;
  const merges = [
    'B2:J5','B6:J6','B7:J7','B8:J8','B9:J9',
    'C10:G10','I10:J10','C11:G11','I11:J11','B12:J12'
  ];

  const rows = [];
  // Row 2–5: MATHER-PLAC (merged, s=1 tahoma48)
  rows.push(`<row r="2" ht="${rowH}" customHeight="1"><c r="B2" t="inlineStr" s="1"><is><t>MATHER-PLAC</t></is></c></row>`);
  rows.push(`<row r="3" ht="${rowH}" customHeight="1"/>`);
  rows.push(`<row r="4" ht="${rowH}" customHeight="1"/>`);
  rows.push(`<row r="5" ht="${rowH}" customHeight="1"/>`);
  // Row 6: dirección s=2
  rows.push(`<row r="6" ht="${rowH}" customHeight="1"><c r="B6" t="inlineStr" s="2"><is><t>AYACUCHO 3239 LANUS ESTE</t></is></c></row>`);
  // Row 7: vacío
  rows.push(`<row r="7" ht="${rowH}" customHeight="1"/>`);
  // Row 8: SOLICITUD s=3
  rows.push(`<row r="8" ht="${rowH}" customHeight="1"><c r="B8" t="inlineStr" s="3"><is><t>SOLICITUD DE SERVICIO INTERNO</t></is></c></row>`);
  // Row 9: vacío
  rows.push(`<row r="9" ht="${rowH}" customHeight="1"/>`);
  // Row 10: CLIENTE / FECHA SOLICITUD
  rows.push(`<row r="10" ht="${rowH}" customHeight="1">${cell('B10',' CLIENTE',4)}${cell('H10',' FECHA SOLICITUD',4)}${cell('I10',fechaSol,4)}</row>`);
  // Row 11: valor cliente / FECHA ENTREGA
  rows.push(`<row r="11" ht="${rowH}" customHeight="1">${cell('B11',cliente,4)}${cell('H11',' FECHA ENTREGA',4)}${cell('I11',fechaEnt,4)}</row>`);
  // Row 12: observaciones si las hay
  if(obs) {
    rows.push(`<row r="12" ht="${rowH}" customHeight="1">${cell('B12',' OBS: '+obs,4)}</row>`);
  } else {
    rows.push(`<row r="12" ht="${rowH}" customHeight="1"/>`);
  }
  // Row 13: headers — s indices: ORDEN=3,FilosCod=3,LARGO=5,ANCHO=6,Cant(medium)=8,VETA=7,NoLlenar=8,MATERIAL=9,COLOR=10
  rows.push(`<row r="13" ht="${rowH}" customHeight="1">
    ${cell('B13','ORDEN',3)}
    ${cell('C13','Filos / Código',3)}
    ${cell('D13','LARGO',5)}
    ${cell('E13','ANCHO',6)}
    ${cell('F13','Cantidad ',8)}
    ${cell('G13','VETA',7)}
    ${cell('H13','No llenar Codigo  Maquina ',8)}
    ${cell('I13','MATERIAL',9)}
    ${cell('J13','COLOR',10)}
  </row>`);

  // Datos
  piezas.forEach((p, i) => {
    const r = 14 + i;
    const mc = matMap[p.mat] || ['FAPLAC', p.mat];
    const veta = p.mat.toLowerCase().includes('madera') ? 1 : null;
    const cod = p.canto || '';
    rows.push(`<row r="${r}" ht="${rowH}" customHeight="1">
      ${cell(`B${r}`, i+1, 11)}
      ${cell(`C${r}`, cod, 11)}
      ${cell(`D${r}`, Math.round(p.ancho), 11)}
      ${cell(`E${r}`, Math.round(p.alto), 11)}
      ${cell(`F${r}`, p.cant, 11)}
      ${cell(`G${r}`, veta, 11)}
      ${cell(`H${r}`, null, 11)}
      ${cell(`I${r}`, mc[0], 11)}
      ${cell(`J${r}`, mc[1], 11)}
    </row>`);
  });

  const mergeXml = merges.map(m=>`<mergeCell ref="${m}"/>`).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetFormatPr defaultRowHeight="${rowH}" customHeight="1"/>
<cols>${colXml}</cols>
<sheetData>${rows.join('')}</sheetData>
<mergeCells count="${merges.length}">${mergeXml}</mergeCells>
</worksheet>`;
}

function generarXlsx(piezas, cliente, fechaSol, fechaEnt, obs) {
  obs = obs || '';
  const sheet = genSheet(piezas, cliente, fechaSol, fechaEnt, obs);
  const zip = buildZip({
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': sheet,
    'xl/styles.xml': genStyles()
  });
  return zip.toString('base64');
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

    let xlsxB64 = '';
    try {
      xlsxB64 = generarXlsx(b.piezas||[], b.nombre_cliente||'Cliente', b.fecha_pedido||'', b.turno_fecha||'', b.observaciones||'');
      console.log('Excel OK, length:', xlsxB64.length);
    } catch(e) {
      console.error('Excel error:', String(e));
    }

    const hoy = new Date();
    const dd = String(hoy.getDate()).padStart(2,'0');
    const mm = String(hoy.getMonth()+1).padStart(2,'0');
    const yyyy = hoy.getFullYear();
    const fname = `Pedido_${(b.nombre_cliente||'Cliente').replace(/\s+/g,'_')}_${dd}${mm}${yyyy}.xlsx`;

    const emailData = {
      from: 'onboarding@resend.dev',
      to: ['davidkozakiewicz008@gmail.com'],
      subject: `Nuevo pedido de corte — ${b.nombre_cliente}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:linear-gradient(135deg,#5C3210,#B5651D);padding:20px;border-radius:12px 12px 0 0"><h1 style="color:white;margin:0">🪵 Nuevo Pedido de Corte</h1></div><div style="background:#FDF6EC;padding:20px;border:1px solid #E2C99A;border-top:none"><table style="width:100%;border-collapse:collapse;margin-bottom:20px"><tr><td style="padding:8px;font-weight:bold;color:#5C3210">Cliente</td><td>${b.nombre_cliente}</td></tr><tr style="background:#F5E6D0"><td style="padding:8px;font-weight:bold;color:#5C3210">Teléfono</td><td>${b.tel_cliente}</td></tr><tr><td style="padding:8px;font-weight:bold;color:#5C3210">Trabajo</td><td>${b.descripcion||'—'}</td></tr><tr style="background:#F5E6D0"><td style="padding:8px;font-weight:bold;color:#5C3210">Turno</td><td>${b.turno_fecha} a las ${b.turno_hora} hs</td></tr><tr><td style="padding:8px;font-weight:bold;color:#5C3210">Total piezas</td><td><strong>${b.total_piezas} unidades</strong></td></tr></table><div style="background:white;border:1px solid #E2C99A;border-radius:8px;padding:16px;margin-bottom:16px"><h3 style="color:#5C3210;margin:0 0 12px 0">📐 Detalle</h3><pre style="font-size:13px;color:#444;white-space:pre-wrap;margin:0">${b.resumen_piezas}</pre></div><div style="background:#7B4A1E;color:white;border-radius:8px;padding:14px;text-align:center"><strong>El Excel para la máquina está adjunto.</strong></div></div></div>`
    };

    if (xlsxB64 && xlsxB64.length > 100) {
      emailData.attachments = [{ filename: fname, content: xlsxB64 }];
    }

    const payload = JSON.stringify(emailData);
    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname:'api.resend.com', path:'/emails', method:'POST',
        headers:{'Authorization':`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}
      }, (res) => {
        let data='';
        res.on('data',c=>data+=c);
        res.on('end',()=>{ console.log('Resend:',res.statusCode,data); resolve({status:res.statusCode,body:JSON.parse(data)}); });
      });
      req.on('error',reject);
      req.write(payload); req.end();
    });

    if (result.status >= 400) throw new Error(JSON.stringify(result.body));
    return { statusCode:200, headers, body:JSON.stringify({ok:true}) };

  } catch(err) {
    console.error('Error:', String(err));
    return { statusCode:500, headers, body:JSON.stringify({ok:false,error:String(err)}) };
  }
};
