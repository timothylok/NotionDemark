export async function triggerDeploy(): Promise<void> {
  const url = process.env.VERCEL_DEPLOY_HOOK_URL
  if (!url) return
  await fetch(url, { method: 'POST' })
}
