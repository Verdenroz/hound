import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { auth0 } from '@/lib/auth0';

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const userEmail = session.user.email as string;

    // Get or create user
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get portfolio and holdings
    const [portfolioRes, holdingsRes] = await Promise.all([
      supabase.from('portfolios').select('*').eq('user_id', user.id).single(),
      supabase.from('holdings').select('*').eq('user_id', user.id),
    ]);

    if (portfolioRes.error) {
      return NextResponse.json({ error: portfolioRes.error.message }, { status: 500 });
    }
    if (holdingsRes.error) {
      return NextResponse.json({ error: holdingsRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      holdings: holdingsRes.data.map((h: any) => ({
        ticker: h.ticker,
        shares: h.shares,
        avg_price: h.avg_price,
      })),
      cash_balance: portfolioRes.data.cash_balance,
      risk_tolerance: portfolioRes.data.risk_tolerance,
    });
  } catch (error: any) {
    console.error('Error fetching portfolio:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch portfolio' },
      { status: 500 }
    );
  }
}
