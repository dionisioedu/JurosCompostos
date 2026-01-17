// Calculadora de Juros Compostos (MVP minimalista)
// Regras: cálculo mensal, com aporte mensal opcional.
// Observação: para MVP simples, usamos Number + arredondamento em 2 casas.
// Para precisão absoluta, dá pra trocar por decimal/big depois.

const $ = (sel) => document.querySelector(sel);

const els = {
  principal: $("#principal"),
  monthly: $("#monthly"),
  rate: $("#rate"),
  rateUnit: $("#rateUnit"),
  time: $("#time"),
  timeUnit: $("#timeUnit"),

  kpiFinal: $("#kpiFinal"),
  kpiInvested: $("#kpiInvested"),
  kpiInterest: $("#kpiInterest"),

  barInvested: $("#barInvested"),
  barInterest: $("#barInterest"),
  barFoot: $("#barFoot"),

  tbody: $("#tbody"),
  details: $("#details"),

  btnCopy: $("#btnCopy"),
  btnReset: $("#btnReset"),
};

const fmtBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function parseMoneyBR(input) {
  // aceita "1.234,56" ou "1234.56" ou "1234,56"
  if (!input) return 0;
  const s = String(input).trim();
  if (!s) return 0;

  // remove espaços e símbolos comuns
  const clean = s.replace(/[R$\s]/g, "");

  // se tem vírgula, assume formato BR e remove pontos de milhar
  if (clean.includes(",")) {
    const normalized = clean.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  // sem vírgula: tenta direto (pode ser 1234.56)
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}

function parseNumber(input) {
  if (!input) return 0;
  const s = String(input).trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function clampInt(n, min, max) {
  const x = Math.trunc(n);
  return Math.min(max, Math.max(min, x));
}

function monthlyRateFrom(ratePercent, unit) {
  const r = ratePercent / 100;
  if (unit === "month") return r;
  // conversão equivalente (não divide por 12):
  // (1 + r_ano)^(1/12) - 1
  return Math.pow(1 + r, 1 / 12) - 1;
}

function monthsFrom(timeValue, unit) {
  const t = timeValue;
  if (unit === "month") return t;
  return t * 12;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function simulateCompound({ principal, monthly, rateMonthly, months }) {
  let balance = principal;
  let invested = principal;
  const rows = [];

  for (let m = 1; m <= months; m++) {
    // aporte no início do mês (padrão mais comum em simuladores simples)
    if (monthly > 0) {
      balance += monthly;
      invested += monthly;
    }

    // aplica juros do mês
    balance *= (1 + rateMonthly);

    const interest = balance - invested;

    rows.push({
      month: m,
      balance: round2(balance),
      invested: round2(invested),
      interest: round2(interest),
    });
  }

  const final = round2(balance);
  const totalInvested = round2(invested);
  const totalInterest = round2(final - totalInvested);

  return { final, totalInvested, totalInterest, rows };
}

function updateUI() {
  // 1) ler inputs
  const principal = Math.max(0, parseMoneyBR(els.principal.value));
  const monthly = Math.max(0, parseMoneyBR(els.monthly.value));
  const ratePercent = Math.max(0, parseNumber(els.rate.value));
  const timeValue = clampInt(parseNumber(els.time.value) || 0, 0, 1200); // até 100 anos em meses

  const rateMonthly = monthlyRateFrom(ratePercent, els.rateUnit.value);
  const months = clampInt(monthsFrom(timeValue, els.timeUnit.value), 0, 1200);

  // 2) estado vazio: não “assusta” com zeros
  const hasSomething =
    principal > 0 || monthly > 0 || ratePercent > 0 || months > 0;

  if (!hasSomething) {
    els.kpiFinal.textContent = "—";
    els.kpiInvested.textContent = "—";
    els.kpiInterest.textContent = "—";
    els.barFoot.textContent = "—";
    els.tbody.innerHTML = "";
    return;
  }

  // 3) simular
  const { final, totalInvested, totalInterest, rows } = simulateCompound({
    principal,
    monthly,
    rateMonthly,
    months,
  });

  // 4) KPIs
  els.kpiFinal.textContent = fmtBRL.format(final);
  els.kpiInvested.textContent = fmtBRL.format(totalInvested);
  els.kpiInterest.textContent = fmtBRL.format(totalInterest);

  // 5) barra (investido vs juros)
  const denom = Math.max(0.000001, final);
  const investedPct = Math.max(0, Math.min(100, (totalInvested / denom) * 100));
  const interestPct = Math.max(0, 100 - investedPct);

  els.barInvested.style.width = `${investedPct}%`;
  els.barInterest.style.width = `${interestPct}%`;

  // copy persuasivo: “seu dinheiro trabalhou…”
  els.barFoot.textContent =
    totalInterest >= 0
      ? `Do total, ${fmtBRL.format(totalInvested)} foi seu dinheiro e ${fmtBRL.format(totalInterest)} foi o dinheiro trabalhando por você.`
      : `Confira os valores: o período/taxa podem estar muito baixos para aparecer efeito.`;

  // 6) tabela (só renderiza se o usuário abrir — economiza DOM)
  if (els.details.open) {
    renderTable(rows);
  } else {
    // limpa pra não gastar memória mantendo mil linhas à toa
    els.tbody.innerHTML = "";
  }

  // 7) permite copiar resumo
  els.btnCopy.dataset.summary = buildSummary({
    principal,
    monthly,
    ratePercent,
    rateUnit: els.rateUnit.value,
    timeValue,
    timeUnit: els.timeUnit.value,
    final,
    totalInvested,
    totalInterest,
  });
}

function buildSummary(p) {
  const rateUnitLabel = p.rateUnit === "month" ? "% ao mês" : "% ao ano";
  const timeUnitLabel = p.timeUnit === "month" ? "meses" : "anos";
  return [
    "Simulação de juros compostos",
    `• Valor inicial: ${fmtBRL.format(p.principal)}`,
    `• Aporte mensal: ${fmtBRL.format(p.monthly)}`,
    `• Taxa: ${p.ratePercent}% (${rateUnitLabel})`,
    `• Período: ${p.timeValue} ${timeUnitLabel}`,
    "",
    `→ Montante final: ${fmtBRL.format(p.final)}`,
    `→ Total investido: ${fmtBRL.format(p.totalInvested)}`,
    `→ Juros ganhos: ${fmtBRL.format(p.totalInterest)}`,
  ].join("\n");
}

function renderTable(rows) {
  // render simples e rápido
  const html = rows
    .map((r) => {
      return `<tr>
        <td>${r.month}</td>
        <td>${fmtBRL.format(r.balance)}</td>
        <td>${fmtBRL.format(r.invested)}</td>
        <td>${fmtBRL.format(r.interest)}</td>
      </tr>`;
    })
    .join("");

  els.tbody.innerHTML = html;
}

function bind() {
  const inputs = [
    els.principal,
    els.monthly,
    els.rate,
    els.rateUnit,
    els.time,
    els.timeUnit,
  ];

  inputs.forEach((el) => {
    el.addEventListener("input", updateUI);
    el.addEventListener("change", updateUI);
  });

  els.details.addEventListener("toggle", updateUI);

  els.btnReset.addEventListener("click", () => {
    els.principal.value = "";
    els.monthly.value = "";
    els.rate.value = "";
    els.time.value = "";
    els.rateUnit.value = "month";
    els.timeUnit.value = "month";
    els.details.open = false;
    updateUI();
  });

  els.btnCopy.addEventListener("click", async () => {
    const text = els.btnCopy.dataset.summary || "";
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      els.btnCopy.textContent = "Copiado ✓";
      setTimeout(() => (els.btnCopy.textContent = "Copiar resumo"), 1200);
    } catch {
      // fallback simples
      window.prompt("Copie o resumo:", text);
    }
  });

  // defaults bons pra “primeira experiência”
  els.principal.value = "1000";
  els.monthly.value = "200";
  els.rate.value = "1";
  els.rateUnit.value = "month";
  els.time.value = "24";
  els.timeUnit.value = "month";

  updateUI();
}

bind();
