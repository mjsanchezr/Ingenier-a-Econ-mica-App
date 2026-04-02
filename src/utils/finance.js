export function calculateAmortization(P, r_anual, n) {
  if (P <= 0 || r_anual <= 0 || n <= 0) return null;

  // Tasa efectiva mensual
  const r = (r_anual / 100) / 12;

  // Fórmula de Anualidad Ordinaria Vencida
  // A = P * [ r(1+r)^n ] / [ (1+r)^n - 1 ]
  const factor = Math.pow(1 + r, n);
  const A = P * ((r * factor) / (factor - 1));

  let saldo = P;
  let totalIntereses = 0;
  let totalCapital = 0;

  const schedule = [];
  const cashFlowData = [];   // solo pagos (positivo = desembolso)
  const balanceData = [P];   // saldo deudor, arranca en P
  const interestData = [];   // interés por mes
  const capitalData = [];    // capital por mes
  const labels = [];

  for (let mes = 1; mes <= n; mes++) {
    const interestPayment = saldo * r;
    let principalPayment = A - interestPayment;

    // Ajuste último mes para evitar centavos residuales
    if (mes === n) {
      principalPayment = saldo;
    }

    const cuota = principalPayment + interestPayment;
    saldo -= principalPayment;
    if (saldo < 0.005) saldo = 0;

    totalIntereses += interestPayment;
    totalCapital += principalPayment;

    schedule.push({
      mes,
      cuota,
      capital: principalPayment,
      interes: interestPayment,
      saldo
    });

    labels.push(`M${mes}`);
    cashFlowData.push(cuota);         // salida de efectivo (positivo = pago)
    balanceData.push(saldo);
    interestData.push(interestPayment);
    capitalData.push(principalPayment);
  }

  const monthlyRate = r;
  const totalPaid = P + totalIntereses;
  const effectiveCost = (totalIntereses / P) * 100;
  // TIR mensual (es r porque es flujo fijo)
  const tir_mensual = r * 100;
  const tir_anual = (Math.pow(1 + r, 12) - 1) * 100;

  return {
    monthlyPayment: A,
    totalIntereses,
    totalCapital,
    totalPaid,
    effectiveCost,         // % de intereses sobre capital
    tir_anual,
    monthlyRate,
    schedule,
    charts: {
      labels,
      cashFlowData,
      balanceData,
      interestData,
      capitalData
    }
  };
}
