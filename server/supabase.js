import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

if (!process.env.SUPABASE_URL) throw new Error('Missing SUPABASE_URL')

const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
if (!key) throw new Error('Missing SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY')

export const supabase = createClient(process.env.SUPABASE_URL, key)
