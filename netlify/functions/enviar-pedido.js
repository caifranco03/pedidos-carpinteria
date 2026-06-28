const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function generarExcelPython(piezas, cliente, fechaSolicitud, fechaEntrega) {
  const script = `
import openpyxl, base64, io, sys, json
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

piezas = json.loads(sys.argv[1])
cliente = sys.argv[2]
fecha_sol = sys.argv[3]
fecha_ent = sys.argv[4]

def cantos_a_codigo(c):
    l=(1 if c.get('izq') else 0)+(1 if c.get('der') else 0)
    k=(1 if c.get('sup') else 0)+(1 if c.get('inf') else 0)
    if l==0 and k==0: return ''
    if l==2 and k==2: return '4F'
    r=''
    if l==1: r+='1L'
    if l==2: r+='2L'
    if k==1: r+='1C'
    if k==2: r+='2C'
    return r

def mat_map(mat):
    m={'MDF 3mm':('MDF','3mm'),'MDF 6mm':('MDF','6mm'),'MDF 9mm':('MDF','9mm'),
       'MDF 15mm':('MDF','15mm'),'MDF 18mm':('MDF','18mm'),'MDF 25mm':('MDF','25mm'),
       'Melamina 18mm':('FAPLAC','18mm'),'Melamina 25mm':('FAPLAC','25mm'),
       'Terciado 4mm':('TERCIADO','4mm'),'Terciado 9mm':('TERCIADO','9mm'),
       'Terciado 18mm':('TERCIADO','18mm'),'OSB 15mm':('OSB','15mm')}
    return m.get(mat,('FAPLAC',mat))

def thin(): t=Side(style='thin'); return Border(left=t,right=t,top=t,bottom=t)
def medium(): t=Side(style='medium'); return Border(left=t,right=t,top=t,bottom=t)

wb=openpyxl.Workbook(); ws=wb.active; ws.title='Hoja1'
cw={'A':8.55,'B':8.44,'C':22.33,'D':7.11,'E':7.33,'F':10.44,'G':11.0,'H':25.44,'I':17.66,'J':19.33,'K':8.55}
for col,w in cw.items(): ws.column_dimensions[col].width=w
for r in range(2,14): ws.row_dimensions[r].height=15.9

ws.merge_cells('B2:J5'); c=ws['B2']; c.value='MATHER-PLAC'
c.font=Font(name='Tahoma',size=48); c.alignment=Alignment(horizontal='center',vertical='center')

ws.merge_cells('B6:J6'); c=ws['B6']; c.value='AYACUCHO 3239 LANUS ESTE'
c.font=Font(name='Tahoma',size=8,bold=True); c.alignment=Alignment(horizontal='center',vertical='center')

ws.merge_cells('B7:J7')

ws.merge_cells('B8:J8'); c=ws['B8']; c.value='SOLICITUD DE SERVICIO INTERNO'
c.font=Font(name='Tahoma',size=10,bold=True); c.alignment=Alignment(horizontal='center',vertical='center')

ws.merge_cells('B9:J9')

ws['B10'].value=' CLIENTE'; ws['B10'].font=Font(name='Tahoma',size=10); ws['B10'].alignment=Alignment(vertical='center')
ws.merge_cells('C10:G10'); ws.merge_cells('I10:J10')
ws['H10'].value=' FECHA SOLICITUD'; ws['H10'].font=Font(name='Tahoma',size=10)
ws['I10'].value=fecha_sol; ws['I10'].font=Font(name='Tahoma',size=10)

ws['B11'].value=cliente; ws['B11'].font=Font(name='Tahoma',size=10)
ws.merge_cells('C11:G11'); ws.merge_cells('I11:J11')
ws['H11'].value=' FECHA ENTREGA'; ws['H11'].font=Font(name='Tahoma',size=10)
ws['I11'].value=fecha_ent; ws['I11'].font=Font(name='Tahoma',size=10)

ws.merge_cells('B12:J12')

hdrs=[
  ('B13','ORDEN',False,None,thin()),
  ('C13','Filos / Código',True,None,thin()),
  ('D13','LARGO',True,'FF00B050',thin()),
  ('E13','ANCHO',True,'FFFFCCFF',thin()),
  ('F13','Cantidad ',True,None,medium()),
  ('G13','VETA',True,'FFFF0000',thin()),
  ('H13','No llenar Codigo  Maquina ',True,'FF7030A0',thin()),
  ('I13','MATERIAL',True,'FFDDDDDD',thin()),
  ('J13','COLOR',True,'FFFFFF00',thin()),
]
for coord,val,bold,bg,brd in hdrs:
  c=ws[coord]; c.value=val
  c.font=Font(name='Tahoma',size=10,bold=bold)
  c.alignment=Alignment(horizontal='center',vertical='center',wrap_text=True)
  c.border=brd
  if bg: c.fill=PatternFill('solid',fgColor=bg)

for i,p in enumerate(piezas):
  row=14+i; ws.row_dimensions[row].height=15.9
  mc,color=mat_map(p['mat'])
  veta=1 if 'madera' in p['mat'].lower() else 0
  cod=cantos_a_codigo(p.get('cantos',{}))
  data=[('B',i+1),('C',cod),('D',round(p['alto']*10)),('E',round(p['ancho']*10)),
        ('F',p['cant']),('G',veta if veta else None),('H',None),('I',mc),('J',color)]
  for col,val in data:
    c=ws[f'{col}{row}']; c.value=val
    c.font=Font(name='Tahoma',size=10)
    c.alignment=Alignment(horizontal='center',vertical='center')
    c.border=thin()

buf=io.BytesIO(); wb.save(buf)
print(base64.b64encode(buf.getvalue()).decode(), end='')
`;

  const tmpScript = path.join(os.tmpdir(), `gen_excel_${Date.now()}.py`);
  fs.writeFileSync(tmpScript, script);

  try {
    const b64 = execSync(
      `python3 "${tmpScript}" '${JSON.stringify(piezas).replace(/'/g, "'")}' "${cliente}" "${fechaSolicitud}" "${fechaEntrega}"`,
      { maxBuffer: 10 * 1024 * 1024 }
    ).toString().trim();
    fs.unlinkSync(tmpScript);
    return b64;
  } catch(e) {
    fs.unlinkSync(tmpScript);
    throw e;
  }
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
      xlsxB64 = generarExcelPython(
        b.piezas || [],
        b.nombre_cliente || 'Cliente',
        b.fecha_pedido || '',
        b.turno_fecha || ''
      );
      console.log('Excel generado con openpyxl, length:', xlsxB64.length);
    } catch(e) {
      console.error('Error openpyxl:', String(e));
    }

    const hoy = new Date();
    const fname = `Pedido_${(b.nombre_cliente||'Cliente').replace(/\s+/g,'_')}_${String(hoy.getDate()).padStart(2,'0')}${String(hoy.getMonth()+1).padStart(2,'0')}${hoy.getFullYear()}.xlsx`;

    const emailData = {
      from: 'onboarding@resend.dev',
      to: ['caifranco03@gmail.com'],
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
