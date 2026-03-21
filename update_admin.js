import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dzgotqyikomtapcgdgff.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Z290cXlpa29tdGFwY2dkZ2ZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE3NTE0MywiZXhwIjoyMDg2NzUxMTQzfQ.6RE5VtzevwlIdomZoVgM9jvUGmrOQ54VVH1ZDHdpjN4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('Connecting to Supabase to find Admin user...');
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  
  const adminUser = users.users.find(u => u.email === 'evcarvalhodev@gmail.com');
  if (adminUser) {
    console.log('Found admin:', adminUser.id);
    const { error: updateError } = await supabase.from('profiles').update({ nivel: 5 }).eq('user_id', adminUser.id);
    if (updateError) {
      console.error('Error updating admin:', updateError);
    } else {
      console.log('Admin Successfully Promoted to Level 5!');
    }
  } else {
    console.log('Admin user not found! Ignoring.');
  }
}

main();
