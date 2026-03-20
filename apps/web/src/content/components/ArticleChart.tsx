import React from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ArticleChartProps {
  type: 'bar' | 'line';
  data: any[];
  title: string;
  description?: string;
  dataKey?: string | string[];
  xAxisKey: string;
  color?: string | string[];
}

const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

/**
 * Embeddable chart component for blog articles
 * Renders responsive bar or line charts with proper styling
 * Supports single or multiple data series
 */
export function ArticleChart({ 
  type, 
  data, 
  title, 
  description, 
  dataKey, 
  xAxisKey,
  color
}: ArticleChartProps) {
  const dataKeys = Array.isArray(dataKey) ? dataKey : (dataKey ? [dataKey] : []);
  const colorArray = Array.isArray(color) 
    ? color 
    : (color ? [color] : colors);

  return (
    <div className="my-8 bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-blue-200">{title}</h4>
        {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        {type === 'bar' ? (
          <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid stroke="#334155" />
            <XAxis dataKey={xAxisKey} stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <Legend />
            {dataKeys.map((key, i) => (
              <Bar 
                key={key}
                dataKey={key}
                stroke={colorArray[i]}
                fill={colorArray[i]}
                name={typeof key === 'string' ? key.charAt(0).toUpperCase() + key.slice(1) : key}
              />
            ))}
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid stroke="#334155" />
            <XAxis dataKey={xAxisKey} stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <Legend />
            {dataKeys.map((key, i) => (
              <Line 
                key={key}
                dataKey={key}
                stroke={colorArray[i]}
                fill={colorArray[i]}
                name={typeof key === 'string' ? key.charAt(0).toUpperCase() + key.slice(1) : key}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Simple comparison table component for articles
 */
export function ArticleTable({ 
  title, 
  headers, 
  rows 
}: { 
  title: string; 
  headers: string[]; 
  rows: Record<string, string>[] 
}) {
  return (
    <div className="my-8 bg-slate-800/50 border border-slate-700 rounded-lg p-6 overflow-x-auto">
      <h4 className="text-lg font-semibold text-blue-200 mb-4">{title}</h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-600">
            {headers.map((header, i) => (
              <th key={i} className="text-left px-4 py-2 font-semibold text-blue-300">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-700 hover:bg-slate-700/30">
              {headers.map((header, j) => (
                <td key={j} className="px-4 py-2 text-slate-300">
                  {row[header] || '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Callout/highlight box for important information
 */
export function ArticleCallout({ 
  title, 
  children, 
  type = 'info' 
}: { 
  title: string; 
  children: React.ReactNode; 
  type?: 'info' | 'warning' | 'tip' 
}) {
  const colors = {
    info: 'bg-blue-950/30 border-blue-700/50',
    warning: 'bg-amber-950/30 border-amber-700/50',
    tip: 'bg-emerald-950/30 border-emerald-700/50',
  };

  const titleColors = {
    info: 'text-blue-300',
    warning: 'text-amber-300',
    tip: 'text-emerald-300',
  };

  return (
    <div className={`my-6 border-l-4 p-4 rounded ${colors[type]}`}>
      <h4 className={`font-semibold mb-2 ${titleColors[type]}`}>{title}</h4>
      <div className="text-slate-300 text-sm">{children}</div>
    </div>
  );
}
