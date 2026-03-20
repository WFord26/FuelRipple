import { useState } from 'react';
import { FuelCostInputSchema } from '@fuelripple/shared';
import { z } from 'zod';

type FuelInputs = z.infer<typeof FuelCostInputSchema>;

/**
 * ArticleFuelCalculator: A lightweight embedded fuel cost calculator for blog articles.
 * Allows readers to estimate their personal fuel cost impact.
 */
export function ArticleFuelCalculator() {
  const [inputs, setInputs] = useState<FuelInputs>({
    annualMiles: 13500,
    vehicleMPG: 25.4,
    commuteDistance: 20.5,
    workingDaysPerYear: 250,
    currentGasPrice: 3.50,
  });

  const [results, setResults] = useState<{ annualCost: number; monthlyAvg: number } | null>(null);

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();

    // Simple calculation: (annualMiles / vehicleMPG) * currentGasPrice
    const annualGallons = inputs.annualMiles / inputs.vehicleMPG;
    const annualCost = annualGallons * inputs.currentGasPrice;

    setResults({
      annualCost,
      monthlyAvg: annualCost / 12,
    });
  };

  return (
    <div className="border border-slate-600 bg-slate-900 p-6 rounded-lg my-6 space-y-4">
      <h3 className="text-xl font-semibold text-slate-100">Estimate Your Fuel Costs</h3>

      <form onSubmit={handleCalculate} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="annualMiles" className="block text-sm text-slate-300 mb-1">Annual Miles</label>
            <input
              id="annualMiles"
              type="number"
              value={inputs.annualMiles}
              onChange={(e) =>
                setInputs({ ...inputs, annualMiles: Number(e.target.value) })
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
            />
          </div>
          <div>
            <label htmlFor="vehicleMPG" className="block text-sm text-slate-300 mb-1">Vehicle MPG</label>
            <input
              id="vehicleMPG"
              type="number"
              step={0.1}
              value={inputs.vehicleMPG}
              onChange={(e) =>
                setInputs({ ...inputs, vehicleMPG: Number(e.target.value) })
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
            />
          </div>
        </div>

        <div>
          <label htmlFor="gasPrice" className="block text-sm text-slate-300 mb-1">Gas Price ($/gal)</label>
          <input
            id="gasPrice"
            type="number"
            step={0.01}
            value={inputs.currentGasPrice}
            onChange={(e) =>
              setInputs({ ...inputs, currentGasPrice: Number(e.target.value) })
            }
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
          />
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold text-white"
        >
          Calculate
        </button>
      </form>

      {results && (
        <div className="bg-slate-800 p-4 rounded border border-blue-500">
          <p className="text-slate-300">
            <span className="text-slate-400">Annual Cost:</span>{' '}
            <span className="text-2xl font-bold text-green-400">
              ${results.annualCost.toFixed(2)}
            </span>
          </p>
          <p className="text-slate-300 mt-2">
            <span className="text-slate-400">Monthly Average:</span>{' '}
            <span className="text-xl font-semibold text-yellow-400">
              ${results.monthlyAvg.toFixed(2)}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
