import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { createClient } from '@/utils/supabase/server';
import { AgentExecutor } from '@/lib/agent/executor';

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Initialize agent executor
    const executor = new AgentExecutor(
      process.env.TAVILY_API_KEY!,
      process.env.GEMINI_API_KEY!,
      process.env.XRPL_WALLET_SEED,
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const status = await executor.getStatus(user.id);

    // Get recent logs
    const { data: logs } = await supabase
      .from('agent_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(20);

    return NextResponse.json({
      state: status.state,
      isRunning: status.is_running,
      wallet: status.wallet_address,
      portfolio: null, // Will be fetched separately
      logs: logs || [],
      currentNews: status.current_news,
      currentAnalysis: status.current_analysis,
      currentDecision: status.current_decision,
      userEmail,
    });
  } catch (error: any) {
    console.error('Error getting agent status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get agent status' },
      { status: 500 }
    );
  }
}
