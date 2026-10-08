import { TAREAS_LABEL, FREC_LABEL, calcHSemProrr, calcHMesProrr } from '../constants/tareas';
import { ROL_EMPLEADO_LABEL } from '../constants/roles';
import { ESTADO_LABEL } from './ausenciasEstado';
import { formatTramosTexto } from './horario';

const DIAS_LABEL={lunes:'Lun',martes:'Mar',miercoles:'Mié',jueves:'Jue',viernes:'Vie',sabado:'Sáb',domingo:'Dom'};
const DIAS_ORDEN=['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];

const fmtFecha=d=>d?new Date(d).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'}):'';
const tramoCob=c=>`${c.desde}${c.desde!==c.hasta?` – ${c.hasta}`:''}`;

export async function generarXLSXEmpleados(filas, coberturasHoyPorTurno){
  const { default: ExcelJS } = await import('exceljs');
  const wb=new ExcelJS.Workbook();

  const hEmp=wb.addWorksheet('Empleados');
  hEmp.columns=[
    { header:'Empleado',          key:'nombre',    width:32 },
    { header:'Estado hoy',        key:'estado',    width:12 },
    { header:'DNI',               key:'dni',       width:13 },
    { header:'Rol',               key:'rol',       width:17 },
    { header:'Teléfono',          key:'tlf',       width:14 },
    { header:'Email',             key:'email',     width:30 },
    { header:'Horas/sem asignadas', key:'hSem',    width:20, style:{ numFmt:'0.##' } },
    { header:'Horas/sem contrato',  key:'contrato',width:19, style:{ numFmt:'0.##' } },
    { header:'Excede contrato',   key:'excede',    width:15 },
    { header:'Nº turnos',         key:'nTurnos',   width:10 },
  ];

  const hTur=wb.addWorksheet('Turnos');
  hTur.columns=[
    { header:'Empleado',       key:'empleado',  width:32 },
    { header:'Cliente',        key:'cliente',   width:32 },
    { header:'Sucursal',       key:'sucursal',  width:20 },
    { header:'Zona',           key:'zona',      width:16 },
    { header:'Tipo servicio',  key:'tipo',      width:30 },
    { header:'Frecuencia',     key:'frec',      width:13 },
    { header:'Días',           key:'dias',      width:26 },
    { header:'Horario',        key:'horario',   width:26 },
    { header:'Horas',          key:'horas',     width:9,  style:{ numFmt:'0.##' } },
    { header:'Horas/sem prorr.', key:'hSem',    width:16, style:{ numFmt:'0.##' } },
    { header:'Horas/mes prorr.', key:'hMes',    width:16, style:{ numFmt:'0.##' } },
    { header:'Próxima fecha',  key:'proxima',   width:14 },
    { header:'Cobertura',      key:'cobertura', width:40 },
    { header:'Observaciones',  key:'obs',       width:50 },
  ];

  const filaTurno=(emp,t,cobertura)=>{
    const dias=[...(t.dias_semana||[])].sort((a,b)=>DIAS_ORDEN.indexOf(a)-DIAS_ORDEN.indexOf(b));
    const row=hTur.addRow({
      empleado: emp.nombre_display||emp.nombre,
      cliente:  t.furgoneta?`Furgoneta ${t.furgoneta.numero} (${t.furgoneta.matricula||''})`:(t.cliente?.nombre||''),
      sucursal: t.furgoneta?'':(t.cliente?.sucursal||''),
      zona:     t.furgoneta?'':(t.cliente?.zona||''),
      tipo:     TAREAS_LABEL[t.tipo_tarea]||t.tipo_tarea||'',
      frec:     FREC_LABEL[t.frecuencia]||t.frecuencia||'',
      dias:     dias.map(d=>DIAS_LABEL[d]||d).join(', '),
      horario:  formatTramosTexto(t.tramos).replace(/^—$/,''),
      horas:    t.horas_semana||'',
      hSem:     calcHSemProrr(t)||'',
      hMes:     calcHMesProrr(t)||'',
      proxima:  fmtFecha(t.proxima_fecha),
      cobertura,
      obs:      t.observaciones||'',
    });
    row.alignment={ vertical:'top', wrapText:true };
    return row;
  };

  filas.forEach(({empleado:e,turnos,estado,coberturasQueCubro})=>{
    const totalHSem=+turnos.reduce((acc,t)=>acc+calcHSemProrr(t),0).toFixed(2);
    const contrato=e.horas_semanales_contrato;
    hEmp.addRow({
      nombre:   e.nombre_display||e.nombre,
      estado:   estado?ESTADO_LABEL[estado]:'',
      dni:      e.dni||'',
      rol:      ROL_EMPLEADO_LABEL[e.rol]||e.rol||'',
      tlf:      e.tlf||'',
      email:    e.email||'',
      hSem:     totalHSem,
      contrato: contrato??'',
      excede:   contrato!=null&&totalHSem>contrato+0.01?'Sí':'',
      nTurnos:  turnos.length,
    });

    turnos.forEach(t=>{
      const c=coberturasHoyPorTurno[t._id];
      filaTurno(e,t,c?`Cubre: ${c.empleado_cubre?.nombre_display||'—'} (${tramoCob(c)})`:'');
    });
    coberturasQueCubro.forEach(c=>{
      if(!c.turno)return;
      const row=filaTurno(e,c.turno,`Cubre a ${c.empleado_ausente?.nombre_display||'—'} (${tramoCob(c)})`);
      row.fill={ type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFF4D6' } };
    });
  });

  const logo=await (await fetch(import.meta.env.BASE_URL + 'logo.png')).arrayBuffer();
  const logoId=wb.addImage({ buffer:logo, extension:'png' });
  [[hEmp,'Favila · Empleados'],[hTur,'Favila · Turnos']].forEach(([h,titulo])=>{
    const columnas=h.columnCount;
    h.spliceRows(1,0,[titulo],[]);
    h.getRow(1).height=46;
    h.getRow(1).getCell(1).font={ bold:true, size:15, color:{ argb:'FF125A37' } };
    h.getRow(1).getCell(1).alignment={ vertical:'middle', indent:5 };
    h.addImage(logoId,{ tl:{ col:0.15, row:0.1 }, ext:{ width:34, height:44 } });
    h.getRow(3).font={ bold:true };
    h.views=[{ state:'frozen', ySplit:3 }];
    h.autoFilter={ from:{ row:3, column:1 }, to:{ row:3, column:columnas } };
  });

  const buf=await wb.xlsx.writeBuffer();
  const url=URL.createObjectURL(new Blob([buf],{ type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a=document.createElement('a');
  a.href=url;
  a.download=`empleados-${new Date().toISOString().slice(0,10)}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
