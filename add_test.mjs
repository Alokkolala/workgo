import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://yjfwlgerugzgjebfwrnl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZndsZ2VydWd6Z2plYmZ3cm5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTYyOTMsImV4cCI6MjA5MjU5MjI5M30.GcPjlptE6LcDoz9iPJjMiu4RFADu8mTcLNIX4Eq1RH4'
)

const { data, error } = await supabase
  .from('businesses')
  .insert([{
    name: 'Test Business 2',
    phone: '87771767306',
    category: 'тестовое',
    address: 'Актау (Test 2)',
    status: 'DISCOVERED'
  }])
  .select()

if (error) {
  console.log('❌ Error:', error)
  process.exit(1)
} else {
  console.log('✅ Added successfully')
  process.exit(0)
}
