export async function getGithubStars(): Promise<number | undefined> {
  try {
    const response = await fetch('https://api.github.com/repos/GussCloud/dolphin', {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 3600 }
    })
    if (!response.ok) {
      return undefined
    }
    const payload: { stargazers_count?: unknown } = await response.json()
    return typeof payload.stargazers_count === 'number' ? payload.stargazers_count : undefined
  } catch {
    return undefined
  }
}

export function formatStars(stars: number): string {
  return stars >= 1000 ? `${(stars / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(stars)
}
