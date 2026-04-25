import test from 'node:test'
import assert from 'node:assert/strict'

import { buildFallbackCandidateMatches, buildFallbackJobMatches } from './match.helpers.js'

test('buildFallbackJobMatches ranks jobs by matching skills and preferences', () => {
  const applicant = {
    skills: 'касса, продажи, гости',
    employment_type: 'full',
    district: '11 мкр',
  }

  const jobs = [
    {
      id: 'job-1',
      title: 'Кассир',
      description: 'Работа с клиентами и кассой',
      requirements: 'Опыт продаж и общения с гостями',
      employment_type: 'full',
      businesses: { name: 'Market', address: 'Актау, 11 мкр' },
    },
    {
      id: 'job-2',
      title: 'Автомеханик',
      description: 'Ремонт авто',
      requirements: 'СТО, инструменты',
      employment_type: 'part',
      businesses: { name: 'Service', address: 'Актау, 3 мкр' },
    },
  ]

  const matches = buildFallbackJobMatches(applicant, jobs)

  assert.equal(matches[0].job_id, 'job-1')
  assert.equal(matches[0].job.id, 'job-1')
  assert.ok(matches[0].score >= 70)
  assert.match(matches[0].reason, /навык|район|тип/i)
  assert.equal(matches.some((match) => match.job_id === 'job-2'), false)
})

test('buildFallbackCandidateMatches ranks applicants by job keyword overlap', () => {
  const job = {
    id: 'job-1',
    title: 'Бариста',
    description: 'Работа с гостями и кофе',
    requirements: 'Касса, сменный график',
    employment_type: 'full',
  }

  const applicants = [
    {
      id: 'app-1',
      name: 'A',
      skills: 'кофе, касса, гости',
      bio: 'Люблю работу в кофейне',
      employment_type: 'full',
      district: '11 мкр',
    },
    {
      id: 'app-2',
      name: 'B',
      skills: 'сварка, ремонт',
      bio: 'СТО',
      employment_type: 'gig',
      district: '3 мкр',
    },
  ]

  const matches = buildFallbackCandidateMatches(job, applicants)

  assert.equal(matches[0].applicant_id, 'app-1')
  assert.equal(matches[0].applicant.id, 'app-1')
  assert.ok(matches[0].score >= 70)
  assert.match(matches[0].reason, /навык|тип/i)
  assert.equal(matches.some((match) => match.applicant_id === 'app-2'), false)
})
