import { Router } from 'express'

import { supabase } from '../supabase.js'

const router = Router()

router.get('/:businessId', async (req, res) => {
  const { data, error } = await supabase
    .from('messages')
    .select('id, role, content, created_at')
    .eq('business_id', req.params.businessId)
    .order('created_at', { ascending: true })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json({ messages: data || [] })
})

export default router
