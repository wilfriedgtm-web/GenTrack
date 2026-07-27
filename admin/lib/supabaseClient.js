import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zbpoxjlkqxnqjzxohasq.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpicG94amxrcXhucWp6eG9oYXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MjM3ODAsImV4cCI6MjA5NzA5OTc4MH0.9-QyWgon93jGDo5QKMIh_-QbQZ_P9rQrYJnVxegJe7M';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
