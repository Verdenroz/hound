import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { createClient } from '@/utils/supabase/server';
import { AgentExecutor } from '@/lib/agent/executor';

export async function POST(request: NextRequest) {
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

    // Get agent state to find session
    const { data: agentState } = await supabase
      .from('agent_state')
      .select('session_id')
      .eq('user_id', user.id)
      .single();

    // Initialize agent executor
    const executor = new AgentExecutor(
      process.env.TAVILY_API_KEY!,
      process.env.GEMINI_API_KEY!,
      process.env.XRPL_WALLET_SEED,
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await executor.stop(user.id);

    // Update agent session if exists
    if (agentState?.session_id) {
      const { data: trades } = await supabase
        .from('trades')
        .select('id')
        .eq('user_id', user.id);

      await supabase
        .from('agent_sessions')
        .update({
          stopped_at: new Date().toISOString(),
          status: 'stopped',
          trades_count: trades?.length || 0,
        })
        .eq('id', agentState.session_id);
    }

    console.log(`✅ Agent stopped for user: ${userEmail}`);

    return NextResponse.json({ success: true, message: 'Agent stopped' });
  } catch (error: any) {
    console.error('Error stopping agent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to stop agent' },
      { status: 500 }
    );
  }
}
