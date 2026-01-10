/**
 * Currency conversion service
 * Converts amounts from various currencies to INR
 */

export type Currency = 'INR' | 'NPR' | 'USD';

export interface ExchangeRates {
  [key: string]: number; // Rate to convert 1 unit of currency to INR
}

// Exchange rates (1 unit of currency = X INR)
// These are approximate rates - in production, you might want to fetch from an API
// Note: 1 NPR = 0.625 INR means NPR is worth less than INR
// So 1,000,000 NPR = 625,000 INR
const EXCHANGE_RATES: ExchangeRates = {
  INR: 1, // Base currency
  NPR: 0.625, // 1 NPR = 0.625 INR (approximately) - Verified: 1 NPR ≈ 0.6242-0.6250 INR
  USD: 83.0, // 1 USD = 83 INR (approximately, update as needed)
};

/**
 * Get exchange rate for a currency to INR
 */
export function getExchangeRate(currency: Currency): number {
  return EXCHANGE_RATES[currency] || 1;
}

/**
 * Convert amount from source currency to INR
 */
export function convertToINR(amount: number, fromCurrency: Currency): number {
  if (fromCurrency === 'INR') {
    return amount;
  }
  const rate = getExchangeRate(fromCurrency);
  return amount * rate;
}

/**
 * Convert amount from INR to target currency
 */
export function convertFromINR(amount: number, toCurrency: Currency): number {
  if (toCurrency === 'INR') {
    return amount;
  }
  const rate = getExchangeRate(toCurrency);
  return amount / rate;
}

/**
 * Get formatted conversion rate string for display
 */
export function getConversionRateText(fromCurrency: Currency, toCurrency: Currency = 'INR'): string {
  if (fromCurrency === toCurrency) {
    return '1:1';
  }
  if (toCurrency === 'INR') {
    const rate = getExchangeRate(fromCurrency);
    return `1 ${fromCurrency} = ${rate.toFixed(4)} INR`;
  }
  // For other conversions, calculate
  const fromRate = getExchangeRate(fromCurrency);
  const toRate = getExchangeRate(toCurrency);
  const conversionRate = fromRate / toRate;
  return `1 ${fromCurrency} = ${conversionRate.toFixed(4)} ${toCurrency}`;
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: Currency): string {
  switch (currency) {
    case 'INR':
      return '₹';
    case 'NPR':
      return 'Rs';
    case 'USD':
      return '$';
    default:
      return currency;
  }
}

/**
 * Format amount with currency symbol
 */
export function formatCurrency(amount: number, currency: Currency): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
