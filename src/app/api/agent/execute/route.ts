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

    // Initialize agent executor
    const executor = new AgentExecutor(
      process.env.TAVILY_API_KEY!,
      process.env.GEMINI_API_KEY!,
      process.env.XRPL_WALLET_SEED,
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Execute one agent cycle
    const result = await executor.executeCycle(user.id);

    return NextResponse.json({
      success: true,
      state: result.state,
      isRunning: result.is_running,
    });
  } catch (error: any) {
    console.error('Error executing agent cycle:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute agent cycle' },
      { status: 500 }
    );
  }
}
