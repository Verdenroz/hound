import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    // Use FinanceQuery API for real stock search
    const apiUrl = `https://finance-query.onrender.com/v1/search?query=${encodeURIComponent(query)}&hits=20&type=stock`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`FinanceQuery API error: ${response.statusText}`);
    }

    const searchResults = await response.json();

    // Transform results to include logo
    const results = searchResults.map((result: any) => ({
      ticker: result.symbol,
      name: result.name,
      exchange: result.exchange,
      logo: `https://img.logo.dev/ticker/${result.symbol}?token=pk_Xd1Cdye3QYmCOXzcvxhxyw&retina=true`,
    }));

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Error searching tickers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search tickers' },
      { status: 500 }
    );
  }
}
