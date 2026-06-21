export async function triggerDeploy(): Promise<'fired' | 'no-url'> {
  const url = process.env.VERCEL_DEPLOY_HOOK_URL
  if (!url) return 'no-url'
  await fetch(url, { method: 'POST' })
  return 'fired'
}
