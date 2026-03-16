import { usePageSEO } from '../hooks/usePageSEO';

/* ─── tiny helpers for rendering styled formula cards ─────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      {children}
    </section>
  );
}

function FormulaCard({
  id,
  title,
  description,
  formulas,
  parameters,
  outputs,
  notes,
  source,
}: {
  id: string;
  title: string;
  description: string;
  formulas: string[];
  parameters: { name: string; meaning: string }[];
  outputs: string;
  notes?: string;
  source: string;
}) {
  return (
    <div id={id} className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-4 scroll-mt-24">
      <div>
        <h4 className="text-lg font-semibold text-primary-400">{title}</h4>
        <p className="text-slate-400 text-sm mt-1">{description}</p>
      </div>

      {/* Formulas */}
      <div className="space-y-2">
        {formulas.map((f, i) => (
          <div
            key={i}
            className="bg-slate-900 rounded-lg px-4 py-3 font-mono text-sm text-slate-200 overflow-x-auto whitespace-nowrap"
          >
            {f}
          </div>
        ))}
      </div>

      {/* Parameters */}
      {parameters.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Parameters</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {parameters.map((p) => (
              <div key={p.name} className="flex gap-2">
                <span className="font-mono text-primary-300 shrink-0">{p.name}</span>
                <span className="text-slate-400">— {p.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Output */}
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Output</p>
        <p className="text-sm text-slate-300">{outputs}</p>
      </div>

      {/* Notes */}
      {notes && (
        <p className="text-sm text-slate-500 italic">{notes}</p>
      )}

      {/* Source module */}
      <p className="text-xs text-slate-600">
        Source: <code className="text-slate-500">{source}</code>
      </p>
    </div>
  );
}

function ThresholdTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-slate-300">
        <thead className="text-xs uppercase text-slate-500 border-b border-slate-700">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-800">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 font-mono">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── main page ───────────────────────────────────────────────────────────── */
export default function Methodology() {
  usePageSEO({
    title: 'Methodology',
    description:
      'Mathematical formulas and methodology behind the FuelRipple Consumer Disruption Index, fuel cost calculations, correlation analysis, and downstream impact estimates.',
    canonicalPath: '/methodology',
  });

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div>
        <h2 className="text-3xl font-bold text-white">Methodology</h2>
        <p className="text-slate-400 mt-2 max-w-3xl">
          FuelRipple translates raw energy-market data into household-level cost impacts.
          Every number on this site is computed from the formulas below, implemented as pure
          functions in the <code className="text-primary-400">@fuelripple/impact-engine</code> package
          with zero side effects.
        </p>
      </div>

      {/* Quick-nav */}
      <nav className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Jump to section</p>
        <div className="flex flex-wrap gap-2 text-sm">
          {[
            { label: 'Constants', href: '#constants' },
            { label: 'Fuel Cost', href: '#fuel-cost' },
            { label: 'Dollar Impact', href: '#dollar-impact' },
            { label: 'Household Impact', href: '#household-impact' },
            { label: 'Disruption Score', href: '#disruption-score' },
            { label: 'Volatility', href: '#volatility' },
            { label: 'Correlation', href: '#correlation' },
            { label: 'Cross-Correlation', href: '#cross-correlation' },
            { label: 'Crude → Gas Estimate', href: '#crude-gas-estimate' },
            { label: 'Rockets & Feathers', href: '#rockets-feathers' },
            { label: 'Freight Surcharge', href: '#freight-surcharge' },
            { label: 'Freight Rate', href: '#freight-rate' },
            { label: 'CPI Impact', href: '#cpi-impact' },
            { label: 'Supply Health', href: '#supply-utilization' },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-3 py-1.5 rounded-md bg-slate-700 text-slate-300 hover:bg-primary-600 hover:text-white transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>
      </nav>

      {/* ── Constants ─────────────────────────────────────────────────────── */}
      <section id="constants" className="scroll-mt-24 space-y-4">
        <h3 className="text-xl font-semibold text-white">Reference Constants</h3>
        <p className="text-slate-400 text-sm">
          These federally-sourced defaults are defined in{' '}
          <code className="text-primary-400">@fuelripple/shared</code> and used whenever
          user-specific values are not provided.
        </p>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 overflow-x-auto">
          <ThresholdTable
            headers={['Constant', 'Value', 'Source']}
            rows={[
              ['AVG_ANNUAL_MILES', '13,500 mi', 'FHWA Highway Statistics Table VM-1'],
              ['AVG_FLEET_MPG', '25.4 MPG', 'EPA Automotive Trends Report'],
              ['AVG_COMMUTE_DISTANCE', '20.5 mi', 'Census LEHD / ACS Table S0801'],
              ['WORKING_DAYS_PER_YEAR', '250 days', 'Standard assumption'],
              ['TRUCK_MPG', '6.5 MPG', 'Class 8 average (6.0–7.5)'],
              ['DIESEL_BASELINE', '$1.25/gal', 'DOE industry reference'],
              ['CRUDE_TO_GAS_RATIO', '0.025', '$10/bbl crude ≈ $0.25/gal gas'],
              ['VOLATILITY.CALM', '15%', 'Annualized vol threshold (gasoline)'],
              ['VOLATILITY.MODERATE', '30%', 'Annualized vol threshold'],
              ['VOLATILITY.ELEVATED', '50%', 'Annualized vol threshold'],
              ['BASE_FREIGHT_RATE_PER_MILE', '$2.70/mi', 'DAT/FreightWaves national dry-van avg'],
              ['DIESEL_COST_PER_MILE_FACTOR', '0.16', 'ATRI: $1/gal diesel → 16¢/mi trucking cost'],
              ['CPI_FREIGHT_ELASTICITY', '0.10–0.20', 'BLS PPI: freight % → CPI % range'],
              ['FOOD_TRANSPORT_SHARE', '0.09', 'USDA ERS: 9% of food cost is transport'],
            ]}
          />
        </div>
      </section>

      {/* ── Fuel Cost ─────────────────────────────────────────────────────── */}
      <Section title="Consumer Fuel Cost">
        <FormulaCard
          id="fuel-cost"
          title="calculateFuelCost()"
          description="Annual fuel cost, gallons consumed, commute-specific cost, and cost versus a baseline price."
          formulas={[
            'annualGallons  = annualMiles / vehicleMPG',
            'annualFuelCost = annualGallons × currentGasPrice',
            'commuteAnnualMiles = commuteDistance × 2 × workingDaysPerYear',
            'commuteGallons = commuteAnnualMiles / vehicleMPG',
            'commuteCostPerYear = commuteGallons × currentGasPrice',
            'costVsBaseline = annualFuelCost − (annualGallons × baselineGasPrice)',
          ]}
          parameters={[
            { name: 'annualMiles', meaning: 'Total miles driven per year' },
            { name: 'vehicleMPG', meaning: 'Vehicle fuel economy (miles per gallon)' },
            { name: 'commuteDistance', meaning: 'One-way commute distance (miles)' },
            { name: 'workingDaysPerYear', meaning: 'Working days per year' },
            { name: 'currentGasPrice', meaning: 'Current gas price ($/gallon)' },
            { name: 'baselineGasPrice', meaning: 'Reference price for comparison ($/gallon)' },
          ]}
          outputs="annualFuelCost ($), annualGallons (gal), priceSensitivity (gal/yr per $1 increase), commuteCostPerYear ($), costVsBaseline ($)"
          source="@fuelripple/impact-engine → fuelCost.ts"
        />

        <FormulaCard
          id="dollar-impact"
          title="calculateDollarImpact()"
          description="Additional annual cost incurred per $1/gallon gas price increase."
          formulas={['dollarImpact = annualMiles / vehicleMPG']}
          parameters={[
            { name: 'annualMiles', meaning: 'Total miles driven per year' },
            { name: 'vehicleMPG', meaning: 'Vehicle fuel economy (mi/gal)' },
          ]}
          outputs="Dollar impact per $1/gal increase (equals annual gallons consumed)"
          notes="Each gallon consumed costs an extra $1, so annual gallons = dollar impact."
          source="@fuelripple/impact-engine → fuelCost.ts"
        />

        <FormulaCard
          id="household-impact"
          title="calculateTypicalHouseholdImpact()"
          description="Impact for the average US household using federal default constants."
          formulas={[
            'costPerDollar = 13,500 / 25.4 ≈ 531.5 gal/yr',
            'annualCost    = costPerDollar × currentPrice',
            'vsBaseline    = (currentPrice − baselinePrice) × costPerDollar',
          ]}
          parameters={[
            { name: 'currentPrice', meaning: 'Current gas price ($/gallon)' },
            { name: 'baselinePrice', meaning: 'Historical baseline price ($/gallon)' },
          ]}
          outputs="Annual cost ($), difference vs. baseline ($)"
          notes="Key insight: every $1/gallon increase costs the average US driver ≈ $531.50/year."
          source="@fuelripple/impact-engine → fuelCost.ts"
        />
      </Section>

      {/* ── Disruption ────────────────────────────────────────────────────── */}
      <Section title="Consumer Disruption Index">
        <FormulaCard
          id="disruption-score"
          title="calculateDisruptionScore()"
          description="A z-score measuring how unusual the current week's price change is relative to recent history (52-week window). Uses a 3-week exponentially weighted moving average (α = 0.5) for smoothing, plus a directional signal."
          formulas={[
            'weeklyChange = (P_current − P_previous) / P_previous',
            'μ = (1/n) Σ Δᵢ',
            'σ = √[ (1/n) Σ (Δᵢ − μ)² ]',
            'rawScore = (weeklyChange − μ) / σ',
            'smoothedScore = EMA₃(z₀, z₁, z₂)  [α=0.5, weights: 57%/29%/14%]',
            'direction = rising (Δ > 0.5%) | falling (Δ < −0.5%) | stable',
          ]}
          parameters={[
            { name: 'currentPrice', meaning: "This week's gas price" },
            { name: 'previousPrice', meaning: "Last week's gas price" },
            { name: 'weeklyChanges', meaning: 'Array of historical weekly % changes' },
          ]}
          outputs="score (smoothed z-score), rawScore, classification, direction, weeklyChange, annualizedVolatility, timestamp"
          notes="Smoothing dampens single-week noise (e.g. from EIA/AAA source mixing). Direction tells consumers whether the disruption is hurting (rising) or helping (falling)."
          source="@fuelripple/impact-engine → disruption.ts"
        />

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-3">
          <h4 className="text-lg font-semibold text-primary-400">Classification Thresholds</h4>
          <p className="text-sm text-slate-400">
            The absolute value of the z-score maps to a severity band and color:
          </p>
          <ThresholdTable
            headers={['|z|', 'Classification', 'Color']}
            rows={[
              ['< 1.0', 'normal', '🟢 Green'],
              ['1.0 – 2.0', 'elevated', '🟡 Yellow'],
              ['2.0 – 3.0', 'high', '🟠 Orange'],
              ['≥ 3.0', 'crisis', '🔴 Red'],
            ]}
          />
        </div>

        <FormulaCard
          id="volatility"
          title="calculateAnnualizedVolatility()"
          description="Annualized price volatility from weekly log returns — the same methodology used in financial markets."
          formulas={[
            'rᵢ = ln(1 + Δᵢ)',
            'μᵣ = (1/n) Σ rᵢ',
            'σᵣ = √[ (1/n) Σ (rᵢ − μᵣ)² ]',
            'annualizedVolatility = σᵣ × √52 × 100',
          ]}
          parameters={[
            { name: 'weeklyChanges', meaning: 'Array of weekly percentage price changes' },
          ]}
          outputs="Annualized volatility as a percentage"
          notes="The √52 factor converts weekly standard deviation to an annual figure (52 weeks/year)."
          source="@fuelripple/impact-engine → disruption.ts"
        />

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-3">
          <h4 className="text-lg font-semibold text-primary-400">Volatility Classification</h4>
          <p className="text-sm text-slate-400 mb-2">
            Calibrated for US gasoline (historical range 10–25% typical, 30–50% during shocks, 50%+ during crises).
          </p>
          <ThresholdTable
            headers={['Annualized Vol.', 'Classification']}
            rows={[
              ['< 15%', 'calm'],
              ['15% – 30%', 'moderate'],
              ['30% – 50%', 'elevated'],
              ['≥ 50%', 'extreme'],
            ]}
          />
        </div>
      </Section>

      {/* ── Correlation ───────────────────────────────────────────────────── */}
      <Section title="Market Correlation">
        <FormulaCard
          id="correlation"
          title="calculateCorrelation()"
          description="Pearson correlation coefficient between gas prices and oil prices."
          formulas={[
            'r = Σ(Gᵢ − Ḡ)(Oᵢ − Ō) / √[ Σ(Gᵢ − Ḡ)² · Σ(Oᵢ − Ō)² ]',
          ]}
          parameters={[
            { name: 'gasPrices', meaning: 'Array of gas price observations' },
            { name: 'oilPrices', meaning: 'Array of oil price observations (same length, time-aligned)' },
          ]}
          outputs="Pearson r ∈ [−1, 1]"
          source="@fuelripple/impact-engine → correlation.ts"
        />

        <FormulaCard
          id="cross-correlation"
          title="calculateCrossCorrelation() / findOptimalLag()"
          description="Cross-correlation function (CCF) at different time lags to measure how oil price changes lead gas price changes."
          formulas={[
            'CCF(k) = r(Gas_t, Oil_{t−k})  for k = 0, 1, 2, …, maxLag',
            'k* = argmax_k |CCF(k)|',
          ]}
          parameters={[
            { name: 'gasPrices', meaning: 'Gas price time series' },
            { name: 'oilPrices', meaning: 'Oil price time series' },
            { name: 'maxLag', meaning: 'Maximum lag to test (default: 12 weeks)' },
          ]}
          outputs="Array of { lag, correlation } pairs; optimal lag k* in weeks"
          notes="Typically 1–2 weeks for price increases — crude oil changes predict retail gas changes."
          source="@fuelripple/impact-engine → correlation.ts"
        />

        <FormulaCard
          id="crude-gas-estimate"
          title="estimateGasPriceFromCrude()"
          description="Rule-of-thumb estimate mapping crude oil price change to retail gas price change."
          formulas={['ΔGas = ΔCrude × 0.025']}
          parameters={[
            { name: 'crudeChange', meaning: 'Change in crude oil price ($/barrel)' },
          ]}
          outputs="Estimated gas price change ($/gallon)"
          notes="$10/barrel crude change ≈ $0.25/gallon gas change."
          source="@fuelripple/impact-engine → correlation.ts"
        />

        <FormulaCard
          id="rockets-feathers"
          title="analyzeRocketsAndFeathers()"
          description='Detects asymmetric price transmission — gas prices "rocket up" faster than they "feather down" relative to crude oil movements.'
          formulas={[
            'avgIncreaseSpeed = (1/|U|) Σ |ΔGᵢ|   (weeks oil rose > 0.1%)',
            'avgDecreaseSpeed = (1/|D|) Σ |ΔGᵢ|   (weeks oil fell > 0.1%)',
            'asymmetryRatio   = avgIncreaseSpeed / avgDecreaseSpeed',
            '',
            'riseElasticity   = (1/|U|) Σ (ΔGᵢ / ΔOᵢ)   where ΔOᵢ > 0.001',
            'fallElasticity   = (1/|D|) Σ (ΔGᵢ / ΔOᵢ)   where ΔOᵢ < −0.001',
            'elasticityRatio  = riseElasticity / fallElasticity',
          ]}
          parameters={[
            { name: 'gasPriceChanges', meaning: 'Array of week-over-week gas % changes' },
            { name: 'oilPriceChanges', meaning: 'Array of week-over-week oil % changes (aligned)' },
          ]}
          outputs="asymmetryRatio, riseElasticity, fallElasticity, elasticityRatio, cumulativePassThrough[], riseHalfLifeWeeks, fallHalfLifeWeeks"
          notes="An elasticityRatio > 1 means gas is more responsive to crude increases than decreases. Cumulative pass-through tracks how much of a crude shock has been reflected in gas prices over 5 weeks; half-life is the week count until 50% pass-through."
          source="@fuelripple/impact-engine → correlation.ts"
        />
      </Section>

      {/* ── Downstream ────────────────────────────────────────────────────── */}
      <Section title="Downstream Impact">
        <FormulaCard
          id="freight-surcharge"
          title="calculateFreightSurcharge()"
          description="Fuel surcharge per mile for freight trucks. Defaults to the DOE baseline but can use a rolling 52-week-ago diesel price for more relevant comparisons."
          formulas={[
            'dieselDelta     = P_diesel − baseline',
            'surchargePerMile = dieselDelta / 6.5',
          ]}
          parameters={[
            { name: 'currentDieselPrice', meaning: 'Current on-highway diesel price ($/gal)' },
            { name: 'baseline', meaning: 'Comparison point: DOE $1.25 or 52-week-ago price' },
          ]}
          outputs="surchargePerMile ($/mile), baselineDiesel, dieselDelta ($/gal), baselineSource"
          notes="API defaults to a rolling 52-week-ago diesel price for the baseline, making the numbers reflect recent change rather than long-term gap vs 2000s DOE reference."
          source="@fuelripple/impact-engine → downstream.ts"
        />

        <FormulaCard
          id="freight-rate"
          title="estimateFreightRateIncrease()"
          description="Trucking cost increase from a diesel price increase."
          formulas={[
            'costPerMileIncrease      = ΔP_diesel × 0.16',
            'freightRateIncrease (%)  = (costPerMileIncrease / $2.70) × 100',
          ]}
          parameters={[
            { name: 'dieselPriceIncrease', meaning: 'Increase in diesel price ($/gal)' },
          ]}
          outputs="costPerMileIncrease ($/mile), freightRateIncreasePercent (%)"
          notes="The 0.16 factor is the midpoint of the 15–17¢/mile per $1/gal increase from ATRI operational cost data. $2.70/mi is the national dry-van average (DAT/FreightWaves, 2024–25)."
          source="@fuelripple/impact-engine → downstream.ts"
        />

        <FormulaCard
          id="cpi-impact"
          title="estimateCPIImpact()"
          description="Consumer goods price increase resulting from freight rate increases."
          formulas={[
            'minCPIIncrease = freightRate% × 0.10',
            'maxCPIIncrease = freightRate% × 0.20',
            'avgCPIIncrease = (min + max) / 2',
          ]}
          parameters={[
            { name: 'freightRateIncreasePercent', meaning: 'Freight rate increase (%)' },
          ]}
          outputs="minCPIIncrease (%), maxCPIIncrease (%), avgCPIIncrease (%)"
          notes='Multipliers (0.10–0.20) from Architecture §4.5.2: 5% freight → 0.5% CPI (low), 10% freight → 2.0% CPI (high). Food price impact (9% transport share) is a subset of CPI, not additive.'
          source="@fuelripple/impact-engine → downstream.ts"
        />

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-3">
          <h4 className="text-lg font-semibold text-primary-400">Pass-Through Lag Timelines</h4>
          <p className="text-sm text-slate-400">
            Impact is not instantaneous — each stage takes time to materialize:
          </p>
          <ThresholdTable
            headers={['Stage', 'Lag', 'Mechanism']}
            rows={[
              ['Freight surcharges', '1–2 weeks', 'Contract fuel-surcharge clauses adjust automatically'],
              ['Consumer goods CPI', '2–6 months', 'Retailers absorb costs initially, then pass through over quarters'],
              ['Food prices', '1–3 months', 'Grocery supply chains shorter than general retail'],
            ]}
          />
        </div>
      </Section>

      {/* ── Supply Health ─────────────────────────────────────────────────── */}
      <Section title="Supply Health Monitor">
        <FormulaCard
          id="supply-utilization"
          title="Refinery Utilization Stress Index"
          description="Z-score measuring how current refinery utilization compares to the 52-week average, computed per PADD region."
          formulas={[
            'utilization_delta = current_utilization − avg_utilization_52w',
            'stress_z = utilization_delta / stddev(utilization_52w)',
          ]}
          parameters={[
            { name: 'current_utilization', meaning: 'Latest refinery utilization %' },
            { name: 'avg_utilization_52w', meaning: '52-week rolling average utilization' },
          ]}
          outputs="stress_z_score per region, classification"
          source="@fuelripple/db → queries/supply.ts"
        />

        <FormulaCard
          id="supply-inventory"
          title="Inventory Health Score"
          description="Days-of-supply computed from stocks ÷ implied daily demand (EIA product_supplied). Z-score compares current level to the 52-week rolling average."
          formulas={[
            'days_of_supply = gasoline_stocks / (product_supplied_gas / 7)',
            'inventory_z = (stocks − avg_stocks_52w) / stddev_stocks_52w',
          ]}
          parameters={[
            { name: 'gasoline_stocks', meaning: 'Weekly ending stocks (thousand barrels)' },
            { name: 'product_supplied_gas', meaning: 'Implied gasoline demand (EIA, k bbl/day)' },
          ]}
          outputs="gasoline_days_supply, inventory_z_score"
          notes="Falls back to gasoline_production as a demand proxy when product_supplied data is unavailable. A 5-year seasonal comparison (same calendar week across years) is planned when enough data history accumulates."
          source="@fuelripple/db → queries/supply.ts"
        />

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-3">
          <h4 className="text-lg font-semibold text-primary-400">Supply Classification Thresholds</h4>
          <p className="text-sm text-slate-400">
            Classification uses <span className="font-semibold text-slate-300">both</span> utilization and inventory z-scores. A supply-squeeze alert fires when both are simultaneously stressed.
          </p>
          <ThresholdTable
            headers={['Condition', 'Classification']}
            rows={[
              ['util z > −0.5 AND inventory z > −1.0', 'Normal'],
              ['util z ≤ −0.5 OR inventory z ≤ −1.0', 'Elevated Risk'],
              ['util z ≤ −1.5 OR inventory z ≤ −2.0 OR (both ≤ −1.0)', 'Supply Stress'],
              ['util z ≤ −2.5 OR inventory z ≤ −2.5', 'Critical'],
            ]}
          />
          <ThresholdTable
            headers={['Alert', 'Trigger', 'Lead Time']}
            rows={[
              ['Supply Squeeze', 'inventory z < −1 AND util z < −1.5', '1–2 weeks before retail spike'],
            ]}
          />
        </div>
      </Section>

      {/* ── Data Sources ──────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Data Sources &amp; Freshness</h3>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 overflow-x-auto">
          <ThresholdTable
            headers={['Dataset', 'Source', 'Frequency', 'Cache TTL']}
            rows={[
              ['US Regular Gasoline', 'EIA (PET.EMM_EPMR_PTE_NUS_DPG.W)', 'Weekly (Mon)', '24 h'],
              ['WTI Crude Oil', 'EIA / FRED (PET.RWTC.D / DCOILWTICO)', 'Daily', '6 h'],
              ['On-Highway Diesel', 'EIA (PET.EMD_EPD2D_PTE_NUS_DPG.W)', 'Weekly', '24 h'],
              ['Refinery Utilization', 'EIA (WPULEUS3)', 'Weekly', '24 h'],
              ['Gasoline / Distillate Stocks', 'EIA (WGTSTUS1 / WDISTUS1)', 'Weekly', '24 h'],
            ]}
          />
        </div>
        <p className="text-sm text-slate-500">
          All data is ingested via background jobs (BullMQ), stored in a TimescaleDB hypertable,
          and served through a two-tier cache (in-memory LRU + Redis).
        </p>
      </section>
    </div>
  );
}
