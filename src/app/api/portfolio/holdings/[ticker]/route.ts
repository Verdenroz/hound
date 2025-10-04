import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { auth0 } from '@/lib/auth0';

interface RouteParams {
  params: Promise<{ ticker: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticker } = await params;
    const body = await request.json();
    const { shares, avg_price } = body;

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    if (shares === undefined || typeof shares !== 'number') {
      return NextResponse.json(
        { error: 'Shares is required and must be a number' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const userEmail = session.user.email as string;

    // Get user
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update holding
    const updateData: any = { shares };
    if (avg_price !== undefined) {
      updateData.avg_price = avg_price;
    }

    const { data: holding, error } = await supabase
      .from('holdings')
      .update(updateData)
      .eq('user_id', user.id)
      .eq('ticker', ticker.toUpperCase())
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ Updated ticker ${ticker.toUpperCase()} in portfolio for user: ${userEmail}`);

    return NextResponse.json({ success: true, holding });
  } catch (error: any) {
    console.error('Error updating holding:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update holding' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticker } = await params;

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const userEmail = session.user.email as string;

    // Get user
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete holding
    const { error } = await supabase
      .from('holdings')
      .delete()
      .eq('user_id', user.id)
      .eq('ticker', ticker.toUpperCase());

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ Removed ticker ${ticker.toUpperCase()} from portfolio for user: ${userEmail}`);

    return NextResponse.json({ success: true, message: `Ticker ${ticker.toUpperCase()} removed` });
  } catch (error: any) {
    console.error('Error removing holding:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove holding' },
      { status: 500 }
    );
  }
}
