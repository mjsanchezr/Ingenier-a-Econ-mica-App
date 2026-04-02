import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler } from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileDown, Calculator, Landmark, HandCoins, ArrowRight } from 'lucide-react';
import { calculateAmortization } from './utils/finance';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler);

ChartJS.defaults.color = '#64748b';
ChartJS.defaults.font.family = "'Outfit', sans-serif";

export default function App() {
  const [currency, setCurrency] = useState('$');
  const [monto, setMonto] = useState(15000);
  const [tasa, setTasa] = useState(14);
  const [plazo, setPlazo] = useState(24);
  
  const [results, setResults] = useState(null);
  
  const pdfContainerRef = useRef(null);

  const formatMoney = (val) => Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleCalculate = () => {
    if (!monto || monto <= 0) {
      Swal.fire({
        title: 'Campo Requerido',
        text: 'Por favor, introduce un Monto del préstamo válido (mayor a 0).',
        icon: 'warning',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }
    if (!tasa || tasa <= 0) {
      Swal.fire({
        title: 'Tasa Inválida',
        text: 'Inserta una Tasa de Interés mayor a 0%.',
        icon: 'warning',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }
    if (!plazo || plazo <= 0 || !Number.isInteger(Number(plazo))) {
      Swal.fire({
        title: 'Plazo Inválido',
        text: 'El número de meses debe ser un entero mayor a 0.',
        icon: 'warning',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    const calc = calculateAmortization(Number(monto), Number(tasa), Number(plazo));
    setResults(calc);
  };

  useEffect(() => {
    // Cálculo inicial
    handleCalculate();
  }, []);

  const handleExportPDF = async () => {
    const element = pdfContainerRef.current;
    
    // Configurar estado de impresión
    element.classList.add('print-mode');
    
    // Esperar a que los estilos se apliquen
    await new Promise(r => setTimeout(r, 300));
    
    if (!Capacitor.isNativePlatform()) {
      // WEB puro: Nada supera la estructura estructurada del motor de impresión nativo del navegador.
      window.print();
      element.classList.remove('print-mode');
      return;
    }

    try {
      // Comportamiento MÓVIL (APK): Renderizado nativo
      Swal.fire({
         title: 'Procesando...',
         text: 'Estructurando tu documento PDF, por favor espera.',
         allowOutsideClick: false,
         didOpen: () => { Swal.showLoading(); }
      });

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      
      element.classList.remove('print-mode');

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // Si la imagen es muy larga, la partimos o la dejamos fluida en una pagina extendida
      pdf.addImage(imgData, 'JPEG', 0, 10, pdfWidth, pdfHeight);
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      
      Swal.close();

      const result = await Swal.fire({
        title: 'Opciones de Exportación',
        text: '¿Cómo deseas guardar tu reporte?',
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonColor: '#4f46e5',
        denyButtonColor: '#10b981',
        cancelButtonColor: '#ef4444',
        confirmButtonText: '<i class="lucide lucide-save"></i> Guardar Archivo',
        denyButtonText: '<i class="lucide lucide-share-2"></i> Compartir App (WhatsApp)',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        try {
          await Filesystem.writeFile({
            path: 'Reporte_Calculadora_Prestamos.pdf',
            data: pdfBase64,
            directory: Directory.Documents
          });
          Swal.fire({ title: 'PDF Generado', text: 'Se ha guardado exitosamente en tus Documentos.', icon: 'success' });
        } catch (e) {
          Swal.fire({ title: 'Error Detección Nativa', text: 'Permiso denegado: ' + e.message, icon: 'error' });
        }
      } else if (result.isDenied) {
        try {
          const savedFile = await Filesystem.writeFile({
            path: 'Reporte_Calculadora_Prestamos.pdf',
            data: pdfBase64,
            directory: Directory.Cache
          });
          await Share.share({ title: 'Reporte de Préstamo', url: savedFile.uri });
        } catch (e) {
             Swal.fire({ title: 'Error de Compartir', text: 'Fallo: ' + e.message, icon: 'error' });
        }
      }
    } catch (e) {
      element.classList.remove('print-mode');
      Swal.fire('Error Grave', 'Hubo un problema generando el documento.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 relative overflow-hidden">
      {/* Light background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-200/50 rounded-full blur-[100px] -z-10 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-sky-200/50 rounded-full blur-[100px] -z-10" style={{animation: 'pulse 8s infinite alternate-reverse'}}></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10" ref={pdfContainerRef}>
        
        {/* Header Section */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10 pdf-header"
        >
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-indigo-100 rounded-full text-indigo-600">
              <Landmark size={40} />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-sky-500 mb-4">
            Calculadora de Préstamos
          </h1>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg leading-relaxed mb-6">
            Herramienta analítica de <strong>Ingeniería Económica</strong>. Proyecta tu esquema de amortización, 
            estudia tu flujo de efectivo y comprende el impacto del interés en tus decisiones financieras.
          </p>

          <div className="flex flex-wrap justify-center gap-3 no-print">
            {['$', '€', '£', 'Bs.'].map(cur => (
              <button 
                key={cur}
                onClick={() => setCurrency(cur)}
                className={`px-5 py-2 rounded-full font-semibold transition-all ${currency === cur ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
              >
                {cur}
              </button>
            ))}
          </div>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Controls */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-4 no-print"
          >
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 sm:p-8 sticky top-6">
              
              <div className="bg-sky-50 border-l-4 border-sky-400 p-4 rounded-r-lg mb-8">
                <p className="text-sm text-sky-800">
                  <strong>Instrucciones:</strong> Desliza la barra para ajustar los valores de tu crédito o escríbelos directamente en los recuadros. Luego presiona Calcular.
                </p>
              </div>

              {/* Monto */}
              <div className="mb-8 p-1 group">
                <div className="flex justify-between items-center mb-3">
                  <label className="font-semibold text-slate-700">Cant. del Préstamo</label>
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                    <span className="text-slate-400 font-medium mr-1">{currency}</span>
                    <input 
                      type="number" 
                      value={monto} 
                      onChange={(e) => setMonto(e.target.value)}
                      className="w-24 text-right bg-transparent outline-none font-bold text-indigo-700 text-lg"
                    />
                  </div>
                </div>
                <input 
                  type="range" min="100" max="100000" step="100" 
                  value={monto} onChange={(e) => setMonto(e.target.value)}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500 transition-all"
                />
              </div>

              {/* Tasa */}
              <div className="mb-8 p-1">
                <div className="flex justify-between items-center mb-3">
                  <label className="font-semibold text-slate-700">Tasa de Interés Anual</label>
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100 transition-all">
                    <input 
                      type="number" 
                      value={tasa} 
                      onChange={(e) => setTasa(e.target.value)}
                      className="w-16 text-right bg-transparent outline-none font-bold text-sky-600 text-lg"
                    />
                    <span className="text-slate-400 font-medium ml-1">%</span>
                  </div>
                </div>
                <input 
                  type="range" min="0.1" max="100" step="0.1" 
                  value={tasa} onChange={(e) => setTasa(e.target.value)}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500 transition-all"
                />
              </div>

              {/* Plazo */}
              <div className="mb-8 p-1">
                <div className="flex justify-between items-center mb-3">
                  <label className="font-semibold text-slate-700">Meses de Pago</label>
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 focus-within:border-indigo-400 transition-all">
                    <input 
                      type="number" 
                      value={plazo} 
                      onChange={(e) => setPlazo(e.target.value)}
                      className="w-16 text-right bg-transparent outline-none font-bold text-slate-700 text-lg"
                    />
                    <span className="text-slate-400 font-medium ml-1">M</span>
                  </div>
                </div>
                <input 
                  type="range" min="1" max="120" step="1" 
                  value={plazo} onChange={(e) => setPlazo(e.target.value)}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 transition-all"
                />
              </div>

              <button 
                onClick={handleCalculate}
                className="w-full py-4 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-200 flex justify-center items-center gap-2 transform transition hover:-translate-y-1 active:translate-y-0"
              >
                <Calculator /> Calcular Análisis
              </button>
            </div>
          </motion.div>

          {/* Right Panel: Results */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-8 flex flex-col gap-6"
          >
            {results && (
              <>
                {/* Cuota Destacada */}
                <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden text-center main-result-box">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-sky-400"></div>
                  <h2 className="text-slate-500 uppercase tracking-widest font-bold text-sm mb-2">Cuota Fija Mensual</h2>
                  <motion.div 
                    key={results.monthlyPayment}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-5xl md:text-7xl font-extrabold text-slate-800 flex justify-center items-baseline"
                  >
                    <span className="text-3xl text-indigo-400 mr-2">{currency}</span>
                    {formatMoney(results.monthlyPayment)}
                  </motion.div>
                </div>

                {/* Gráficos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 charts-grid">
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-lg shadow-slate-100 flex flex-col items-center chart-wrapper">
                    <h3 className="font-semibold text-slate-700 mb-4">Proporción Capital vs Intereses</h3>
                    <div className="w-full aspect-square max-h-64 relative pb-4">
                      <Pie 
                        data={{
                          labels: ['Capital Solicitado', 'Intereses Totales'],
                          datasets: [{
                            data: [monto, results.totalIntereses],
                            backgroundColor: ['#4f46e5', '#38bdf8'],
                            borderWidth: 0,
                            hoverOffset: 10
                          }]
                        }} 
                        options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} 
                      />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-lg shadow-slate-100 flex flex-col chart-wrapper">
                    <h3 className="font-semibold text-slate-700 mb-4 text-center">Diagrama Flujo de Efectivo</h3>
                    <div className="w-full flex-1 min-h-[220px]">
                      <Bar 
                        data={{
                          labels: results.charts.labels,
                          datasets: [{
                            label: 'Flujo de Efectivo',
                            data: results.charts.cashFlowData,
                            backgroundColor: (ctx) => ctx.raw > 0 ? '#10b981' : '#f43f5e',
                            borderRadius: 4
                          }]
                        }}
                        options={{
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: { y: { ticks: { callback: (v) => currency + formatMoney(Math.abs(v)) } } }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-lg shadow-slate-100 chart-wrapper">
                    <h3 className="font-semibold text-slate-700 mb-4">Cuadro de Saldo de Efectivo (Balance)</h3>
                    <div className="w-full h-64">
                      <Line 
                        data={{
                          labels: results.charts.labels,
                          datasets: [{
                            label: 'Saldo Deudor',
                            data: results.charts.balanceData,
                            borderColor: '#0ea5e9',
                            backgroundColor: 'rgba(14, 165, 233, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHoverRadius: 6
                          }]
                        }}
                        options={{
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: { y: { beginAtZero: true, ticks: { callback: (v) => currency + formatMoney(v) } } }
                        }}
                      />
                    </div>
                </div>

                {/* Reflexión Crítica */}
                <div className="bg-indigo-50/50 border border-indigo-100 p-6 rounded-2xl text-slate-600 leading-relaxed text-left analysis-box">
                  <h4 className="flex items-center gap-2 font-bold text-indigo-800 mb-3 text-lg"><HandCoins className="text-indigo-500" /> Reflexión Crítica de Ing. Económica</h4>
                  <p>
                    Basándonos en el principio fundamental del <em>Valor del Dinero en el Tiempo</em> y utilizando el modelo matemático de amortización de <strong>Anualidad Ordinaria Vencida</strong>, el financiamiento de <strong className="text-indigo-700">{currency}{formatMoney(monto)}</strong> a una tasa nominal anual del <strong className="text-indigo-700">{tasa}%</strong> requiere <strong className="text-indigo-700">{plazo}</strong> flujos de efectivo nivelados (cuotas) de <strong className="text-sky-600">{currency}{formatMoney(results.monthlyPayment)}</strong>.
                  </p>
                  <p className="mt-3">
                    El costo de oportunidad y el sobreprecio generado reflejan un total de intereses de <strong className="text-rose-600">{currency}{formatMoney(results.totalIntereses)}</strong>. Esto significa que el costo financiero neto añadido sobre el capital prestado equivale a un incremento del <strong className="text-rose-600">{((results.totalIntereses / monto) * 100).toFixed(2)}%</strong> por concepto de intereses. Al analizar el cuadro de balance interactivo, podemos ratificar que durante los primeros meses la proporción abonada a los intereses es mucho mayor, acelerando la amortización a capital (reducción real de deuda) en el último tramo del plazo.
                  </p>
                </div>

                {/* Tabla */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-4 text-center">Mes</th>
                          <th className="p-4">Cuota ({currency})</th>
                          <th className="p-4">Amortización / Cap. ({currency})</th>
                          <th className="p-4">Intereses ({currency})</th>
                          <th className="p-4">Saldo Restante ({currency})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {results.schedule.map((row) => (
                          <tr key={row.mes} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-center font-bold text-slate-400">{row.mes}</td>
                            <td className="p-4 font-semibold text-slate-700">{formatMoney(row.cuota)}</td>
                            <td className="p-4 text-sky-600">{formatMoney(row.capital)}</td>
                            <td className="p-4 text-rose-500">{formatMoney(row.interes)}</td>
                            <td className="p-4 font-semibold text-indigo-700 bg-indigo-50/30">{formatMoney(row.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </>
            )}
          </motion.div>
        </div>

        {/* Buttons Actions */}
        {results && (
          <div className="mt-16 flex justify-center no-print outline-none focus:outline-none">
            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-3 px-8 py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-full font-bold text-lg shadow-xl shadow-slate-400/30 transition-transform active:scale-95"
            >
              <FileDown /> Exportar PDF Estructurado
            </button>
          </div>
        )}

      </div>

      {/* Tiltable Credits */}
      <div className="mt-20 flex justify-center pb-10 no-print">
        <CreditsTilt />
      </div>

      {/* Estilos adicionales para impresión (PDF) */}
      <style dangerouslySetInnerHTML={{__html: `
        .print-mode {
          background: #fff !important;
          padding: 20px !important;
          color: #000 !important;
          font-family: Arial, sans-serif !important;
        }
        .print-mode .no-print {
          display: none !important;
        }
        .print-mode .lg\\:col-span-12, .print-mode .grid-cols-12 {
          display: block !important;
          width: 100% !important;
        }
        .print-mode .results-grid {
          display: block !important;
        }
        .print-mode .bg-white {
          box-shadow: none !important;
          border: 1px solid #ddd !important;
          margin-bottom: 2rem !important;
          page-break-inside: avoid;
        }
        .print-mode .text-slate-800, .print-mode .text-slate-500 {
          color: #222 !important;
        }
        .print-mode .chart-wrapper canvas {
          max-height: 250px !important;
        }
      `}} />
    </div>
  );
}

// Subcomponente Creditos con Tilt 3D iterativo en Framer Motion
function CreditsTilt() {
  const [tilted, setTilted] = useState(false);

  return (
    <motion.div 
      className="cursor-pointer"
      onClick={() => setTilted(!tilted)}
      animate={ tilted ? { rotateX: 15, rotateZ: -3, scale: 1.05 } : { rotateX: 0, rotateZ: 0, scale: 1 } }
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={{ perspective: 1000, transformStyle: "preserve-3d" }}
    >
      <div className={`px-10 py-6 rounded-2xl border transition-colors ${tilted ? 'bg-indigo-600 border-indigo-500 shadow-2xl shadow-indigo-300' : 'bg-white border-slate-200 shadow-md hover:bg-slate-50'}`}>
        <h3 className={`text-sm font-bold uppercase tracking-widest mb-1 ${tilted ? 'text-indigo-200' : 'text-slate-400'}`}>Créditos de Desarrollo</h3>
        <p className={`font-bold text-xl ${tilted ? 'text-white' : 'text-slate-700'}`}>Estudiantes de la UCAB</p>

        <motion.div 
          initial={{ height: 0, opacity: 0, marginTop: 0 }}
          animate={{ height: tilted ? 'auto' : 0, opacity: tilted ? 1 : 0, marginTop: tilted ? 16 : 0 }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-2 text-indigo-100 bg-indigo-700/50 p-3 rounded-lg border border-indigo-400/30">
            <ArrowRight size={16} /> 
            <span>Para cualquier consulta escribir a la dirección del correo del Coordinador: <strong className="text-white ml-1">XXX@ucab.edu.ve</strong></span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
