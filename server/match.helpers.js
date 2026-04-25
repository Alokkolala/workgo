function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s,.-]/gi, ' ')
    .split(/[\s,./-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function unique(tokens) {
  return [...new Set(tokens)]
}

function stemsMatch(left, right) {
  if (left === right) return true
  if (left.length < 4 || right.length < 4) return false
  return left.startsWith(right.slice(0, 4)) || right.startsWith(left.slice(0, 4))
}

function findOverlap(sourceTokens, targetTokens) {
  return sourceTokens.filter((sourceToken) =>
    targetTokens.some((targetToken) => stemsMatch(sourceToken, targetToken))
  )
}

function collectJobTokens(job) {
  return unique(tokenize([
    job.title,
    job.description,
    job.requirements,
    job.businesses?.category,
    job.businesses?.name,
  ].join(' ')))
}

function collectApplicantTokens(applicant) {
  return unique(tokenize([
    applicant.skills,
    applicant.bio,
    applicant.experience,
  ].join(' ')))
}

function buildReason(parts) {
  return parts.join(' · ')
}

export function buildFallbackJobMatches(applicant, jobs) {
  const skillTokens = unique(tokenize(applicant.skills))
  const desiredDistrict = String(applicant.district || '').toLowerCase()

  return jobs
    .map((job) => {
      const jobTokens = collectJobTokens(job)
      const matchedSkills = findOverlap(skillTokens, jobTokens)
      const reasons = []
      let score = 35

      if (matchedSkills.length > 0) {
        score += Math.min(40, matchedSkills.length * 18)
        reasons.push(`подходит по навыкам: ${matchedSkills.slice(0, 2).join(', ')}`)
      }

      if (applicant.employment_type && job.employment_type === applicant.employment_type) {
        score += 15
        reasons.push('совпадает по типу занятости')
      }

      if (desiredDistrict && String(job.businesses?.address || '').toLowerCase().includes(desiredDistrict)) {
        score += 10
        reasons.push('подходит по району')
      }

      if (matchedSkills.length === 0) {
        return null
      }

      return {
        job_id: job.id,
        score: Math.min(99, score),
        reason: buildReason(reasons),
        job,
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
}

export function buildFallbackCandidateMatches(job, applicants) {
  const jobTokens = collectJobTokens(job)

  return applicants
    .map((applicant) => {
      const applicantTokens = collectApplicantTokens(applicant)
      const matchedTokens = findOverlap(applicantTokens, jobTokens)
      const reasons = []
      let score = 35

      if (matchedTokens.length > 0) {
        score += Math.min(40, matchedTokens.length * 18)
        reasons.push(`есть релевантные навыки: ${matchedTokens.slice(0, 2).join(', ')}`)
      }

      if (job.employment_type && applicant.employment_type === job.employment_type) {
        score += 15
        reasons.push('совпадает по типу занятости')
      }

      if (matchedTokens.length === 0) {
        return null
      }

      return {
        applicant_id: applicant.id,
        score: Math.min(99, score),
        reason: buildReason(reasons),
        applicant,
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
}
