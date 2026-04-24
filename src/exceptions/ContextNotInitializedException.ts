import { Exception } from '@athenna/common'

export class ContextNotInitializedException extends Exception {
  public constructor(
    message = 'Current request context store is not initialized'
  ) {
    super({
      code: 'E_CONTEXT_NOT_INITIALIZED',
      message,
      help: 'Use Otel.withContext(() => { ... }) to initialize the context store.'
    })
  }
}
