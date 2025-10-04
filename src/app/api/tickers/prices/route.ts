import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbols = searchParams.get('symbols');

    if (!symbols || typeof symbols !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter "symbols" is required (comma-separated)' },
        { status: 400 }
      );
    }

    // Use FinanceQuery API for real-time prices
    const apiUrl = `https://finance-query.onrender.com/v1/simple-quotes?symbols=${encodeURIComponent(symbols)}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`FinanceQuery API error: ${response.statusText}`);
    }

    const quotes = await response.json();

    // Transform to include logo and clean up data
    const prices = quotes.map((quote: any) => ({
      symbol: quote.symbol,
      name: quote.name,
      price: parseFloat(quote.price),
      change: parseFloat(quote.change),
      percentChange: quote.percentChange,
      logo:
        quote.logo ||
        `https://img.logo.dev/ticker/${quote.symbol}?token=pk_Xd1Cdye3QYmCOXzcvxhxyw&retina=true`,
    }));

    return NextResponse.json({ prices });
  } catch (error: any) {
    console.error('Error fetching prices:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}
