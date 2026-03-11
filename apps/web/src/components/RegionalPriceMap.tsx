interface RegionalPriceMapProps {
  prices: Array<{ region: string; value: number }>;
}

export default function RegionalPriceMap({ prices }: RegionalPriceMapProps) {
  // Map EIA regions to display names and colors
  const getRegionData = (regionCode: string) => {
    const price = prices.find(p => p.region === regionCode);
    const value = price?.value || 0;
    
    // Color based on price relative to national average
    const nationalPrice = prices.find(p => p.region === 'NUS')?.value || 3.0;
    const diff = value - nationalPrice;
    
    let fill = '#64748b'; // default gray
    if (diff > 0.5) fill = '#ef4444'; // high - red
    else if (diff > 0.2) fill = '#f97316'; // elevated - orange
    else if (diff < -0.2) fill = '#22c55e'; // low - green
    else fill = '#eab308'; // near average - yellow
    
    return { value, fill };
  };

  const R10 = getRegionData('R10'); // East Coast (PADD 1)
  const R20 = getRegionData('R20'); // Midwest (PADD 2)
  const R30 = getRegionData('R30'); // Gulf Coast (PADD 3)
  const R40 = getRegionData('R40'); // Rocky Mountain (PADD 4)
  const R50 = getRegionData('R50'); // West Coast (PADD 5)

  return (
    <div className="w-full max-w-4xl mx-auto">
      <svg viewBox="0 0 960 600" className="w-full h-auto">
        {/* US Map with PADD regions - More realistic proportions */}
        
        {/* West Coast (PADD 5) - CA, OR, WA, NV, AZ */}
        <g className="cursor-pointer hover:opacity-90 transition-opacity">
          <path
            d="M 80,120 L 85,100 L 95,85 L 110,75 L 120,80 L 125,95 L 130,120 L 135,160 L 140,200 L 145,250 L 150,300 L 155,350 L 158,390 L 155,420 L 150,440 L 140,455 L 130,465 L 120,470 L 105,465 L 95,455 L 88,440 L 85,420 L 82,390 L 80,350 L 78,300 L 76,250 L 75,200 L 78,160 Z"
            fill={R50.fill}
            stroke="#0f172a"
            strokeWidth="2"
          />
          <text x="115" y="270" className="fill-white text-2xl font-bold" textAnchor="middle">
            ${R50.value.toFixed(2)}
          </text>
          <text x="115" y="295" className="fill-white text-sm" textAnchor="middle">
            West Coast
          </text>
        </g>

        {/* Rocky Mountain (PADD 4) - Mountain states */}
        <g className="cursor-pointer hover:opacity-90 transition-opacity">
          <path
            d="M 160,100 L 280,85 L 300,95 L 310,120 L 315,160 L 320,200 L 325,250 L 330,300 L 332,350 L 330,390 L 320,420 L 305,440 L 285,455 L 265,465 L 245,468 L 225,465 L 205,458 L 185,448 L 165,435 L 155,420 L 158,390 L 155,350 L 150,300 L 145,250 L 140,200 L 135,160 L 135,120 Z"
            fill={R40.fill}
            stroke="#0f172a"
            strokeWidth="2"
          />
          <text x="240" y="270" className="fill-white text-2xl font-bold" textAnchor="middle">
            ${R40.value.toFixed(2)}
          </text>
          <text x="240" y="295" className="fill-white text-sm" textAnchor="middle">
            Rocky Mtn
          </text>
        </g>

        {/* Midwest (PADD 2) - Central/Northern states */}
        <g className="cursor-pointer hover:opacity-90 transition-opacity">
          <path
            d="M 320,120 L 480,105 L 550,110 L 600,120 L 625,135 L 635,155 L 640,180 L 642,210 L 640,240 L 635,270 L 625,300 L 610,325 L 590,345 L 565,360 L 535,370 L 500,375 L 465,372 L 430,365 L 395,355 L 360,342 L 332,350 L 330,300 L 325,250 L 320,200 L 315,160 Z"
            fill={R20.fill}
            stroke="#0f172a"
            strokeWidth="2"
          />
          <text x="480" y="250" className="fill-white text-2xl font-bold" textAnchor="middle">
            ${R20.value.toFixed(2)}
          </text>
          <text x="480" y="275" className="fill-white text-sm" textAnchor="middle">
            Midwest
          </text>
        </g>

        {/* Gulf Coast (PADD 3) - TX, LA, OK, AR, NM */}
        <g className="cursor-pointer hover:opacity-90 transition-opacity">
          <path
            d="M 265,465 L 330,390 L 360,342 L 395,355 L 430,365 L 465,372 L 500,375 L 535,380 L 565,388 L 585,400 L 600,418 L 610,442 L 615,470 L 610,495 L 595,510 L 575,518 L 550,522 L 520,520 L 485,512 L 450,500 L 415,485 L 380,472 L 340,468 L 305,468 L 285,467 Z"
            fill={R30.fill}
            stroke="#0f172a"
            strokeWidth="2"
          />
          <text x="450" y="440" className="fill-white text-2xl font-bold" textAnchor="middle">
            ${R30.value.toFixed(2)}
          </text>
          <text x="450" y="465" className="fill-white text-sm" textAnchor="middle">
            Gulf Coast
          </text>
        </g>

        {/* East Coast (PADD 1) - Atlantic states */}
        <g className="cursor-pointer hover:opacity-90 transition-opacity">
          <path
            d="M 650,130 L 720,125 L 770,135 L 810,150 L 840,170 L 860,195 L 870,225 L 875,260 L 872,295 L 862,325 L 845,350 L 820,370 L 790,385 L 755,395 L 715,400 L 675,398 L 640,390 L 610,380 L 585,368 L 565,360 L 590,345 L 610,325 L 625,300 L 635,270 L 640,240 L 642,210 L 640,180 L 635,155 Z"
            fill={R10.fill}
            stroke="#0f172a"
            strokeWidth="2"
          />
          <text x="730" y="280" className="fill-white text-2xl font-bold" textAnchor="middle">
            ${R10.value.toFixed(2)}
          </text>
          <text x="730" y="305" className="fill-white text-sm" textAnchor="middle">
            East Coast
          </text>
        </g>
      </svg>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-sm justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500"></div>
          <span className="text-slate-300">Below Average</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500"></div>
          <span className="text-slate-300">Near Average</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-500"></div>
          <span className="text-slate-300">Above Average</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500"></div>
          <span className="text-slate-300">Well Above Average</span>
        </div>
      </div>
    </div>
  );
}
