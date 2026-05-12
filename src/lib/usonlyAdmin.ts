type UsOnlyAdminRequest = {
  path: string
  method?: string
  body?: unknown
}

function getUsOnlyBaseUrl(): string {
  return (process.env.USONLY_BASE_URL || '').replace(/\/+$/g, '')
}

function getUsOnlyAdminApiKey(): string {
  return process.env.USONLY_ADMIN_API_KEY || ''
}

export function isUsOnlyAdminConfigured(): boolean {
  return Boolean(getUsOnlyBaseUrl() && getUsOnlyAdminApiKey())
}

export async function requestUsOnlyAdmin({
  path,
  method = 'GET',
  body,
}: UsOnlyAdminRequest): Promise<Response> {
  const baseUrl = getUsOnlyBaseUrl()
  const apiKey = getUsOnlyAdminApiKey()

  if (!baseUrl || !apiKey) {
    return Response.json(
      { success: false, error: 'UsOnly admin integration is not configured' },
      { status: 500 }
    )
  }

  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-UsOnly-Admin-Key': apiKey,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
}
