# FuelRipple Chart Design System

## Overview

The unified chart design system consolidates all dashboard visualizations around **Recharts** as the primary charting library. This provides:

- **Consistent styling**: All charts use slate-800 dark theme with slate/blue accent colors
- **Unified interactions**: Tooltips, legends, and loading states follow the same pattern
- **Reusable components**: Charts are wrapped in specialized containers for common use cases
- **Better testability**: Isolated components are easier to test visually and behaviorally

## Architecture

### Layer 1: Base Primitives

These low-level components handle core functionality:

- **`ChartTooltip`** — Renders custom Recharts tooltips with consistent styling
- **`CorrelationTooltip`** — Extended tooltip for statistical/correlation data
- **`ChartSkeleton`** — Animated loading state
- **`ChartLoading`** — Loading spinner with message
- **`ChartEmptyState`** — Empty data state with icon and message
- **`ChartErrorState`** — Error state with message

### Layer 2: Chart Components

Pre-configured chart wrappers for common patterns:

- **`PriceLineChart`** — Multi-series price trends (Historical, Correlation, Comparison)
- **`ComparisonBarChart`** — Regional/supply bar comparisons (side-by-side)
- **`UtilizationAreaChart`** — Stacked area charts (Supply, Inventory, Production)

### Layer 3: Container

- **`ChartContainer`** — Wrapper that combines title, subtitle, loading/empty/error states, and actions

## Usage Examples

### Basic Line Chart

```tsx
import { ChartContainer, PriceLineChart } from '@/components/charts';
import { useQuery } from '@tanstack/react-query';
import { getHistoricalPrices } from '@/api/client';

export function HistoricalChart() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['historicalPrices'],
    queryFn: getHistoricalPrices,
  });

  const series = [
    { key: 'regular', name: 'Regular', color: '#3b82f6', dataKey: 'regular' },
    { key: 'premium', name: 'Premium', color: '#ec4899', dataKey: 'premium' },
  ];

  return (
    <ChartContainer
      title="Historical Fuel Prices"
      subtitle="Last 5 years of AAA data"
      height={450}
      isLoading={isLoading}
      isError={isError}
      error={error}
      isEmpty={!data || data.length === 0}
      emptyMessage="No price data available for this period"
    >
      <PriceLineChart
        data={data || []}
        series={series}
        yAxisLabel="Price ($/gal)"
        xAxisLabel="Date"
        tooltip={{
          formatter: (value) => `$${(value as number).toFixed(3)}`,
          labelFormatter: (label) => new Date(label).toLocaleDateString(),
        }}
      />
    </ChartContainer>
  );
}
```

### Bar Chart for Comparisons

```tsx
import { ChartContainer, ComparisonBarChart } from '@/components/charts';

export function RegionalComparison() {
  const series = [
    {
      key: 'regular',
      name: 'Regular',
      dataKey: 'regular_price',
      color: '#3b82f6',
    },
    {
      key: 'diesel',
      name: 'Diesel',
      dataKey: 'diesel_price',
      color: '#10b981',
    },
  ];

  return (
    <ChartContainer
      title="Regional Price Comparison"
      height={350}
    >
      <ComparisonBarChart
        data={regionalData}
        series={series}
        xAxisKey="region"
        layout="horizontal"
        tooltip={{
          formatter: (value) => `$${(value as number).toFixed(3)}`,
        }}
      />
    </ChartContainer>
  );
}
```

### Area Chart for Supply Trends

```tsx
import { ChartContainer, UtilizationAreaChart } from '@/components/charts';

export function SupplyHealthChart() {
  const series = [
    {
      key: 'refining',
      name: 'Refining Utilization',
      dataKey: 'utilization_pct',
      color: '#3b82f6',
      stackId: 'supply',
    },
    {
      key: 'inventory',
      name: 'Inventory Health',
      dataKey: 'inventory_pct',
      color: '#10b981',
      stackId: 'supply',
    },
  ];

  return (
    <ChartContainer
      title="Supply Health"
      height={350}
    >
      <UtilizationAreaChart
        data={supplyData}
        series={series}
        yAxisDomain={[0, 100]}
        tooltip={{
          formatter: (value) => `${(value as number).toFixed(1)}%`,
        }}
      />
    </ChartContainer>
  );
}
```

## Colors and Theme

All charts use the following consistent color palette:

| Name | Color | Use Case |
|------|-------|----------|
| Blue | `#3b82f6` | Primary metric (regular gas) |
| Emerald | `#10b981` | Positive/supply (diesel) |
| Pink | `#ec4899` | Secondary metric (premium gas) |
| Violet | `#8b5cf6` | Tertiary (mid-grade) |
| Amber | `#f59e0b` | Warnings/elevated states |
| Orange | `#f97316` | Critical states |
| Red | `#ef4444` | Error states |

**Dark Theme:**
- Background: `#1e293b` (slate-900)
- Chart bg: `#0f172a` (slate-950)
- Accent bg: `#334155` (slate-700)
- Text primary: `#f1f5f9` (slate-100)
- Text secondary: `#cbd5e1` (slate-300)
- Grid lines: `#334155` (slate-700)

## Tooltip Customization

Tooltips are customized via the `tooltip` prop on chart components:

```typescript
tooltip={{
  formatter: (value, name) => {
    // Return formatted string or [value, label] tuple
    return `$${(value as number).toFixed(3)}`;
  },
  labelFormatter: (label) => {
    // Format the label/date
    return new Date(label).toLocaleDateString();
  },
}}
```

## Migration Guide

### From Recharts Direct Usage → Unified Components

**Before:**
```tsx
<ResponsiveContainer width="100%" height={400}>
  <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
    <XAxis dataKey="time" />
    <YAxis />
    <Tooltip content={/* custom logic */} />
    <Legend />
    <Line dataKey="price" stroke="#3b82f6" />
  </LineChart>
</ResponsiveContainer>
```

**After:**
```tsx
<PriceLineChart
  data={data}
  series={[{ key: 'price', name: 'Price', dataKey: 'price', color: '#3b82f6' }]}
  height={400}
/>
```

### Adding to ChartContainer

Wrap migration with loading/empty states:

```tsx
<ChartContainer
  title="Your Chart Title"
  isLoading={isLoading}
  isEmpty={!data || data.length === 0}
>
  <PriceLineChart
    data={data || []}
    series={series}
  />
</ChartContainer>
```

## Future Enhancements

- **Annotations**: Add event overlays (geo-events, OPEC meetings)
- **Sparklines**: Lightweight charts for card metrics
- **Interactive Legend**: Toggle series visibility
- **Responsive Design**: Adjust chart sizing on mobile
- **Export**: PNG/CSV export functionality
- **Custom Themes**: Support for light theme variant

## Design Vocabulary

| Element | Component | Styling |
|---------|-----------|---------|
| **Tooltip** | `ChartTooltip` | Dark (slate-900), border, rounded, shadow |
| **Legend** | Recharts `<Legend />` | Bottom positioned, slate text |
| **Grid** | Recharts `<CartesianGrid />` | Dashed, slate-700 color |
| **Axis Labels** | Recharts `<XAxis />` / `<YAxis />` | slate-400 text, 12px |
| **Loading** | `ChartSkeleton` | Animated bars, slate-700/50 background |
| **Empty** | `ChartEmptyState` | Icon + message, centered |
| **Error** | `ChartErrorState` | Red-tinted bg, warning icon |

## Testing

Each chart component can be tested via:

1. **Visual Regression**: Snapshot charts with sample data
2. **Interaction**: Test tooltip shows on hover, legend toggles
3. **State Management**: Verify loading/empty/error states display correctly
4. **Responsive**: Verify charts adapt to container size

Example test:
```tsx
describe('PriceLineChart', () => {
  it('renders with data and legend', () => {
    const { getByText } = render(
      <PriceLineChart
        data={mockData}
        series={[{ key: 'price', name: 'Price', color: '#3b82f6', dataKey: 'price' }]}
      />
    );
    expect(getByText('Price')).toBeInTheDocument();
  });
});
```

## Accessibility

All charts follow:
- **ARIA labels**: Charts have semantic structure
- **Keyboard navigation**: Tooltips accessible via keyboard
- **Color contrast**: All text meets WCAG AA standards
- **Responsive text**: Labels scale appropriately

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: iOS Safari 12+, Chrome Mobile latest
