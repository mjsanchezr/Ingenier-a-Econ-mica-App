import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale,
  PointElement, LineElement,
  BarElement, Filler
} from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import {
  Landmark, Calculator, FileDown, Info, BookOpen, Menu, X,
  TrendingDown, DollarSign, Percent, Clock, ChevronDown, ChevronUp,
  ArrowRight, BarChart2, PieChart, Activity, AlertCircle, CheckCircle,
  PanelLeftClose, PanelLeft
} from 'lucide-react';
import { calculateAmortization } from './utils/finance';

ChartJS.register(
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale,
  PointElement, LineElement,
  BarElement, Filler
);

// ── Datos reales Reserva Federal 2026 ────────────────────────────────
const FED_MIN = 3.50, FED_MAX = 3.75, FED_MID = (FED_MIN + FED_MAX) / 2;

// ── Formato de moneda ─────────────────────────────────────────────────
const fmt = (v, cur = '$') =>
  `${cur}${Number(v).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtN = (v, d = 2) => Number(v).toFixed(d);

// ── Definiciones de Ingeniería Económica para cada KPI ───────────────
const KPI_INFO = {
  'Cuota Mensual': {
    icon: '💳',
    formula: 'A = P · [ r·(1+r)ⁿ ] / [ (1+r)ⁿ − 1 ]',
    title: 'Cuota Mensual (Anualidad A)',
    body: `
      <p style="margin-bottom:10px">En Ingeniería Económica, la <strong>cuota mensual</strong> representa el flujo de efectivo constante periódico derivado del modelo de <em>Anualidad Ordinaria Vencida</em>.</p>
      <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:10px 14px;font-family:monospace;font-weight:700;text-align:center;color:#3730a3;margin:10px 0">
        A = P · [ r·(1+r)ⁿ ] / [ (1+r)ⁿ − 1 ]
      </div>
      <p>Donde <strong>P</strong> es el capital prestado, <strong>r</strong> la tasa mensual efectiva y <strong>n</strong> el plazo en meses. La cuota es <em>constante</em> porque aplica el principio de <strong>equivalencia financiera</strong>: el valor presente de todos los pagos iguala exactamente al capital recibido hoy.</p>
      <p style="margin-top:8px;color:#64748b;font-size:0.85em">↗ Aumentar P o r eleva A · ↘ Aumentar n reduce A pero incrementa el total de intereses pagados.</p>
    `
  },
  'Total Intereses': {
    icon: '📈',
    title: 'Total de Intereses Pagados',
    body: `
      <p style="margin-bottom:10px">Representa el <strong>costo financiero neto</strong> del crédito: la diferencia entre el total desembolsado y el capital recibido.</p>
      <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;padding:10px 14px;font-family:monospace;font-weight:700;text-align:center;color:#be123c;margin:10px 0">
        Intereses Totales = (A × n) − P
      </div>
      <p>Desde la perspectiva del <strong>Valor del Dinero en el Tiempo (TVM)</strong>, los intereses compensan al acreedor por el costo de oportunidad de no disponer del capital durante el plazo. El monto crece exponencialmente con la tasa y linealmente con el plazo.</p>
      <p style="margin-top:8px;color:#64748b;font-size:0.85em">↗ A mayor plazo o mayor tasa, mayor es este valor. Es el indicador más directo del costo real del préstamo.</p>
    `
  },
  'Total a Pagar': {
    icon: '💰',
    title: 'Total a Pagar (Monto Total Desembolsado)',
    body: `
      <p style="margin-bottom:10px">Suma acumulada de todos los pagos periódicos durante la vida del crédito.</p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;font-family:monospace;font-weight:700;text-align:center;color:#92400e;margin:10px 0">
        Total = A × n = P + Intereses Totales
      </div>
      <p>Este valor cuantifica el <strong>flujo de caja total de salida</strong> durante el período del préstamo. En un diagrama de flujo de efectivo (CFD), corresponde a la suma de todos los vectores descendentes. Permite evaluar si el beneficio obtenido con el préstamo supera su costo de oportunidad.</p>
    `
  },
  'Sobrecosto': {
    icon: '⚠️',
    title: 'Sobrecosto Financiero (%)',
    body: `
      <p style="margin-bottom:10px">Mide el <strong>porcentaje de intereses pagados sobre el capital original</strong>. Es el indicador más claro del costo relativo del crédito.</p>
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:10px 14px;font-family:monospace;font-weight:700;text-align:center;color:#5b21b6;margin:10px 0">
        Sobrecosto = (Intereses Totales / P) × 100
      </div>
      <p>En Ingeniería Económica se relaciona con el concepto de <em>costo de oportunidad</em>: si este % supera el rendimiento que obtendrías invirtiendo ese mismo capital, el préstamo resulta financieramente desventajoso. La Reserva Federal (FED, 2026) mantiene su tasa de referencia en 3.50–3.75%, lo que sirve como benchmark de mínimo rendimiento libre de riesgo.</p>
    `
  },
  'TIR Anual': {
    icon: '📊',
    title: 'TIR Anual (Tasa Interna de Retorno Efectiva)',
    body: `
      <p style="margin-bottom:10px">La <strong>Tasa Interna de Retorno (TIR)</strong> equivale aquí a la tasa de interés efectiva anual del préstamo.</p>
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:10px 14px;font-family:monospace;font-weight:700;text-align:center;color:#064e3b;margin:10px 0">
        TIR_anual = (1 + r_mensual)¹² − 1
      </div>
      <p>Convierte la tasa nominal en su equivalente anual efectiva, considerando la capitalización mensual. Es el <strong>verdadero costo anual del crédito</strong> para el deudor. Si la TIR supera tu tasa mínima atractiva de retorno (TMAR), el préstamo es costoso respecto a tus alternativas de inversión.</p>
      <p style="margin-top:8px;color:#64748b;font-size:0.85em">Ejemplo: una tasa nominal del 14% anual genera una TIR de 14.93% anual efectivo por efecto del interés compuesto mensual.</p>
    `
  },
  'Plazo': {
    icon: '📅',
    title: 'Plazo (Período n)',
    body: `
      <p style="margin-bottom:10px">El <strong>plazo n</strong> define el horizonte temporal del modelo de amortización y es una de las tres variables principales de la ecuación.</p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 14px;font-family:monospace;font-weight:700;text-align:center;color:#1e40af;margin:10px 0">
        n = Número de períodos de pago (meses)
      </div>
      <p>En el análisis del <strong>Valor del Tiempo del Dinero</strong>, extender el plazo: (1) reduce la cuota mensual A, (2) incrementa el total de intereses pagados y (3) alarga la curva del saldo deudor. Existe un trade-off entre <em>liquidez mensual</em> (cuota baja) y <em>costo financiero total</em>. La decisión óptima se evalúa equiparando el Valor Presente Neto (VPN) de los flujos con la TMAR del agente.</p>
    `
  },
};

// ── Opciones base de todos los charts ────────────────────────────────
const baseChartOpts = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: { font: { family: 'Inter', size: 11 }, padding: 12, boxWidth: 10, boxHeight: 10 }
    },
    tooltip: {
      backgroundColor: '#1e293b',
      titleFont: { family: 'Inter', size: 12, weight: '600' },
      bodyFont:  { family: 'Inter', size: 11 },
      padding: 10, cornerRadius: 8
    }
  }
});

// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═══════════════════════════════════════════════════════════════════

// ── KPI Card clicable ─────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, grad = 'from-indigo-500 to-indigo-600', kpiKey }) {
  const handleClick = () => {
    const info = KPI_INFO[kpiKey || label];
    if (!info) return;
    Swal.fire({
      title: `${info.icon || '💡'} ${info.title}`,
      html: info.body,
      confirmButtonColor: '#4f46e5',
      confirmButtonText: 'Entendido',
      width: 520,
      customClass: { popup: 'text-left rounded-2xl', title: 'text-lg font-bold text-slate-800', htmlContainer: 'text-sm text-slate-600 leading-relaxed text-left' }
    });
  };
  return (
    <motion.div
      key={value}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={handleClick}
      className="kpi-card bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-start gap-3 min-w-0 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95 select-none"
      title="Click para más información"
    >
      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${grad} flex-shrink-0`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 truncate">{label}</p>
        <p className="text-lg font-extrabold text-slate-800 truncate leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{sub}</p>}
        <p className="text-[9px] text-indigo-400 mt-1 font-semibold">Toca para más info ›</p>
      </div>
    </motion.div>
  );
}

// ── Slider + número ──────────────────────────────────────────────────
function SliderInput({ label, value, min, max, step, unit = '', prefix = '', onChange }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-2 gap-2">
        <label className="text-sm font-semibold text-slate-600 flex-1 min-w-0 truncate">{label}</label>
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 gap-1 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all flex-shrink-0">
          {prefix && <span className="text-slate-400 text-xs">{prefix}</span>}
          <input
            type="number" value={value}
            onChange={e => onChange(Number(e.target.value))}
            className="w-20 text-right bg-transparent outline-none font-bold text-indigo-700 text-sm"
            inputMode="decimal"
          />
          {unit && <span className="text-slate-400 text-xs">{unit}</span>}
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
        style={{ background: `linear-gradient(to right,#4f46e5 ${pct}%,#e2e8f0 ${pct}%)` }}
      />
      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
        <span>{prefix}{min}{unit}</span><span>{prefix}{max}{unit}</span>
      </div>
    </div>
  );
}

// ── Collapse block ────────────────────────────────────────────────────
function CollapseBlock({ icon: Icon, label, accentClass, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`mb-4 border rounded-xl overflow-hidden ${accentClass}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 font-semibold text-sm hover:opacity-80 transition"
      >
        <span className="flex items-center gap-2"><Icon size={13} />{label}</span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: .2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Créditos + Contacto ───────────────────────────────────────────────
const TEAM = [
  'Mario José Sánchez Rodríguez',
  'Verónica Gabriela Palacios Godoy',
  'Nicole Cristina Gruber Pérez',
  'Luigi José Ravelli De Sousa',
  'Giovanny Andrés Parra Quintero',
  'Pablo Manuel Bustamante Segovia',
];

function Credits() {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-4 border-t border-slate-100 space-y-3">
      {/* Créditos */}
      <div
        className={`rounded-xl border cursor-pointer select-none transition-colors ${
          open ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
        }`}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center justify-between px-3.5 py-3">
          <div>
            <p className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${open ? 'text-indigo-300' : 'text-slate-400'}`}>Créditos del Proyecto</p>
            <p className={`font-bold text-sm ${open ? 'text-white' : 'text-slate-700'}`}>Estudiantes UCAB</p>
          </div>
          {open ? <ChevronUp size={14} className="text-indigo-200" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <ul className="px-3.5 pb-3 space-y-1.5">
                {TEAM.map((name, i) => (
                  <li key={i} className="flex items-start gap-2 text-indigo-100 text-xs">
                    <span className="text-indigo-300 font-bold flex-shrink-0 w-4 text-right">{i + 1}.</span>
                    <span className="leading-snug">{name}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Contacto */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Información de Contacto</p>
        <div className="space-y-1.5 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="text-indigo-400 font-bold flex-shrink-0">✉</span>
            <a href="mailto:mjsanchez.24@est.ucab.edu.ve" className="text-indigo-600 hover:underline truncate">
              mjsanchez.24@est.ucab.edu.ve
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-indigo-400 font-bold flex-shrink-0">📞</span>
            <a href="tel:+584129229895" className="text-slate-700 hover:text-indigo-600 transition">
              +58 412-9229895
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // En mobile, empezar cerrado
  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, []);

  const [currency, setCurrency] = useState('$');
  const [monto,   setMonto]    = useState(15000);
  const [tasa,    setTasa]     = useState(14);
  const [plazo,   setPlazo]    = useState(24);
  const [results, setResults]  = useState(null);
  const [activeTab, setActiveTab] = useState('graficas');
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [exporting, setExporting]   = useState(false);

  const printRef = useRef(null);
  const isMobile = () => window.innerWidth < 1024;

  // Cierra sidebar en mobile al cambiar de tab
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (isMobile()) setSidebarOpen(false);
  };

  // ── Auto-recalculo en tiempo real ────────────────────────────
  const recalc = useCallback(() => {
    if (monto > 0 && tasa > 0 && plazo > 0 && Number.isInteger(Number(plazo))) {
      setResults(calculateAmortization(Number(monto), Number(tasa), Number(plazo)));
    }
  }, [monto, tasa, plazo]);

  useEffect(() => { recalc(); }, [recalc]);

  // ── Validar y calcular ───────────────────────────────────────
  const handleCalc = () => {
    if (!monto || monto <= 0)
      return Swal.fire({ icon: 'warning', title: 'Monto inválido', text: 'Debe ser mayor a 0.', confirmButtonColor: '#4f46e5' });
    if (!tasa || tasa <= 0)
      return Swal.fire({ icon: 'warning', title: 'Tasa inválida', text: 'Debe ser mayor a 0%.', confirmButtonColor: '#4f46e5' });
    if (!plazo || plazo <= 0 || !Number.isInteger(Number(plazo)))
      return Swal.fire({ icon: 'warning', title: 'Plazo inválido', text: 'Debe ser un entero mayor a 0.', confirmButtonColor: '#4f46e5' });
    recalc();
    if (isMobile()) setSidebarOpen(false);
    Swal.fire({ icon: 'success', title: '¡Listo!', text: 'Dashboard actualizado.', timer: 1400, showConfirmButton: false });
  };

  // ── Export PDF ───────────────────────────────────────────────
  const handlePDF = async () => {
    if (!results) return Swal.fire({ icon: 'warning', title: 'Sin datos', text: 'Calcula primero.' });
    setExporting(true);
    await new Promise(r => setTimeout(r, 300));

    if (!Capacitor.isNativePlatform()) {
      window.print();
      setExporting(false);
      return;
    }

    try {
      Swal.fire({ title: 'Generando PDF…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#fff' });
      setExporting(false);
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const ih = (canvas.height * pw) / canvas.width;
      let y = 0;
      while (y < ih) { if (y > 0) pdf.addPage(); pdf.addImage(imgData, 'JPEG', 0, -y, pw, ih); y += ph; }
      const b64 = pdf.output('datauristring').split(',')[1];
      Swal.close();

      const r = await Swal.fire({
        icon: 'question', title: 'Exportar reporte',
        showCancelButton: true, showDenyButton: true,
        confirmButtonColor: '#4f46e5', denyButtonColor: '#10b981', cancelButtonColor: '#ef4444',
        confirmButtonText: '💾 Guardar', denyButtonText: '📤 Compartir', cancelButtonText: 'Cancelar'
      });
      if (r.isConfirmed) {
        await Filesystem.writeFile({ path: 'Reporte_Prestamo.pdf', data: b64, directory: Directory.Documents });
        Swal.fire({ icon: 'success', title: 'PDF guardado', text: 'En tus Documentos.', confirmButtonColor: '#4f46e5' });
      } else if (r.isDenied) {
        const f = await Filesystem.writeFile({ path: 'Reporte_Prestamo.pdf', data: b64, directory: Directory.Cache });
        await Share.share({ title: 'Reporte de Préstamo', url: f.uri });
      }
    } catch (e) {
      setExporting(false);
      Swal.fire({ icon: 'error', title: 'Error', text: e.message });
    }
  };

  // ── Datos de gráficas ────────────────────────────────────────
  const MAX_CHART_POINTS = 36;
  const cl  = results?.charts.labels.slice(0, MAX_CHART_POINTS)    || [];
  const cfd = results?.charts.cashFlowData.slice(0, MAX_CHART_POINTS) || [];
  const bd  = results?.charts.balanceData.slice(0, MAX_CHART_POINTS + 1) || [];
  const id  = results?.charts.interestData.slice(0, MAX_CHART_POINTS)  || [];
  const cd  = results?.charts.capitalData.slice(0, MAX_CHART_POINTS)   || [];

  const pieData = results && {
    labels: ['Capital Prestado', 'Total Intereses'],
    datasets: [{
      data: [monto, results.totalIntereses],
      backgroundColor: ['#4f46e5', '#ef4444'],
      borderColor: ['#fff', '#fff'], borderWidth: 3, hoverOffset: 10
    }]
  };

  const stackedData = {
    labels: cl,
    datasets: [
      { label: 'Intereses',    data: id, backgroundColor: '#ef444499', stack: 'a', borderRadius: 3 },
      { label: 'Amort. Capital', data: cd, backgroundColor: '#4f46e5aa', stack: 'a', borderRadius: 3 }
    ]
  };

  const balanceData = {
    labels: ['M0', ...cl],
    datasets: [{
      label: 'Saldo Deudor',
      data: bd,
      borderColor: '#0ea5e9',
      backgroundColor: '#0ea5e918',
      borderWidth: 2.5,
      fill: true, tension: 0.4,
      pointRadius: (ctx) => ctx.dataIndex === (hoveredIdx !== null ? hoveredIdx + 1 : -1) ? 6 : 0,
      pointBackgroundColor: '#0ea5e9'
    }]
  };

  const moneyTick = (cur) => (v) => fmt(v, cur);

  const hoverPlugin = useRef({
    id: 'syncHover',
    beforeEvent(chart, args) {
      const e = args.event;
      if (e.type === 'mousemove') {
        const el = chart.getElementsAtEventForMode(e.native, 'index', { intersect: false }, true);
        setHoveredIdx(el.length ? el[0].index : null);
      }
      if (e.type === 'mouseout') setHoveredIdx(null);
    }
  }).current;

  // ── Análisis crítico ─────────────────────────────────────────
  const Analysis = () => {
    if (!results) return null;
    const diff = tasa - FED_MID;
    const spread = diff >= 0 ? `${fmtN(diff)}% por encima` : `${fmtN(Math.abs(diff))}% por debajo`;
    return (
      <div className="analysis-block bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5 space-y-5 text-slate-700 text-sm leading-relaxed">
        {[
          {
            color: 'text-indigo-700', icon: <CheckCircle size={17} className="text-indigo-500 mt-0.5 flex-shrink-0" />,
            title: '1. Anualidad Ordinaria Vencida',
            body: (
              <>
                <p>Modelo matemático de Ingeniería Económica:</p>
                <div className="my-2 bg-white border border-indigo-200 rounded-xl px-4 py-2.5 text-center font-mono font-bold text-indigo-800 text-sm">
                  A = P · [ r·(1+r)ⁿ ] / [ (1+r)ⁿ − 1 ]
                </div>
                <p>Con <strong>P = {fmt(monto, currency)}</strong>, <strong>r = {fmtN(results.monthlyRate * 100, 4)}%/mes</strong>, <strong>n = {plazo} meses</strong> → Cuota constante: <strong className="text-indigo-700">{fmt(results.monthlyPayment, currency)}/mes</strong></p>
              </>
            )
          },
          {
            color: 'text-emerald-700', icon: <CheckCircle size={17} className="text-emerald-500 mt-0.5 flex-shrink-0" />,
            title: '2. Valor del Dinero en el Tiempo (TVM)',
            body: <p>TIR implícita: <strong className="text-emerald-700">{fmtN(results.tir_anual, 4)}% anual efectivo</strong>. Calculada como <strong>r_ef = (1 + r_mensual)¹² − 1</strong>. Representa el verdadero costo anual del crédito, independiente de la tasa nominal contratada.</p>
          },
          {
            color: 'text-rose-700', icon: <AlertCircle size={17} className="text-rose-400 mt-0.5 flex-shrink-0" />,
            title: '3. Costo de Oportunidad vs. Tasa FED (Dato Real 2026)',
            body: (
              <>
                <p>La <strong>Fed (FOMC, marzo 2026)</strong> mantiene su rango objetivo en <strong>{FED_MIN}% – {FED_MAX}%</strong> (tasa de referencia: {FED_MID}%). Tu tasa nominal ({tasa}%) está <strong className="text-rose-600">{spread}</strong> de esa tasa libre de riesgo.</p>
                <p className="mt-2">Costo financiero total: <strong className="text-rose-600">{fmt(results.totalIntereses, currency)}</strong> equivalente a <strong className="text-rose-600">{fmtN(results.effectiveCost)}%</strong> sobre el capital. Por cada {currency}100 prestados, pagas {currency}{fmtN(results.effectiveCost)} adicionales en intereses.</p>
              </>
            )
          },
          {
            color: 'text-violet-700', icon: <CheckCircle size={17} className="text-violet-500 mt-0.5 flex-shrink-0" />,
            title: '4. Perfil de Amortización Decreciente',
            body: <p>En los primeros meses la mayor parte de la cuota cubre intereses (<em>amortización decreciente</em>), acelerándose la reducción real de capital hacia el final del plazo. El Cuadro de Saldo confirma la curva convexa descendente característica de este modelo. <strong>Reflexión:</strong> reducir el plazo disminuye los intereses totales pero eleva la cuota; la decisión óptima equipara el VPN de los flujos a la tasa de oportunidad propia del agente.</p>
          }
        ].map(({ color, icon, title, body }) => (
          <div key={title} className="flex gap-3">
            {icon}
            <div>
              <h4 className={`font-bold ${color} mb-1`}>{title}</h4>
              {body}
            </div>
          </div>
        ))}

        {/* Resumen financiero compacto */}
        <div className="border-t border-indigo-100 pt-4">
          <h4 className="font-bold text-slate-700 mb-3 text-xs uppercase tracking-wider">Resumen del Análisis</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              ['Capital', fmt(monto, currency)],
              ['Cuota (A)', fmt(results.monthlyPayment, currency)],
              ['Total Intereses', fmt(results.totalIntereses, currency)],
              ['Total a Pagar', fmt(results.totalPaid, currency)],
              ['TIR Anual', `${fmtN(results.tir_anual, 3)}%`],
              ['Sobrecosto', `${fmtN(results.effectiveCost)}%`],
              ['Tasa Nominal', `${tasa}%`],
              ['r mensual', `${fmtN(results.monthlyRate * 100, 4)}%`],
              ['Plazo', `${plazo} meses`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between bg-white border border-slate-100 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-500">{k}</span>
                <span className="font-bold text-slate-800">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════
  // RENDER
  // ══════════════════════════════
  const TABS = [
    { id: 'graficas', label: 'Gráficas',      icon: BarChart2 },
    { id: 'tabla',    label: 'Tabla',          icon: Activity  },
    { id: 'analisis', label: 'Análisis',       icon: BookOpen  },
  ];

  const isOpen = sidebarOpen;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100">

      {/* ── TOPBAR ──────────────────────────────────────────────── */}
      <header className="no-print flex-shrink-0 bg-white border-b border-slate-200 shadow-sm z-30">
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5">

          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition flex-shrink-0"
            aria-label="Abrir/cerrar panel"
          >
            {isOpen ? <PanelLeftClose size={20}/> : <PanelLeft size={20}/>}
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="bg-indigo-600 p-1.5 rounded-lg flex-shrink-0">
              <Landmark size={16} className="text-white"/>
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-slate-800 text-sm sm:text-base leading-tight truncate">
                Calculadora de Préstamos
              </h1>
              <p className="text-[10px] text-slate-400 hidden sm:block">Ingeniería Económica · Dashboard</p>
            </div>
          </div>

          {/* Divisa */}
          <div className="flex gap-0.5 sm:gap-1 bg-slate-100 p-1 rounded-xl flex-shrink-0">
            {['$', '€', '£', 'Bs.'].map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-bold transition-all ${currency === c ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-200'}`}
              >
                {c}
              </button>
            ))}
          </div>

          {results && (
            <button
              onClick={handlePDF}
              disabled={exporting}
              className="no-print flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm shadow-lg shadow-indigo-200 transition active:scale-95 disabled:opacity-60 flex-shrink-0"
            >
              <FileDown size={14}/>
              <span className="hidden sm:inline">{exporting ? 'Generando…' : 'Exportar PDF'}</span>
              <span className="sm:hidden">PDF</span>
            </button>
          )}
        </div>
      </header>

      {/* ── BODY (sidebar + main) ────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Overlay mobile */}
        <AnimatePresence>
          {isOpen && isMobile() && (
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="sidebar-overlay no-print"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* ── SIDEBAR ──────────────────────────────────────────── */}
        <div className={`sidebar-drawer no-print ${isOpen ? 'open' : 'closed'}`}>
          <div className="flex-1 overflow-y-auto p-4">

            <CollapseBlock icon={BookOpen} label="¿Para qué sirve?" accentClass="border-indigo-100 bg-indigo-50 text-indigo-700">
              <p className="text-xs text-slate-600 leading-relaxed">
                Aplica el modelo de <strong>Anualidad Ordinaria Vencida</strong> de la Ingeniería Económica para calcular
                la cuota mensual constante de un préstamo, separando cuánto corresponde a
                <em> amortización de capital</em> y cuánto a <em>intereses</em>. Incluye flujo de efectivo,
                cuadro de saldo y análisis crítico con datos reales de la FED 2026.
              </p>
            </CollapseBlock>

            <CollapseBlock icon={Info} label="Instrucciones" accentClass="border-sky-100 bg-sky-50 text-sky-700">
              <ul className="text-xs text-slate-600 space-y-1.5">
                {[
                  'Desliza la barra o escribe el valor en el campo numérico.',
                  'Los resultados se actualizan en tiempo real automáticamente.',
                  'Cambia la divisa con los botones del encabezado.',
                  'Navega entre Gráficas, Tabla y Análisis con las pestañas.',
                  'Exporta el reporte completo con el botón "Exportar PDF".',
                  'Pasa el cursor sobre las gráficas — se sincronizan entre sí.',
                ].map((t, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-indigo-400 font-bold flex-shrink-0">{i + 1}.</span>{t}
                  </li>
                ))}
              </ul>
            </CollapseBlock>

            <div className="h-px bg-slate-100 my-4"/>
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-3 flex items-center gap-1.5">
              <Calculator size={12}/> Parámetros del Crédito
            </p>

            <SliderInput label="Monto del Préstamo" value={monto} min={100} max={500000} step={100} prefix={currency} onChange={v => setMonto(v)}/>
            <SliderInput label="Tasa de Interés Anual" value={tasa} min={0.1} max={100} step={0.1} unit="%" onChange={v => setTasa(v)}/>
            <SliderInput label="Plazo de Pago" value={plazo} min={1} max={360} step={1} unit=" meses" onChange={v => setPlazo(Math.round(v))}/>

            <button
              onClick={handleCalc}
              className="w-full py-3 mt-2 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-200 flex justify-center items-center gap-2 transition active:scale-95"
            >
              <Calculator size={16}/> Calcular Análisis
            </button>
          </div>
          <Credits/>
        </div>

        {/* ── MAIN CONTENT ─────────────────────────────────────── */}
        <main
          ref={printRef}
          className="print-content flex-1 overflow-y-auto"
        >
          {/* PDF report header (visible ONLY on print) */}
          <div className="pdf-report-header hidden" style={{ display: 'none' }}>
            <div className="text-center py-6 border-b-2 border-indigo-600 mb-6 px-6">
              <h1 className="text-2xl font-extrabold text-indigo-700">Reporte de Análisis Financiero</h1>
              <p className="text-slate-500 text-sm mt-1">Calculadora de Préstamos · Ingeniería Económica · UCAB</p>
              <p className="text-slate-400 text-xs mt-1">
                Generado: {new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          {!results ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="bg-indigo-100 p-8 rounded-full mb-4">
                <Landmark size={48} className="text-indigo-400"/>
              </div>
              <h2 className="text-xl font-bold text-slate-500">Ajusta los parámetros</h2>
              <p className="text-slate-400 text-sm mt-2 max-w-xs">Usa los controles del panel lateral para calcular tu análisis financiero.</p>
              <button
                onClick={() => setSidebarOpen(true)}
                className="mt-6 flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow lg:hidden"
              >
                <Menu size={16}/> Abrir Panel
              </button>
            </div>
          ) : (
            <div className="p-3 sm:p-5 space-y-4 max-w-7xl mx-auto">

              {/* ── KPI CARDS ── */}
              <div className="kpi-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard label="Cuota Mensual"   value={fmt(results.monthlyPayment, currency)} icon={DollarSign}  grad="from-indigo-500 to-indigo-600" kpiKey="Cuota Mensual"/>
                <KpiCard label="Total Intereses" value={fmt(results.totalIntereses, currency)}  icon={Percent}     grad="from-rose-500 to-rose-600"    kpiKey="Total Intereses"/>
                <KpiCard label="Total a Pagar"   value={fmt(results.totalPaid, currency)}       icon={TrendingDown} grad="from-amber-500 to-amber-600"   kpiKey="Total a Pagar"/>
                <KpiCard label="Sobrecosto"      value={`${fmtN(results.effectiveCost)}%`} sub="sobre capital" icon={AlertCircle} grad="from-violet-500 to-violet-600" kpiKey="Sobrecosto"/>
                <KpiCard label="TIR Anual"       value={`${fmtN(results.tir_anual, 3)}%`} sub="Tasa efectiva" icon={Activity}    grad="from-emerald-500 to-emerald-600" kpiKey="TIR Anual"/>
                <KpiCard label="Plazo"           value={`${plazo} meses`} sub={`${fmtN(plazo / 12, 1)} años`} icon={Clock} grad="from-sky-500 to-sky-600" kpiKey="Plazo"/>
              </div>

              {/* ── TABS (no se imprimen) ── */}
              <div className="no-print bg-white rounded-xl border border-slate-200 p-1 flex gap-1">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <tab.icon size={13}/>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── TAB GRÁFICAS ── */}
              <div className={`tab-panel space-y-4 ${activeTab !== 'graficas' ? 'hidden print:block' : ''}`}>
                <div className="charts-grid grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Pastel */}
                  <div className="chart-box bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <PieChart size={14} className="text-indigo-500"/>
                      <h3 className="font-bold text-sm text-slate-700">Capital vs Intereses</h3>
                    </div>
                    <div className="h-52">
                      <Pie
                        data={pieData}
                        options={{
                          ...baseChartOpts(),
                          plugins: {
                            ...baseChartOpts().plugins,
                            tooltip: {
                              ...baseChartOpts().plugins.tooltip,
                              callbacks: { label: ctx => `${ctx.label}: ${fmt(ctx.raw, currency)} (${fmtN((ctx.raw / results.totalPaid) * 100, 1)}%)` }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Flujo (barras apiladas) */}
                  <div className="chart-box bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart2 size={14} className="text-indigo-500"/>
                      <h3 className="font-bold text-sm text-slate-700">Diagrama de Flujo de Efectivo</h3>
                    </div>
                    <p className="text-[10px] text-slate-400 mb-2">Capital (azul) + Interés (rojo) · {plazo > MAX_CHART_POINTS ? `Primeros ${MAX_CHART_POINTS}` : plazo} meses</p>
                    <div className="h-48">
                      <Bar
                        data={stackedData}
                        plugins={[hoverPlugin]}
                        options={{
                          ...baseChartOpts(),
                          plugins: { ...baseChartOpts().plugins, tooltip: { ...baseChartOpts().plugins.tooltip, mode: 'index', callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw, currency)}` } } },
                          scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: moneyTick(currency), font: { size: 10 } } } },
                          onHover: (_, el) => setHoveredIdx(el.length ? el[0].index : null)
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Saldo Deudor (full width) */}
                <div className="chart-box bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity size={14} className="text-sky-500"/>
                    <h3 className="font-bold text-sm text-slate-700">Cuadro de Saldo de Efectivo (Balance Deudor)</h3>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-3">Evolución del saldo pendiente. El punto resaltado se sincroniza con las otras gráficas.</p>
                  <div className="h-52">
                    <Line
                      data={balanceData}
                      plugins={[hoverPlugin]}
                      options={{
                        ...baseChartOpts(),
                        plugins: { ...baseChartOpts().plugins, legend: { display: false }, tooltip: { ...baseChartOpts().plugins.tooltip, mode: 'index', callbacks: { label: ctx => `Saldo: ${fmt(ctx.raw, currency)}` } } },
                        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: moneyTick(currency), font: { size: 10 } } } }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* ── TAB TABLA ── */}
              <div className={`tab-panel ${activeTab !== 'tabla' ? 'hidden print:block' : ''}`}>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Activity size={14} className="text-indigo-500"/>
                      <h3 className="font-bold text-sm text-slate-700">Tabla de Amortización Mensual</h3>
                    </div>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{plazo} pagos</span>
                  </div>
                  <div className="amort-table-wrapper overflow-x-auto" style={{ maxHeight: '60vh' }}>
                    <table className="w-full text-sm amort-table">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          {['Mes', 'Cuota', 'Capital', 'Intereses', 'Saldo'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-right first:text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                              {h} <span className="font-normal text-slate-400">({currency})</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {results.schedule.map((row, i) => (
                          <tr
                            key={row.mes}
                            className={`transition-colors ${i === hoveredIdx ? 'bg-indigo-50' : 'hover:bg-slate-50/60'}`}
                            onMouseEnter={() => setHoveredIdx(i)}
                            onMouseLeave={() => setHoveredIdx(null)}
                          >
                            <td className="px-3 py-2 text-center font-bold text-slate-400 text-xs">{row.mes}</td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-700">{fmt(row.cuota, currency)}</td>
                            <td className="px-3 py-2 text-right text-indigo-600 font-medium">{fmt(row.capital, currency)}</td>
                            <td className="px-3 py-2 text-right text-rose-500 font-medium">{fmt(row.interes, currency)}</td>
                            <td className="px-3 py-2 text-right font-bold text-slate-700 bg-slate-50/50">{fmt(row.saldo, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                        <tr>
                          <td className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-400">TOTAL</td>
                          <td className="px-3 py-2.5 text-right font-extrabold text-slate-800">{fmt(results.totalPaid, currency)}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-indigo-700">{fmt(monto, currency)}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-rose-600">{fmt(results.totalIntereses, currency)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-400 font-bold">—</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* ── TAB ANÁLISIS ── */}
              <div className={`tab-panel ${activeTab !== 'analisis' ? 'hidden print:block' : ''}`}>
                <Analysis/>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}
