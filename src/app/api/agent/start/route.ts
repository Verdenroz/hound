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

    // Get or create user
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (!user) {
      const { data: newUser } = await supabase
        .from('users')
        .insert({
          auth0_sub: session.user.sub,
          email: userEmail,
          name: session.user.name,
        })
        .select()
        .single();
      user = newUser;
    }

    // Create agent session
    const { data: agentSession } = await supabase
      .from('agent_sessions')
      .insert({
        user_id: user!.id,
        status: 'active',
      })
      .select()
      .single();

    // Initialize agent executor
    const executor = new AgentExecutor(
      process.env.TAVILY_API_KEY!,
      process.env.GEMINI_API_KEY!,
      process.env.XRPL_WALLET_SEED,
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await executor.initialize(user!.id);
    await executor.start(user!.id, agentSession!.id);

    console.log(`✅ Agent started for user: ${userEmail}`);

    return NextResponse.json({
      success: true,
      message: 'Agent started',
      sessionId: agentSession!.id,
    });
  } catch (error: any) {
    console.error('Error starting agent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start agent' },
      { status: 500 }
    );
  }
}
