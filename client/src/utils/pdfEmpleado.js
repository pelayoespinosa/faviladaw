import jsPDF from 'jspdf';
import { TAREAS_LABEL, TAREAS_MEC, FREC_LABEL, calcHSemProrr, calcHMesProrr, formatH } from '../constants/tareas';
import { formatTramosTexto } from './horario';

const DIAS_LABEL={lunes:'Lunes',martes:'Martes',miercoles:'Miércoles',jueves:'Jueves',viernes:'Viernes',sabado:'Sábado',domingo:'Domingo'};
const DIAS_ORDEN=['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];

async function cargarLogo() {
  const res = await fetch(import.meta.env.BASE_URL + 'logo.png');
  const blob = await res.blob();
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

export async function generarPDFEmpleado(empleado, turnos){
  const logoData = await cargarLogo();

  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W=210,H=297,M=15,AW=W-M*2;
  let y=M;

  const VERDE=[32,158,96],VERDE_DK=[18,90,55],VERDE_MK=[24,110,68],GRIS=[245,247,246];
  const GRIS_DK=[180,190,185],NEGRO=[30,35,32],BLANCO=[255,255,255];
  const AMBER=[200,140,20];

  const HDR=52;
  doc.setFillColor(...VERDE_DK);
  doc.rect(0,0,W,HDR,'F');

  doc.setFillColor(...VERDE_MK);
  doc.rect(0,HDR-8,W,8,'F');

  const LOGO_H=34, LOGO_W=LOGO_H*(377/591);
  doc.addImage(logoData,'PNG',W-M-LOGO_W,HDR/2-LOGO_H/2,LOGO_W,LOGO_H);

  doc.setTextColor(...BLANCO);
  doc.setFont('helvetica','bold');
  doc.setFontSize(22);
  doc.text('Favila',M,22);
  doc.setFont('helvetica','normal');
  doc.setFontSize(10);
  doc.setTextColor(200,235,215);
  doc.text('Cuadro de turnos del empleado',M,30);
  doc.setFontSize(8);
  doc.setTextColor(160,210,185);
  doc.text(new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'}),M,38);

  y=HDR+10;

  doc.setFillColor(...GRIS);
  doc.roundedRect(M,y,AW,18,3,3,'F');

  doc.setFillColor(...VERDE);
  doc.roundedRect(M,y,4,18,1,1,'F');

  doc.setTextColor(...VERDE_DK);
  doc.setFont('helvetica','bold');
  doc.setFontSize(13);
  doc.text(empleado.nombre_display||empleado.nombre,M+8,y+12);

  const totalH=turnos.reduce((acc,t)=>acc+calcHSemProrr(t),0);
  doc.setFillColor(...VERDE);
  doc.roundedRect(W-M-44,y+2,44,14,3,3,'F');
  doc.setTextColor(...BLANCO);
  doc.setFont('helvetica','bold');
  doc.setFontSize(10);
  doc.text(formatH(totalH)+'/sem',W-M-22,y+11,{align:'center'});

  y+=26;

  doc.setTextColor(...VERDE_DK);
  doc.setFont('helvetica','bold');
  doc.setFontSize(9);
  doc.text(`${turnos.length} turno${turnos.length!==1?'s':''} asignados`,M,y+5);
  doc.setDrawColor(...GRIS_DK);
  doc.setLineWidth(0.3);
  doc.line(M,y+8,W-M,y+8);
  y+=14;

  for(const t of turnos){
    const esMec=TAREAS_MEC.has(t.tipo_tarea);
    const esJardin=t.tipo_tarea==='jardin';
    const noSemanal=t.frecuencia!=='semanal'||esJardin;
    const hP=calcHSemProrr(t);
    const dias=[...(t.dias_semana||[])].sort((a,b)=>DIAS_ORDEN.indexOf(a)-DIAS_ORDEN.indexOf(b));
    const diasStr=dias.map(d=>DIAS_LABEL[d]||d).join(', ')||'—';
    const direccionCliente=[t.cliente?.direccion_real||t.cliente?.direccion_facturacion,t.cliente?.cp,t.cliente?.provincia].filter(Boolean).join(', ');
    const extraLines=(t.cliente?.zona?1:0)+(direccionCliente?1:0);
    const cardH=t.observaciones?42+extraLines*6:36+extraLines*6;

    if(y+cardH>H-18){doc.addPage();y=M+8;}

    doc.setFillColor(...GRIS);
    doc.roundedRect(M,y,AW,cardH,2,2,'F');
    doc.setFillColor(...(esMec?AMBER:VERDE));
    doc.roundedRect(M,y,4,cardH,1,1,'F');

    const nomCliente=t.furgoneta?`Furgoneta ${t.furgoneta.numero}`:(t.cliente?.sucursal?`${t.cliente.nombre} — ${t.cliente.sucursal}`:t.cliente?.nombre||'—');
    doc.setTextColor(...NEGRO);
    doc.setFont('helvetica','bold');
    doc.setFontSize(10);
    doc.text(nomCliente,M+8,y+8);

    let subY=y+14;
    if(t.cliente?.zona){
      doc.setFont('helvetica','normal');
      doc.setFontSize(8);
      doc.setTextColor(...GRIS_DK);
      doc.text(t.cliente.zona,M+8,subY);
      subY+=6;
    }
    if(direccionCliente){
      doc.setFont('helvetica','normal');
      doc.setFontSize(8);
      doc.setTextColor(...GRIS_DK);
      doc.text(direccionCliente,M+8,subY);
    }

    const tareaLabel=TAREAS_LABEL[t.tipo_tarea]||t.tipo_tarea||'—';
    doc.setFillColor(...(esMec?[255,240,200]:[210,245,225]));
    doc.roundedRect(W-M-54,y+3,54,8,2,2,'F');
    doc.setTextColor(...(esMec?AMBER:VERDE_DK));
    doc.setFont('helvetica','bold');
    doc.setFontSize(7.5);
    doc.text(tareaLabel,W-M-27,y+8.5,{align:'center'});

    const sepY=y+17+extraLines*6;
    doc.setDrawColor(...GRIS_DK);
    doc.setLineWidth(0.2);
    doc.line(M+6,sepY,W-M-4,sepY);

    const cw=AW/4;
    const cols=[M+8,M+cw+4,M+cw*2+4,M+cw*3+4];

    doc.setTextColor(100,120,110);
    doc.setFont('helvetica','normal');
    doc.setFontSize(7);
    doc.text('DÍAS',cols[0],sepY+5);
    doc.text('HORARIO',cols[1],sepY+5);
    doc.text(esJardin?'HORAS/MES':'HORAS/SEM',cols[2],sepY+5);
    if(noSemanal)doc.text('FRECUENCIA',cols[3],sepY+5);

    doc.setTextColor(...NEGRO);
    doc.setFont('helvetica','bold');
    doc.setFontSize(8.5);
    doc.text(diasStr,cols[0],sepY+11,{maxWidth:cw-4});
    doc.text(formatTramosTexto(t.tramos),cols[1],sepY+11);
    doc.text(t.horas_semana?`${t.horas_semana}h${noSemanal?` (${esJardin?formatH(calcHMesProrr(t)):formatH(hP)})`:''}` :'—',cols[2],sepY+11);
    if(noSemanal)doc.text(esJardin?'27/año (media)':FREC_LABEL[t.frecuencia]||'—',cols[3],sepY+11);

    if(t.observaciones){
      doc.setFont('helvetica','italic');
      doc.setFontSize(7.5);
      doc.setTextColor(130,150,140);
      doc.text(`Obs: ${t.observaciones}`,M+8,sepY+20,{maxWidth:AW-14});
    }

    y+=cardH+4;
  }

  const totalPags=doc.getNumberOfPages();
  for(let i=1;i<=totalPags;i++){
    doc.setPage(i);
    doc.setFillColor(...VERDE_DK);
    doc.rect(0,H-10,W,10,'F');
    doc.setTextColor(160,210,185);
    doc.setFont('helvetica','normal');
    doc.setFontSize(7);
    doc.text('Favila — Documento generado automáticamente',M,H-4);
    doc.text(`Página ${i} de ${totalPags}`,W-M,H-4,{align:'right'});
  }

  doc.save(`turnos_${(empleado.nombre_completo||empleado.nombre).replace(/\s+/g,'_').toLowerCase()}.pdf`);
}
