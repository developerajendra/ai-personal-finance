/**
 * Zerodha Kite API Service
 * Handles authentication and data fetching from Zerodha Kite Connect API
 */

import { KiteConnect } from "kiteconnect";
import crypto from "crypto";
import * as userConfigRepo from "@/core/db/repositories/userConfigRepository";

function getZerodhaApiKey(userId?: string): string {
  if (userId) {
    const key = userConfigRepo.getConfig(userId, "zerodha", "api_key");
    if (key) return key;
  }
  return process.env.ZERODHA_API_KEY || "";
}

function getZerodhaApiSecret(userId?: string): string {
  if (userId) {
    const secret = userConfigRepo.getConfig(userId, "zerodha", "api_secret");
    if (secret) return secret;
  }
  return process.env.ZERODHA_API_SECRET || "";
}

const ZERODHA_REDIRECT_URI = process.env.ZERODHA_REDIRECT_URI || "http://localhost:3000/api/zerodha/callback";

export interface ZerodhaStock {
  tradingsymbol: string;
  exchange: string;
  instrument_token: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  pnl_percentage: number;
}

export interface ZerodhaMutualFund {
  tradingsymbol: string;
  fund_name: string;
  folio: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  pnl_percentage: number;
}

export interface ZerodhaPortfolio {
  stocks: ZerodhaStock[];
  mutualFunds: ZerodhaMutualFund[];
  totalValue: number;
  totalPnl: number;
  totalPnlPercentage: number;
}

/**
 * Get Zerodha Kite Connect login URL
 */
export function getZerodhaLoginUrl(userId?: string): string {
  const baseUrl = "https://kite.zerodha.com/connect/login";
  const params = new URLSearchParams({
    api_key: getZerodhaApiKey(userId),
    v: "3",
  });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate checksum for API request
 */
function generateChecksum(apiKey: string, requestToken: string, apiSecret: string): string {
  const message = `${apiKey}${requestToken}${apiSecret}`;
  return crypto.createHash("sha256").update(message).digest("hex");
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeAuthCode(requestToken: string, userId?: string): Promise<string> {
  try {
    const apiKey = getZerodhaApiKey(userId);
    const apiSecret = getZerodhaApiSecret(userId);
    if (!apiKey || !apiSecret) {
      throw new Error("Zerodha API credentials not configured");
    }

    const checksum = generateChecksum(apiKey, requestToken, apiSecret);

    const response = await fetch("https://api.kite.trade/session/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        api_key: apiKey,
        request_token: requestToken,
        checksum: checksum,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to exchange authorization code");
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error || "Authentication failed");
    }
    
    return data.data.access_token;
  } catch (error: any) {
    console.error("Error exchanging auth code:", error);
    throw error;
  }
}

/**
 * Fetch stock holdings from Zerodha
 */
export async function fetchStocks(accessToken: string, userId?: string): Promise<ZerodhaStock[]> {
  try {
    const apiKey = getZerodhaApiKey(userId);
    if (!apiKey || !accessToken) {
      throw new Error("Zerodha API not configured or not authenticated");
    }

    const kite = new KiteConnect({
      api_key: apiKey,
    });
    
    kite.setAccessToken(accessToken);

    // Fetch holdings (includes both stocks and other instruments)
    const holdings = await kite.getHoldings();
    
    // Filter only equity stocks (exclude mutual funds)
    const stocks = holdings
      .filter((holding: any) => {
        // Stocks are typically in NSE/BSE and have quantity > 0
        return (
          (holding.exchange === "NSE" || holding.exchange === "BSE") &&
          holding.quantity > 0 &&
          holding.product === "CNC" // Cash and Carry (delivery)
        );
      })
      .map((holding: any) => {
        const currentValue = holding.last_price * holding.quantity;
        const investedValue = holding.average_price * holding.quantity;
        const pnl = currentValue - investedValue;
        const pnlPercentage = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

        return {
          tradingsymbol: holding.tradingsymbol,
          exchange: holding.exchange,
          instrument_token: holding.instrument_token?.toString() || "",
          quantity: holding.quantity,
          average_price: holding.average_price,
          last_price: holding.last_price,
          pnl: pnl,
          pnl_percentage: pnlPercentage,
        } as ZerodhaStock;
      });

    return stocks;
  } catch (error: any) {
    console.error("Error fetching stocks from Zerodha:", error);
    // If API fails, return empty array (don't use mock data in production)
    if (process.env.NODE_ENV === "development") {
      console.warn("Using mock data due to API error");
      return getMockStocks();
    }
    throw error;
  }
}

/**
 * Fetch mutual fund holdings from Zerodha
 */
export async function fetchMutualFunds(accessToken: string, userId?: string): Promise<ZerodhaMutualFund[]> {
  try {
    const apiKey = getZerodhaApiKey(userId);
    if (!apiKey || !accessToken) {
      throw new Error("Zerodha API not configured or not authenticated");
    }

    const kite = new KiteConnect({
      api_key: apiKey,
    });
    
    kite.setAccessToken(accessToken);

    // Fetch mutual fund holdings
    const mfHoldings = await kite.getMFHoldings();
    
    // Transform to our format
    const mutualFunds = mfHoldings.map((mf: any) => {
      const currentValue = mf.last_price * mf.quantity;
      const investedValue = mf.average_price * mf.quantity;
      const pnl = currentValue - investedValue;
      const pnlPercentage = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

      return {
        tradingsymbol: mf.tradingsymbol || mf.scheme_code?.toString() || "",
        fund_name: mf.fund_name || mf.tradingsymbol || "Unknown Fund",
        folio: mf.folio || "",
        quantity: mf.quantity,
        average_price: mf.average_price,
        last_price: mf.last_price,
        pnl: pnl,
        pnl_percentage: pnlPercentage,
      } as ZerodhaMutualFund;
    });

    return mutualFunds;
  } catch (error: any) {
    console.error("Error fetching mutual funds from Zerodha:", error);
    // If API fails, return empty array (don't use mock data in production)
    if (process.env.NODE_ENV === "development") {
      console.warn("Using mock data due to API error");
      return getMockMutualFunds();
    }
    throw error;
  }
}

/**
 * Get complete portfolio from Zerodha
 */
export async function fetchPortfolio(accessToken: string): Promise<ZerodhaPortfolio> {
  const [stocks, mutualFunds] = await Promise.all([
    fetchStocks(accessToken),
    fetchMutualFunds(accessToken),
  ]);

  const totalStockValue = stocks.reduce((sum, stock) => sum + stock.last_price * stock.quantity, 0);
  const totalMfValue = mutualFunds.reduce((sum, mf) => sum + mf.last_price * mf.quantity, 0);
  const totalValue = totalStockValue + totalMfValue;

  const totalStockPnl = stocks.reduce((sum, stock) => sum + stock.pnl, 0);
  const totalMfPnl = mutualFunds.reduce((sum, mf) => sum + mf.pnl, 0);
  const totalPnl = totalStockPnl + totalMfPnl;

  const totalPnlPercentage = totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0;

  return {
    stocks,
    mutualFunds,
    totalValue,
    totalPnl,
    totalPnlPercentage,
  };
}

// Mock data for development/testing
export function getMockStocks(): ZerodhaStock[] {
  return [
    {
      tradingsymbol: "RELIANCE",
      exchange: "NSE",
      instrument_token: "738561",
      quantity: 10,
      average_price: 2450.50,
      last_price: 2520.75,
      pnl: 702.50,
      pnl_percentage: 2.87,
    },
    {
      tradingsymbol: "TCS",
      exchange: "NSE",
      instrument_token: "408065",
      quantity: 5,
      average_price: 3450.00,
      last_price: 3520.25,
      pnl: 351.25,
      pnl_percentage: 2.04,
    },
    {
      tradingsymbol: "INFY",
      exchange: "NSE",
      instrument_token: "408065",
      quantity: 8,
      average_price: 1520.50,
      last_price: 1480.25,
      pnl: -322.00,
      pnl_percentage: -2.65,
    },
  ];
}

export function getMockMutualFunds(): ZerodhaMutualFund[] {
  return [
    {
      tradingsymbol: "HDFC_EQ_OPP",
      fund_name: "HDFC Equity Opportunities Fund",
      folio: "FOL123456",
      quantity: 1000.50,
      average_price: 45.25,
      last_price: 48.75,
      pnl: 3500.00,
      pnl_percentage: 7.73,
    },
    {
      tradingsymbol: "SBI_BLUECHIP",
      fund_name: "SBI Bluechip Fund",
      folio: "FOL789012",
      quantity: 500.25,
      average_price: 52.00,
      last_price: 54.50,
      pnl: 1250.00,
      pnl_percentage: 4.81,
    },
  ];
}

