import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { auth0 } from '@/lib/auth0';

export async function PUT(request: NextRequest) {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { cash_balance, risk_tolerance, onboarding_completed } = body;

    if (cash_balance !== undefined && (typeof cash_balance !== 'number' || cash_balance < 0)) {
      return NextResponse.json(
        { error: 'Cash balance must be a non-negative number' },
        { status: 400 }
      );
    }

    if (
      risk_tolerance !== undefined &&
      !['conservative', 'moderate', 'aggressive'].includes(risk_tolerance)
    ) {
      return NextResponse.json(
        { error: 'Risk tolerance must be conservative, moderate, or aggressive' },
        { status: 400 }
      );
    }

    if (onboarding_completed !== undefined && typeof onboarding_completed !== 'boolean') {
      return NextResponse.json(
        { error: 'Onboarding completed must be a boolean' },
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

    // Update portfolio settings
    const updateData: any = {};
    if (cash_balance !== undefined) {
      updateData.cash_balance = cash_balance;
    }
    if (risk_tolerance !== undefined) {
      updateData.risk_tolerance = risk_tolerance;
    }
    if (onboarding_completed !== undefined) {
      updateData.onboarding_completed = onboarding_completed;
    }

    const { data: portfolio, error } = await supabase
      .from('portfolios')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ Updated portfolio settings for user: ${userEmail}`);

    return NextResponse.json({ success: true, portfolio });
  } catch (error: any) {
    console.error('Error updating portfolio settings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update portfolio settings' },
      { status: 500 }
    );
  }
}
