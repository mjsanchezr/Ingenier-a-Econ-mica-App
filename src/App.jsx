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
  Landmark, Calculator, FileDown, Info, BookOpen,
  TrendingDown, DollarSign, Percent, Clock, ChevronDown,
  ChevronUp, ArrowRight, BarChart2, PieChart, Activity,
  AlertCircle, CheckCircle
} from 'lucide-react';
import { calculateAmortization } from './utils/finance';

ChartJS.register(
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale,
  PointElement, LineElement,
  BarElement, Filler
);

// ─── Datos reales FED 2026 ───────────────────────────────────────────
const FED_RATE_MIN = 3.50;
const FED_RATE_MAX = 3.75;
const FED_RATE_MID = (FED_RATE_MIN + FED_RATE_MAX) / 2;

// ─── Paleta PowerBI ──────────────────────────────────────────────────
const COLORS = {
  primary:   '#4f46e5',
  secondary: '#0ea5e9',
  success:   '#10b981',
  danger:    '#ef4444',
  warning:   '#f59e0b',
  purple:    '#8b5cf6',
  pink:      '#ec4899',
  orange:    '#f97316',
};

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: { font: { family: 'Inter', size: 11 }, padding: 16, boxWidth: 12, boxHeight: 12 }
    },
    tooltip: {
      backgroundColor: '#1e293b',
      titleFont: { family: 'Inter', size: 12, weight: '600' },
      bodyFont: { family: 'Inter', size: 11 },
      padding: 10,
      cornerRadius: 8,
    }
  }
};

// ─── Utilidades ──────────────────────────────────────────────────────
const fmt = (val, cur = '$') =>
  `${cur}${Number(val).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtNum = (val, dec = 2) => Number(val).toFixed(dec);

// ─── COMPONENTES AUXILIARES ──────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color = 'indigo', animate = true }) {
  const colors = {
    indigo: 'from-indigo-500 to-indigo-600',
    sky:    'from-sky-500 to-sky-600',
    emerald:'from-emerald-500 to-emerald-600',
    rose:   'from-rose-500 to-rose-600',
    amber:  'from-amber-500 to-amber-600',
    violet: 'from-violet-500 to-violet-600',
  };
  return (
    <motion.div
      key={value}
      initial={animate ? { opacity: 0, y: 16 } : false}
      animate={{ opacity: 1, y: 0 }}
      className="kpi-card bg-white rounded-2xl p-5 border border-slate-100 shadow-md flex items-start gap-4"
    >
      <div className={`p-3 rounded-xl bg-gradient-to-br ${colors[color]} flex-shrink-0`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1 truncate">{label}</p>
        <p className="text-xl font-extrabold text-slate-800 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

function SliderInput({ label, value, min, max, step, unit = '', prefix = '', onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-semibold text-slate-600">{label}</label>
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 gap-1 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
          {prefix && <span className="text-slate-400 text-sm">{prefix}</span>}
          <input
            type="number"
            value={value}
            onChange={e => onChange(Number(e.target.value))}
            className="w-20 text-right bg-transparent outline-none font-bold text-indigo-700"
            inputMode="decimal"
          />
          {unit && <span className="text-slate-400 text-sm">{unit}</span>}
        </div>
      </div>
      <div className="relative">
        <input
          type="range" min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer accent-indigo-600"
          style={{
            background: `linear-gradient(to right, #4f46e5 ${pct}%, #e2e8f0 ${pct}%)`
          }}
        />
        <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-0.5">
          <span>{prefix}{min}{unit}</span>
          <span>{prefix}{max}{unit}</span>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, color = 'text-indigo-600' }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={18} className={color} />
      <h3 className={`font-bold text-sm uppercase tracking-widest ${color}`}>{title}</h3>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────
export default function App() {
  const [currency, setCurrency]   = useState('$');
  const [monto, setMonto]         = useState(15000);
  const [tasa, setTasa]           = useState(14);
  const [plazo, setPlazo]         = useState(24);
  const [results, setResults]     = useState(null);
  const [showIntro, setShowIntro] = useState(false);
  const [showInstr, setShowInstr] = useState(false);
  const [activeTab, setActiveTab] = useState('graficas'); // 'graficas' | 'tabla' | 'analisis'
  const [exporting, setExporting] = useState(false);
  
  // Hover state compartido entre gráficas
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const pdfRef = useRef(null);

  // ── Auto-calcular en tiempo real ─────────────────────────
  const recalculate = useCallback(() => {
    if (monto > 0 && tasa > 0 && plazo > 0) {
      const calc = calculateAmortization(Number(monto), Number(tasa), Number(plazo));
      setResults(calc);
    }
  }, [monto, tasa, plazo]);

  useEffect(() => { recalculate(); }, [recalculate]);

  // ── Validar y calcular manualmente ───────────────────────
  const handleCalculate = () => {
    if (!monto || monto <= 0) {
      Swal.fire({ icon: 'warning', title: 'Monto inválido', text: 'El monto del préstamo debe ser mayor a 0.', confirmButtonColor: COLORS.primary }); return;
    }
    if (!tasa || tasa <= 0) {
      Swal.fire({ icon: 'warning', title: 'Tasa inválida', text: 'La tasa de interés debe ser mayor a 0%.', confirmButtonColor: COLORS.primary }); return;
    }
    if (!plazo || plazo <= 0 || !Number.isInteger(Number(plazo))) {
      Swal.fire({ icon: 'warning', title: 'Plazo inválido', text: 'El número de meses debe ser un entero mayor a 0.', confirmButtonColor: COLORS.primary }); return;
    }
    recalculate();
    Swal.fire({ icon: 'success', title: '¡Análisis completado!', text: 'Los resultados han sido actualizados.', timer: 1500, showConfirmButton: false, confirmButtonColor: COLORS.primary });
  };

  // ── Exportar PDF ─────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!results) {
      Swal.fire({ icon: 'warning', title: 'Sin datos', text: 'Primero calcula el análisis.', confirmButtonColor: COLORS.primary }); return;
    }
    setExporting(true);
    await new Promise(r => setTimeout(r, 400));

    if (!Capacitor.isNativePlatform()) {
      window.print();
      setExporting(false);
      return;
    }

    // Móvil: html2canvas + jsPDF
    try {
      Swal.fire({ title: 'Generando PDF…', text: 'Por favor espera...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      setExporting(false);
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      const pageH = pdf.internal.pageSize.getHeight();
      let y = 0;
      while (y < pdfH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, -y, pdfW, pdfH);
        y += pageH;
      }
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      Swal.close();

      const result = await Swal.fire({
        icon: 'question',
        title: 'Exportar Reporte',
        text: '¿Cómo deseas guardar tu análisis financiero?',
        showCancelButton: true, showDenyButton: true,
        confirmButtonColor: COLORS.primary,
        denyButtonColor: COLORS.success,
        cancelButtonColor: COLORS.danger,
        confirmButtonText: '💾 Guardar en Documentos',
        denyButtonText: '📤 Compartir (WhatsApp / Gmail)',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        await Filesystem.writeFile({ path: 'Reporte_Prestamo.pdf', data: pdfBase64, directory: Directory.Documents });
        Swal.fire({ icon: 'success', title: 'PDF guardado', text: 'En la carpeta Documentos de tu dispositivo.', confirmButtonColor: COLORS.primary });
      } else if (result.isDenied) {
        const f = await Filesystem.writeFile({ path: 'Reporte_Prestamo.pdf', data: pdfBase64, directory: Directory.Cache });
        await Share.share({ title: 'Reporte de Préstamo', url: f.uri });
      }
    } catch (e) {
      setExporting(false);
      Swal.fire({ icon: 'error', title: 'Error', text: e.message });
    }
  };

  // ── Datos de las gráficas ────────────────────────────────
  const pieData = results && {
    labels: ['Capital Prestado', 'Total Intereses'],
    datasets: [{
      data: [monto, results.totalIntereses],
      backgroundColor: [COLORS.primary, COLORS.danger],
      borderColor: ['#ffffff', '#ffffff'],
      borderWidth: 3,
      hoverOffset: 12
    }]
  };

  // Limitamos a los primeros 36 puntos para no colapsar el chart
  const chartLabels  = results?.charts.labels.slice(0, 36)   || [];
  const cashFlowDs   = results?.charts.cashFlowData.slice(0, 36) || [];
  const balanceDs    = results?.charts.balanceData.slice(0, 37)  || [];
  const interestDs   = results?.charts.interestData.slice(0, 36) || [];
  const capitalDs    = results?.charts.capitalData.slice(0, 36)  || [];

  const cashFlowData = {
    labels: chartLabels,
    datasets: [{
      label: 'Pago mensual',
      data: cashFlowDs,
      backgroundColor: cashFlowDs.map((v, i) => i === hoveredIndex ? COLORS.warning : `${COLORS.primary}bb`),
      borderRadius: 4,
    }]
  };

  const balanceData = {
    labels: ['M0', ...chartLabels],
    datasets: [{
      label: 'Saldo Deudor',
      data: balanceDs,
      borderColor: COLORS.secondary,
      backgroundColor: `${COLORS.secondary}18`,
      borderWidth: 2.5,
      fill: true,
      tension: 0.4,
      pointRadius: (ctx) => ctx.dataIndex === (hoveredIndex !== null ? hoveredIndex + 1 : -1) ? 6 : 0,
      pointBackgroundColor: COLORS.secondary,
    }]
  };

  const stackedData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Intereses',
        data: interestDs,
        backgroundColor: `${COLORS.danger}cc`,
        borderRadius: 3,
        stack: 'a'
      },
      {
        label: 'Amortización Capital',
        data: capitalDs,
        backgroundColor: `${COLORS.primary}cc`,
        borderRadius: 3,
        stack: 'a'
      }
    ]
  };

  // ── Análisis crítico dinámico ─────────────────────────────
  const buildAnalysis = () => {
    if (!results) return null;
    const diff = tasa - FED_RATE_MID;
    const spread = diff > 0 ? `${fmtNum(diff, 2)}% por encima` : `${fmtNum(Math.abs(diff), 2)}% por debajo`;
    const overPct = fmtNum(results.effectiveCost, 2);
    const tirA = fmtNum(results.tir_anual, 4);

    return (
      <div className="analysis-block bg-indigo-50/60 border border-indigo-100 rounded-2xl p-6 space-y-4 text-slate-700 leading-relaxed">
        
        <div className="pdf-header hidden print:block text-center pb-4 border-b-2 border-indigo-500 mb-6">
          <h1 className="text-2xl font-extrabold text-indigo-700">Reporte de Análisis Financiero</h1>
          <p className="text-slate-500 text-sm mt-1">Calculadora de Préstamos — Ingeniería Económica — UCAB</p>
          <p className="text-slate-400 text-xs mt-1">Generado: {new Date().toLocaleDateString('es-VE', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
        </div>

        <div className="flex items-start gap-3">
          <CheckCircle size={20} className="text-indigo-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-indigo-800 mb-1">1. Aplicación de la Anualidad Ordinaria Vencida</h4>
            <p className="text-sm">
              Se aplica el modelo matemático fundamental de Ingeniería Económica conocido como <strong>Anualidad Ordinaria Vencida</strong>, cuya fórmula es:
            </p>
            <div className="bg-white border border-indigo-200 rounded-xl px-4 py-3 my-3 font-mono text-sm text-center text-indigo-800 font-bold">
              A = P · [ r·(1+r)ⁿ ] / [ (1+r)ⁿ − 1 ]
            </div>
            <p className="text-sm">
              Donde <strong>P = {fmt(monto, currency)}</strong> (capital prestado), <strong>r = {fmtNum(results.monthlyRate * 100, 4)}%</strong> (tasa efectiva mensual), y <strong>n = {plazo} meses</strong>.
              El resultado arroja una cuota constante nivelada de <strong className="text-indigo-700">{fmt(results.monthlyPayment, currency)}/mes</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <CheckCircle size={20} className="text-emerald-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-emerald-800 mb-1">2. Valor del Dinero en el Tiempo (TVM)</h4>
            <p className="text-sm">
              El principio cardinal de la Ingeniería Económica establece que <em>un peso hoy vale más que un peso mañana</em>.
              La TIR implícita del financiamiento es de <strong className="text-emerald-700">{tirA}% anual efectivo</strong>, calculada como:
              <strong> r_efectiva = (1 + r_mensual)¹² − 1</strong>. Esta tasa representa el verdadero costo anual del crédito
              para el deudor, independientemente de la tasa nominal contratada.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-rose-500 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-rose-700 mb-1">3. Costo de Oportunidad vs. Tasa FED (Datos Reales 2026)</h4>
            <p className="text-sm">
              Según la <strong>Reserva Federal de los EE.UU. (FED)</strong>, al 2 de abril de 2026 el rango objetivo
              de los Fondos Federales es de <strong>{FED_RATE_MIN}% – {FED_RATE_MAX}%</strong> (tasa referencia = {FED_RATE_MID}%).
              La tasa nominal anual del presente préstamo ({tasa}%) se encuentra <strong className="text-rose-600">{spread}</strong> de la
              tasa libre de riesgo. Esto implica una prima de riesgo justificada por asimetría de información y riesgo de crédito.
            </p>
            <p className="text-sm mt-2">
              El <strong>costo financiero total</strong> asciende a <strong className="text-rose-600">{fmt(results.totalIntereses, currency)}</strong>,
              equivalente a un <strong className="text-rose-600">{overPct}%</strong> sobre el capital. Es decir, por cada
              {currency}100 prestados, el prestatario paga {currency}{fmtNum(results.effectiveCost, 2)} adicionales en concepto de interés.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <CheckCircle size={20} className="text-violet-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-violet-800 mb-1">4. Perfil de Amortización (Concentración Temporal del Gasto Financiero)</h4>
            <p className="text-sm">
              El Diagrama de Flujo de Efectivo muestra que cada cuota de <strong>{fmt(results.monthlyPayment, currency)}</strong> es constante,
              pero su composición interna varía: en los primeros meses la mayor porción corresponde a <strong>intereses</strong>
              (fenómeno conocido como <em>amortización decreciente</em>), mientras que la amortización real de capital se acelera
              progresivamente. El Cuadro de Saldo de Efectivo confirma esta curva convexa descendente, característica del modelo
              de anualidad constante utilizado por la mayoría de las instituciones financieras latinoamericanas.
            </p>
            <p className="text-sm mt-2">
              <strong>Reflexión final:</strong> Un plazo más corto reduce el total de intereses pagados pero eleva la cuota mensual.
              La decisión óptima desde la Ingeniería Económica requiere equiparar el VPN de los flujos descontados a la tasa de
              oportunidad propia del agente, maximizando la liquidez disponible en el período.
            </p>
          </div>
        </div>

        {/* Tabla resumen para PDF */}
        <div className="border-t border-indigo-100 pt-4 mt-4">
          <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wider">Resumen Financiero del Análisis</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Capital Solicitado', fmt(monto, currency)],
              ['Cuota Mensual (A)', fmt(results.monthlyPayment, currency)],
              ['Total Intereses', fmt(results.totalIntereses, currency)],
              ['Total a Pagar', fmt(results.totalPaid, currency)],
              ['TIR Anual Efectiva', `${tirA}%`],
              ['Sobrecosto %', `${overPct}%`],
              ['Tasa Nominal Anual', `${tasa}%`],
              ['Tasa Mensual Efectiva', `${fmtNum(results.monthlyRate * 100, 4)}%`],
              ['Plazo', `${plazo} meses`],
              ['Divisa', currency],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between bg-white border border-slate-100 rounded-lg px-3 py-2">
                <span className="text-slate-500">{k}</span>
                <span className="font-bold text-slate-800">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Tabs de contenido ─────────────────────────────────────
  const TABS = [
    { id: 'graficas',  label: 'Gráficas',  icon: BarChart2 },
    { id: 'tabla',     label: 'Tabla Mes a Mes',     icon: Activity },
    { id: 'analisis',  label: 'Análisis Crítico', icon: BookOpen },
  ];

  // ── Opciones compartidas de charts ───────────────────────
  const moneyTickCallback = v => fmt(v, currency);
  const hoverPlugin = {
    id: 'syncHover',
    beforeEvent(chart, args) {
      const event = args.event;
      if (event.type === 'mousemove') {
        const elements = chart.getElementsAtEventForMode(event.native, 'index', { intersect: false }, true);
        setHoveredIndex(elements.length ? elements[0].index : null);
      }
      if (event.type === 'mouseout') setHoveredIndex(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── BARRA SUPERIOR (Header) ────────────────────── */}
      <header className="no-print bg-white border-b border-slate-200 shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Landmark size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-800 text-base leading-tight">Calculadora de Préstamos</h1>
            <p className="text-xs text-slate-400">Ingeniería Económica · Dashboard Analítico</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Selector Divisa */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {['$', '€', '£', 'Bs.'].map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-3 py-1 rounded-lg text-sm font-bold transition-all ${currency === c ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-200'}`}
              >
                {c}
              </button>
            ))}
          </div>

          {results && (
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-200 transition active:scale-95 disabled:opacity-60"
            >
              <FileDown size={16} />
              {exporting ? 'Generando…' : 'Exportar PDF'}
            </button>
          )}
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)] overflow-hidden">
        
        {/* ── SIDEBAR IZQUIERDO (Controles) ──────────────── */}
        <aside className="no-print sidebar-panel w-72 flex-shrink-0 bg-white border-r border-slate-200 overflow-y-auto flex flex-col">
          <div className="p-5 flex-1">
            
            {/* Introducción colapsable */}
            <div className="mb-5 border border-indigo-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowIntro(!showIntro)}
                className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 text-indigo-700 font-semibold text-sm hover:bg-indigo-100 transition"
              >
                <span className="flex items-center gap-2"><BookOpen size={14} /> ¿Para qué sirve?</span>
                {showIntro ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <AnimatePresence>
                {showIntro && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="px-4 py-3 text-xs text-slate-600 leading-relaxed space-y-2">
                      <p>Esta herramienta aplica el modelo de <strong>Anualidad Ordinaria Vencida</strong> de la Ingeniería Económica para calcular la cuota mensual constante de un préstamo, separando cuánto corresponde a <em>amortización de capital</em> y cuánto a <em>intereses</em>.</p>
                      <p>Permite visualizar el <strong>Diagrama de Flujo de Efectivo</strong>, el <strong>Cuadro de Saldo</strong>, y así tomar decisiones financieras informadas sobre el costo real del crédito.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Instrucciones colapsable */}
            <div className="mb-5 border border-sky-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowInstr(!showInstr)}
                className="w-full flex items-center justify-between px-4 py-3 bg-sky-50 text-sky-700 font-semibold text-sm hover:bg-sky-100 transition"
              >
                <span className="flex items-center gap-2"><Info size={14} /> Instrucciones</span>
                {showInstr ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <AnimatePresence>
                {showInstr && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <ul className="px-4 py-3 text-xs text-slate-600 space-y-1.5">
                      {[
                        'Desliza la barra o escribe el valor directamente en el campo numérico.',
                        'Los resultados se actualizan automáticamente en tiempo real.',
                        'Cambia la divisa (€, $, £, Bs.) con los botones superiores.',
                        'Navega entre Gráficas, Tabla y Análisis usando las pestañas.',
                        'Exporta el reporte completo con el botón "Exportar PDF".',
                        'Pasa el cursor sobre las gráficas — se sincronizan entre sí.',
                      ].map((t, i) => (
                        <li key={i} className="flex gap-2"><span className="text-indigo-400 font-bold flex-shrink-0">{i + 1}.</span>{t}</li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-px bg-slate-100 mb-5" />
            <SectionTitle icon={Calculator} title="Parámetros del Crédito" />

            <SliderInput
              label="Monto del Préstamo"
              value={monto} min={100} max={500000} step={100}
              prefix={currency}
              onChange={v => setMonto(v)}
            />
            <SliderInput
              label="Tasa de Interés Anual"
              value={tasa} min={0.1} max={100} step={0.1}
              unit="%"
              onChange={v => setTasa(v)}
            />
            <SliderInput
              label="Plazo de Pago"
              value={plazo} min={1} max={360} step={1}
              unit=" meses"
              onChange={v => setPlazo(Math.round(v))}
            />

            <button
              onClick={handleCalculate}
              className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-200 flex justify-center items-center gap-2 transition active:scale-95 mt-2"
            >
              <Calculator size={18} /> Calcular Análisis
            </button>
          </div>

          {/* Créditos */}
          <CreditsTilt />
        </aside>

        {/* ── PANEL DERECHO (Dashboard) ───────────────────── */}
        <main className="main-content flex-1 overflow-y-auto p-5 space-y-5" ref={pdfRef}>
          
          {/* Header PDF (visible solo en print) */}
          <div className="hidden print:block text-center mb-6 border-b-2 border-indigo-600 pb-4">
            <h1 className="text-2xl font-extrabold text-indigo-700 mb-1">Reporte de Análisis Financiero de Préstamo</h1>
            <p className="text-slate-500 text-sm">Calculadora de Préstamos — Ingeniería Económica · UCAB</p>
            <p className="text-slate-400 text-xs mt-1">Generado: {new Date().toLocaleDateString('es-VE', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
          </div>

          {!results && (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="bg-indigo-100 p-6 rounded-full mb-4"><Landmark size={48} className="text-indigo-400" /></div>
              <h2 className="text-xl font-bold text-slate-500">Ajusta los parámetros</h2>
              <p className="text-slate-400 text-sm mt-2">Usa los controles de la izquierda para calcular tu análisis financiero.</p>
            </div>
          )}

          {results && (
            <>
              {/* ── KPI CARDS ─── */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <KpiCard label="Cuota Mensual" value={fmt(results.monthlyPayment, currency)} icon={DollarSign} color="indigo" />
                <KpiCard label="Total Intereses" value={fmt(results.totalIntereses, currency)} icon={Percent} color="rose" />
                <KpiCard label="Total a Pagar" value={fmt(results.totalPaid, currency)} icon={TrendingDown} color="amber" />
                <KpiCard label="Sobrecosto" value={`${fmtNum(results.effectiveCost, 2)}%`} sub="sobre capital" icon={AlertCircle} color="violet" />
                <KpiCard label="TIR Anual" value={`${fmtNum(results.tir_anual, 3)}%`} sub="Tasa Efectiva Anual" icon={Activity} color="emerald" />
                <KpiCard label="Plazo" value={`${plazo} meses`} sub={`${fmtNum(plazo / 12, 1)} años`} icon={Clock} color="sky" />
              </div>

              {/* ── TABS ─── */}
              <div className="no-print flex gap-1 bg-white rounded-xl p-1 border border-slate-200 w-full">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <tab.icon size={14} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* ── TAB: GRÁFICAS ─── */}
              <div className={activeTab !== 'graficas' ? 'hidden print:block' : 'block'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 print:grid-cols-2">
                  
                  {/* Gráfica pastel */}
                  <div className="chart-box bg-white rounded-2xl border border-slate-100 shadow-md p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <PieChart size={16} className="text-indigo-500" />
                      <h3 className="font-bold text-sm text-slate-700">Proporción Capital vs Intereses</h3>
                    </div>
                    <div className="h-56">
                      <Pie data={pieData} options={{ ...CHART_DEFAULTS, plugins: { ...CHART_DEFAULTS.plugins, tooltip: { ...CHART_DEFAULTS.plugins.tooltip, callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw, currency)} (${fmtNum((ctx.raw / results.totalPaid) * 100, 1)}%)` } } } }} />
                    </div>
                  </div>

                  {/* Bars descompuesto (Capital + Interés apilado) */}
                  <div className="chart-box bg-white rounded-2xl border border-slate-100 shadow-md p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart2 size={16} className="text-indigo-500" />
                      <h3 className="font-bold text-sm text-slate-700">Diagrama de Flujo de Efectivo</h3>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">Composición Capital (azul) + Interés (rojo) por mes · {plazo > 36 ? 'Mostrando primeros 36 meses' : `${plazo} meses`}</p>
                    <div className="h-52">
                      <Bar
                        data={stackedData}
                        options={{
                          ...CHART_DEFAULTS,
                          plugins: {
                            ...CHART_DEFAULTS.plugins,
                            tooltip: {
                              ...CHART_DEFAULTS.plugins.tooltip,
                              mode: 'index',
                              callbacks: {
                                label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw, currency)}`
                              }
                            }
                          },
                          scales: {
                            x: { stacked: true, grid: { display: false } },
                            y: { stacked: true, ticks: { callback: v => fmt(v, currency) } }
                          },
                          onHover: (_, elements) => setHoveredIndex(elements.length > 0 ? elements[0].index : null)
                        }}
                      />
                    </div>
                  </div>

                  {/* Saldo Deudor */}
                  <div className="chart-box bg-white rounded-2xl border border-slate-100 shadow-md p-5 md:col-span-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity size={16} className="text-sky-500" />
                      <h3 className="font-bold text-sm text-slate-700">Cuadro de Saldo de Efectivo (Balance Deudor)</h3>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">Evolución del saldo pendiente a lo largo del tiempo. El punto resaltado se sincroniza con las otras gráficas al pasar el cursor.</p>
                    <div className="h-56">
                      <Line
                        data={balanceData}
                        plugins={[hoverPlugin]}
                        options={{
                          ...CHART_DEFAULTS,
                          plugins: {
                            ...CHART_DEFAULTS.plugins,
                            tooltip: {
                              ...CHART_DEFAULTS.plugins.tooltip,
                              mode: 'index',
                              callbacks: {
                                label: ctx => `Saldo: ${fmt(ctx.raw, currency)}`
                              }
                            }
                          },
                          scales: {
                            x: { grid: { display: false } },
                            y: { beginAtZero: true, ticks: { callback: v => fmt(v, currency) } }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── TAB: TABLA ─── */}
              <div className={activeTab !== 'tabla' ? 'hidden print:block' : 'block'}>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Activity size={16} className="text-indigo-500" />
                      <h3 className="font-bold text-sm text-slate-700">Tabla de Amortización Mensual</h3>
                    </div>
                    <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{plazo} pagos</span>
                  </div>
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm amort-table">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          {['Mes', 'Cuota', 'Capital', 'Intereses', 'Saldo'].map(h => (
                            <th key={h} className="px-4 py-3 text-right first:text-center text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {results.schedule.map((row, i) => (
                          <tr
                            key={row.mes}
                            className={`transition-colors hover:bg-indigo-50/40 ${i === hoveredIndex ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-100' : ''}`}
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                          >
                            <td className="px-4 py-2.5 text-center font-bold text-slate-400 text-xs">{row.mes}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-slate-700">{fmt(row.cuota, currency)}</td>
                            <td className="px-4 py-2.5 text-right text-indigo-600 font-medium">{fmt(row.capital, currency)}</td>
                            <td className="px-4 py-2.5 text-right text-rose-500 font-medium">{fmt(row.interes, currency)}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-700 bg-slate-50/50">{fmt(row.saldo, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                        <tr>
                          <td className="px-4 py-3 text-center text-xs font-bold text-slate-500">TOTAL</td>
                          <td className="px-4 py-3 text-right font-extrabold text-slate-800">{fmt(results.totalPaid, currency)}</td>
                          <td className="px-4 py-3 text-right font-bold text-indigo-700">{fmt(monto, currency)}</td>
                          <td className="px-4 py-3 text-right font-bold text-rose-600">{fmt(results.totalIntereses, currency)}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-400">—</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* ── TAB: ANÁLISIS ─── */}
              <div className={activeTab !== 'analisis' ? 'hidden print:block' : 'block'}>
                {buildAnalysis()}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Créditos ──────────────────────────────────────────────────────────
function CreditsTilt() {
  const [tilted, setTilted] = useState(false);
  return (
    <div className="p-4 border-t border-slate-100">
      <motion.div
        className="cursor-pointer"
        onClick={() => setTilted(!tilted)}
        animate={tilted ? { rotateX: 12, rotateZ: -2, scale: 1.04 } : { rotateX: 0, rotateZ: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        style={{ perspective: 800, transformStyle: 'preserve-3d' }}
      >
        <div className={`rounded-xl border p-4 transition-colors ${tilted ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-50 border-slate-200'}`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${tilted ? 'text-indigo-300' : 'text-slate-400'}`}>Créditos</p>
          <p className={`font-bold text-sm ${tilted ? 'text-white' : 'text-slate-700'}`}>Estudiantes UCAB</p>
          <AnimatePresence>
            {tilted && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-1.5 text-indigo-100 mt-3 text-xs">
                  <ArrowRight size={12} className="mt-0.5 flex-shrink-0" />
                  <span>Para consultas escribir al coordinador: <strong className="text-white">coordinador@ucab.edu.ve</strong></span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
