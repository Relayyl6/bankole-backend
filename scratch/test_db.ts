import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkProofs() {
  const { data, error } = await supabase
    .from('proofs')
    .select('id, status, risk_level, confidence, verification_summary, checks')
    .order('uploaded_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching proofs:', error);
    return;
  }

  console.log('Recent proofs:', JSON.stringify(data, null, 2));
}

checkProofs();
