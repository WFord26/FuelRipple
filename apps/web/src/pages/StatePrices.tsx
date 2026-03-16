import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getAllStatePrices } from '../api/client';
import { usePageSEO } from '../hooks/usePageSEO';

type SortKey = 'name' | 'abbr' | 'regular' | 'midGrade' | 'premium' | 'diesel';
type SortDir = 'asc' | 'desc';

export default function StatePrices() {
  usePageSEO({
    title: 'State Gas Prices — All 51 Locations',
    description: 'Daily gasoline and diesel prices for all 50 US states plus DC. Sortable by regular, mid-grade, premium, and diesel price.',
    canonicalPath: '/state-prices',
  });

  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filter, setFilter] = useState('');

  const { data: states, isLoading } = useQuery({
    queryKey: ['allStatePrices'],
    queryFn: getAllStatePrices,
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'abbr' ? 'asc' : 'desc');
    }
  };

  const sorted = useMemo(() => {
    if (!states) return [];
    let filtered = states;
    if (filter) {
      const q = filter.toLowerCase();
      filtered = states.filter(
        (s) => s.name.toLowerCase().includes(q) || s.abbr.toLowerCase().includes(q),
      );
    }
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [states, sortKey, sortDir, filter]);

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="px-3 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer select-none hover:text-white transition-colors"
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-slate-500">
          {sortKey === field ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </span>
    </th>
  );

  const formatPrice = (v: number | null) =>
    v != null ? `$${v.toFixed(3)}` : '—';

  const priceColor = (v: number | null, all: (number | null)[]) => {
    if (v == null || all.length === 0) return '';
    const valid = all.filter((x): x is number => x != null);
    if (valid.length === 0) return '';
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    if (max === min) return '';
    const pct = (v - min) / (max - min);
    if (pct > 0.8) return 'text-red-400';
    if (pct < 0.2) return 'text-green-400';
    return '';
  };

  // Collect all values per metric for coloring
  const allRegular = states?.map((s) => s.regular) ?? [];
  const allMid = states?.map((s) => s.midGrade) ?? [];
  const allPremium = states?.map((s) => s.premium) ?? [];
  const allDiesel = states?.map((s) => s.diesel) ?? [];

  const latestTime = states?.[0]?.time
    ? new Date(states[0].time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">State Gas Prices</h1>
        <p className="text-slate-400">
          Daily prices for all 50 states + DC — click any column header to sort
          {latestTime && <span className="text-slate-500 ml-2">· Updated {latestTime}</span>}
        </p>
      </div>

      {/* Filter */}
      <div className="max-w-sm">
        <input
          type="text"
          placeholder="Filter by state name or abbreviation…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-800 rounded" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-800/80 sticky top-0 z-10">
              <tr>
                <SortHeader label="State" field="name" />
                <SortHeader label="Abbr" field="abbr" />
                <SortHeader label="Regular" field="regular" />
                <SortHeader label="Mid-Grade" field="midGrade" />
                <SortHeader label="Premium" field="premium" />
                <SortHeader label="Diesel" field="diesel" />
              </tr>
            </thead>
            <tbody className="bg-slate-800/40 divide-y divide-slate-700/50">
              {sorted.map((s) => (
                <tr
                  key={s.region}
                  onClick={() => navigate(`/state/${s.abbr}`)}
                  className="hover:bg-slate-700/50 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2.5 text-sm font-medium text-white whitespace-nowrap">{s.name}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-400 font-mono">{s.abbr}</td>
                  <td className={`px-3 py-2.5 text-sm font-mono tabular-nums ${priceColor(s.regular, allRegular)}`}>{formatPrice(s.regular)}</td>
                  <td className={`px-3 py-2.5 text-sm font-mono tabular-nums ${priceColor(s.midGrade, allMid)}`}>{formatPrice(s.midGrade)}</td>
                  <td className={`px-3 py-2.5 text-sm font-mono tabular-nums ${priceColor(s.premium, allPremium)}`}>{formatPrice(s.premium)}</td>
                  <td className={`px-3 py-2.5 text-sm font-mono tabular-nums ${priceColor(s.diesel, allDiesel)}`}>{formatPrice(s.diesel)}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    No states match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        {sorted.length} location{sorted.length !== 1 ? 's' : ''} shown · Source: AAA via lykmapipo/US-Gas-Prices + EIA
      </p>
    </div>
  );
}
