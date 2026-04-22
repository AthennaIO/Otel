import { Exception } from '@athenna/common'

export class NotFoundOtelConfigException extends Exception {
  public constructor(path: string) {
    super({
      code: 'E_NOT_FOUND_OTEL_CONFIG',
      message: `Failed to load opentelemetry config file at ${path}`,
      help: 'Please check if the file exists and has no syntax errors.'
    })
  }
}
