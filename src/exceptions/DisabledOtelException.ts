import { Exception } from '@athenna/common'

export class DisabledOtelException extends Exception {
  public constructor(message = 'OpenTelemetry is disabled') {
    super({
      code: 'E_DISABLED_OTEL',
      message,
      help: 'Please set ({yellow, bold} otel.enabled) to true in your ({yellow, bold} config/otel.ts) configuration file.'
    })
  }
}
