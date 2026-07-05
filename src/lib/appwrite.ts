import { Client, Account, ID, OAuthProvider } from 'appwrite'

const APPWRITE_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1'
const APPWRITE_PROJECT_ID = '6a498aae000bdc5c653d'

export const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)

export const account = new Account(client)

export async function signInWithEmail(email: string, password: string) {
  return account.createEmailPasswordSession(email, password)
}

export async function signUpWithEmail(name: string, email: string, password: string) {
  await account.create(ID.unique(), email, password, name)
  // Some Appwrite configs require email verification before session creation.
  // Try logging in; if it fails (e.g. verification required), the account is
  // still created and the user can verify then log in manually.
  try {
    return await account.createEmailPasswordSession(email, password)
  } catch {
    throw new Error(
      'Cuenta creada. Revisá tu correo para verificar la cuenta antes de iniciar sesión.',
    )
  }
}

export async function signOut() {
  return account.deleteSession('current')
}

export async function getCurrentUser() {
  try {
    const user = await account.get()
    return user
  } catch {
    return null
  }
}

export async function getOAuthUrl(provider: OAuthProvider, port: number): Promise<string> {
  const callbackUrl = `http://127.0.0.1:${port}/callback`
  const endpoint = APPWRITE_ENDPOINT
  const projectId = APPWRITE_PROJECT_ID
  return `${endpoint}/account/sessions/oauth2/${provider}?project=${projectId}&redirect=${encodeURIComponent(callbackUrl)}`
}

export async function completeOAuth(userId: string, secret: string) {
  return account.createSession(userId, secret)
}

export { OAuthProvider } from 'appwrite'
