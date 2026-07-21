import { invoke } from '@tauri-apps/api/core'

export function invokeWithTimeout<T>(cmd: string, args: Record<string, unknown> = {}, ms = 4000): Promise<T> {
  return Promise.race([
    invoke<T>(cmd, args),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`invoke timeout: ${cmd}`)), ms)
    ),
  ])
}
