"use client";

interface FinancialRatiosWidgetProps {
  debtToAssetRatio: number;
  liquidityRatio: number;
  savingsRate: number;
  isLoading: boolean;
}

type HealthLevel = "good" | "watch" | "critical";

interface RatioConfig {
  label: string;
  value: string;
  health: HealthLevel;
  healthLabel: string;
  hint: string;
}

function badge(health: HealthLevel) {
  const map: Record<HealthLevel, string> = {
    good: "bg-emerald-50 text-emerald-700",
    watch: "bg-amber-50 text-amber-700",
    critical: "bg-red-50 text-red-700",
  };
  return map[health];
}

function valueColor(health: HealthLevel) {
  const map: Record<HealthLevel, string> = {
    good: "text-emerald-600",
    watch: "text-amber-600",
    critical: "text-red-600",
  };
  return map[health];
}

function debtToAssetHealth(ratio: number): HealthLevel {
  if (ratio < 30) return "good";
  if (ratio < 50) return "watch";
  return "critical";
}

function liquidityHealth(ratio: number): HealthLevel {
  if (ratio > 6) return "good";
  if (ratio >= 3) return "watch";
  return "critical";
}

function savingsHealth(rate: number): HealthLevel {
  if (rate >= 20) return "good";
  if (rate >= 10) return "watch";
  return "critical";
}

function liquidityLabel(ratio: number): string {
  if (ratio === 0) return "No data";
  if (ratio >= 999) return "∞ months";
  return `${ratio.toFixed(1)} months`;
}

export function FinancialRatiosWidget({
  debtToAssetRatio,
  liquidityRatio,
  savingsRate,
  isLoading,
}: FinancialRatiosWidgetProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-36 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between py-3 border-b border-gray-50">
              <div className="space-y-1">
                <div className="h-3 bg-gray-200 rounded w-32" />
                <div className="h-2 bg-gray-100 rounded w-24" />
              </div>
              <div className="space-y-1 text-right">
                <div className="h-5 bg-gray-200 rounded w-16" />
                <div className="h-4 bg-gray-100 rounded w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const dta = debtToAssetHealth(debtToAssetRatio);
  const liq = liquidityHealth(liquidityRatio);
  const sav = savingsHealth(savingsRate);

  const ratios: RatioConfig[] = [
    {
      label: "Debt-to-Asset Ratio",
      value: `${debtToAssetRatio.toFixed(1)}%`,
      health: dta,
      healthLabel: dta === "good" ? "Healthy" : dta === "watch" ? "Watch" : "High Risk",
      hint: "Ideal: below 30%",
    },
    {
      label: "Liquidity Ratio",
      value: liquidityLabel(liquidityRatio),
      health: liq,
      healthLabel: liq === "good" ? "Strong" : liq === "watch" ? "Adequate" : "Low",
      hint: "Ideal: 6+ months of expenses",
    },
    {
      label: "Savings Rate",
      value: `${savingsRate.toFixed(1)}%`,
      health: sav,
      healthLabel: sav === "good" ? "Excellent" : sav === "watch" ? "Fair" : "Needs Attention",
      hint: "Ideal: above 20%",
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-base font-semibold text-gray-800 mb-2">Financial Ratios</h3>
      <p className="text-xs text-gray-400 mb-5">Key indicators of financial health</p>

      <div className="divide-y divide-gray-50">
        {ratios.map((ratio) => (
          <div key={ratio.label} className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium text-gray-700">{ratio.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{ratio.hint}</p>
            </div>
            <div className="text-right ml-4 flex-shrink-0">
              <p className={`text-xl font-bold ${valueColor(ratio.health)}`}>{ratio.value}</p>
              <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${badge(ratio.health)}`}>
                {ratio.healthLabel}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Overall score */}
      <div className="mt-4 pt-4 border-t border-gray-50">
        {(() => {
          const scores = [dta, liq, sav];
          const goodCount = scores.filter((s) => s === "good").length;
          const overallHealth =
            goodCount === 3 ? "good" : goodCount >= 2 ? "watch" : "critical";
          const label =
            overallHealth === "good"
              ? "Excellent financial health"
              : overallHealth === "watch"
              ? "Some areas need attention"
              : "Immediate action recommended";
          return (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${badge(overallHealth)}`}>
              <span className="text-xs font-semibold">{label}</span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
