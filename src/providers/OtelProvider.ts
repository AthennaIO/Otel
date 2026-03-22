/**
 * @athenna/otel
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Otel } from '#src/facades/Otel'
import { OtelImpl } from '#src/otel/OtelImpl'
import { ServiceProvider } from '@athenna/ioc'
import { ExceptionHandler } from '@athenna/common'
import { SpanStatusCode } from '@opentelemetry/api'

export class OtelProvider extends ServiceProvider {
  public register() {
    this.container.singleton('Athenna/Core/Otel', OtelImpl)

    const originalReport = ExceptionHandler.prototype.handle

    ExceptionHandler.macro('handle', async ctx => {
      const span = Otel.getCurrentSpan()

      if (span) {
        span.recordException(ctx.error)
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: ctx?.error?.message
        })
      }

      return originalReport.call(this, ctx)
    })
  }

  public async shutdown() {
    const otel = this.container.use<OtelImpl>('Athenna/Core/Otel')

    if (!otel) {
      return
    }

    await otel.close()
  }
}
