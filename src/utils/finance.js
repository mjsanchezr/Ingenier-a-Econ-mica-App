export function calculateAmortization(P, r_anual, n) {
  if (P <= 0 || r_anual <= 0 || n <= 0) return null;

  const r = (r_anual / 100) / 12; // Tasa efectiva mensual
  
  // Fórmula Cuota: A = P * [ r(1+r)^n ] / [ (1+r)^n - 1 ]
  let A = P * ((r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
  
  let saldo = P;
  let totalIntereses = 0;
  
  const schedule = [];
  const cashFlowData = [P]; // Mes 0: Préstamo entra (positivo)
  const balanceData = [P];
  const labels = ['M0'];

  for (let mes = 1; mes <= n; mes++) {
      let interestPayment = saldo * r;
      let principalPayment = A - interestPayment;
      
      // Ajuste último mes
      if (mes === n) {
          principalPayment = saldo;
          A = principalPayment + interestPayment;
      }

      saldo -= principalPayment;
      if (saldo < 0.01) saldo = 0;
      
      totalIntereses += interestPayment;

      schedule.push({
          mes,
          cuota: A,
          capital: principalPayment,
          interes: interestPayment,
          saldo
      });

      labels.push(`M${mes}`);
      cashFlowData.push(-A); // Salidas mensuales (negativo)
      balanceData.push(saldo);
  }

  return {
      monthlyPayment: A,
      totalIntereses,
      totalPaid: P + totalIntereses,
      schedule,
      charts: {
          labels,
          cashFlowData,
          balanceData
      }
  };
}
