let accessTokenMemory: string | null = null;

export function getAccessTokenMemory(): string | null {
  return accessTokenMemory;
}

export function setAccessTokenMemory(token: string | null): void {
  accessTokenMemory = token;
}
