export interface AAAStatePriceLike {
  state: string;
  regular: number | null;
  midGrade: number | null;
  premium: number | null;
  diesel: number | null;
}

export interface AAAScrapeSummary {
  totalStates: number;
  populatedStates: number;
  emptyStates: string[];
  minPopulatedStates: number;
}

const DEFAULT_MIN_POPULATED_RATIO = 0.6;

function hasAnyPrice(state: AAAStatePriceLike): boolean {
  return (
    state.regular !== null ||
    state.midGrade !== null ||
    state.premium !== null ||
    state.diesel !== null
  );
}

export function summarizeAAAScrape(
  stateData: AAAStatePriceLike[],
  options?: { minPopulatedRatio?: number }
): AAAScrapeSummary {
  const totalStates = stateData.length;
  const populatedStates = stateData.filter(hasAnyPrice).length;
  const emptyStates = stateData.filter((state) => !hasAnyPrice(state)).map((state) => state.state);
  const minPopulatedRatio = options?.minPopulatedRatio ?? DEFAULT_MIN_POPULATED_RATIO;
  const minPopulatedStates = Math.max(1, Math.ceil(totalStates * minPopulatedRatio));

  return {
    totalStates,
    populatedStates,
    emptyStates,
    minPopulatedStates,
  };
}

export function assertAAAScrapeHealthy(
  stateData: AAAStatePriceLike[],
  options?: { minPopulatedRatio?: number }
): AAAScrapeSummary {
  const summary = summarizeAAAScrape(stateData, options);

  if (summary.populatedStates < summary.minPopulatedStates) {
    const sampleEmptyStates = summary.emptyStates.slice(0, 5).join(', ') || 'none';
    throw new Error(
      `AAA scrape rejected: only ${summary.populatedStates}/${summary.totalStates} states returned prices ` +
      `(minimum ${summary.minPopulatedStates}). Sample empty states: ${sampleEmptyStates}`
    );
  }

  return summary;
}
