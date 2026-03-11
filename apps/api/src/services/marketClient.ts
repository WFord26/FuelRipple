/**
 * Market Data Client
 *
 * Fetches real-time and historical crude oil prices from Yahoo Finance.
 * Uses the front-month NYMEX WTI and ICE Brent futures, which are the
 * headline "market price" numbers shown on financial terminals and news.
 *
 * Tickers:
 *   CL=F  — WTI Light Sweet Crude Oil (NYMEX front month)
 *   BZ=F  — Brent Crude Oil (ICE front month)
 *
 * No API key required. Data is delayed ~15 minutes during market hours.
 * Daily closing prices are available after market close (typically 4–5 PM ET).
 */

import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });

export interface CrudeQuote {
  symbol: string;
  price: number;
  previousClose: number;
  time: Date;
  currency: string;
  marketState: string; // 'REGULAR' | 'CLOSED' | 'PRE' | 'POST'
}

export interface CrudeDailyBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const WTI_TICKER = 'CL=F';
const BRENT_TICKER = 'BZ=F';

/**
 * Get the current (real-time / 15-min delayed) market quote for WTI and Brent.
 */
export async function fetchCrudeQuotes(): Promise<{ wti: CrudeQuote; brent: CrudeQuote }> {
  const [wtiResult, brentResult] = await Promise.all([
    yahooFinance.quote(WTI_TICKER),
    yahooFinance.quote(BRENT_TICKER),
  ]);

  const mapQuote = (result: any, symbol: string): CrudeQuote => ({
    symbol,
    price: result.regularMarketPrice ?? result.ask ?? 0,
    previousClose: result.regularMarketPreviousClose ?? 0,
    time: result.regularMarketTime ? new Date(result.regularMarketTime * 1000) : new Date(),
    currency: result.currency ?? 'USD',
    marketState: result.marketState ?? 'UNKNOWN',
  });

  return {
    wti: mapQuote(wtiResult, WTI_TICKER),
    brent: mapQuote(brentResult, BRENT_TICKER),
  };
}

/**
 * Fetch daily closing prices for WTI and Brent over a date range.
 * Returns arrays sorted oldest → newest.
 *
 * @param startDate - Inclusive start date
 * @param endDate   - Inclusive end date (defaults to today)
 */
export async function fetchCrudeHistory(
  startDate: Date,
  endDate: Date = new Date()
): Promise<{ wti: CrudeDailyBar[]; brent: CrudeDailyBar[] }> {
  const queryOptions = {
    period1: startDate,
    period2: endDate,
    interval: '1d' as const,
  };

  const [wtiHistory, brentHistory] = await Promise.all([
    yahooFinance.historical(WTI_TICKER, queryOptions),
    yahooFinance.historical(BRENT_TICKER, queryOptions),
  ]);

  const mapBars = (history: any[]): CrudeDailyBar[] =>
    history
      .filter(bar => bar.close != null && !isNaN(bar.close))
      .map(bar => ({
        date: new Date(bar.date),
        open: bar.open ?? bar.close,
        high: bar.high ?? bar.close,
        low: bar.low ?? bar.close,
        close: bar.close,
        volume: bar.volume ?? 0,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    wti: mapBars(wtiHistory),
    brent: mapBars(brentHistory),
  };
}
