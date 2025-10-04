import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { auth0 } from '@/lib/auth0';

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ticker, shares = 0, avg_price = 0 } = body;

    if (!ticker || typeof ticker !== 'string') {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const userEmail = session.user.email as string;
    const userName = session.user.name as string;
    const auth0Sub = session.user.sub as string;

    // Get or create user
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (!user) {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({ auth0_sub: auth0Sub, email: userEmail, name: userName })
        .select()
        .single();

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
      user = newUser;
    }

    // Check if holding already exists
    const { data: existing } = await supabase
      .from('holdings')
      .select('*')
      .eq('user_id', user.id)
      .eq('ticker', ticker.toUpperCase())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: `Ticker ${ticker.toUpperCase()} already exists in portfolio` },
        { status: 400 }
      );
    }

    // Add holding
    const { data: holding, error } = await supabase
      .from('holdings')
      .insert({ user_id: user.id, ticker: ticker.toUpperCase(), shares, avg_price })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ Added ticker ${ticker.toUpperCase()} to portfolio for user: ${userEmail}`);

    return NextResponse.json({ success: true, holding });
  } catch (error: any) {
    console.error('Error adding holding:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add holding' },
      { status: 500 }
    );
  }
}
