type UsOnlyAdminRequest = {
  baseUrl: string | null
  path: string
  method?: string
  body?: unknown
}

function normalizeBaseUrl(baseUrl: string | null): string {
  const cleaned = (baseUrl || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/g, '')
  return cleaned ? `https://${cleaned}` : ''
}

function getUsOnlyAdminApiKey(): string {
  return process.env.USONLY_ADMIN_API_KEY || ''
}

export async function requestUsOnlyAdmin({
  baseUrl,
  path,
  method = 'GET',
  body,
}: UsOnlyAdminRequest): Promise<Response> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const apiKey = getUsOnlyAdminApiKey()

  if (!normalizedBaseUrl || !apiKey) {
    return Response.json(
      { success: false, error: 'UsOnly admin integration is not configured' },
      { status: 500 }
    )
  }

  return fetch(`${normalizedBaseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-UsOnly-Admin-Key': apiKey,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
}
