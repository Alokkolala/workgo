export function buildDisplayJobs(jobs, matchedJobs) {
  if (!matchedJobs) {
    return jobs
  }

  return matchedJobs.map((match) => ({
    ...match.job,
    _matchScore: match.score,
    _matchReason: match.reason,
  }))
}
