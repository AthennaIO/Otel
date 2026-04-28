/**
 * @athenna/otel
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Otel } from '@athenna/otel'
import { Terminator } from '@athenna/http'
import type { TerminateContext, TerminatorContract } from '@athenna/http'
import { ATTR_HTTP_RESPONSE_STATUS_CODE } from '@opentelemetry/semantic-conventions'

@Terminator({ isGlobal: true })
export class OtelTerminator implements TerminatorContract {
  public async terminate(ctx: TerminateContext) {
    const span = Otel.getCurrentSpan()

    if (span) {
      const traceparent = Otel.injectContext({}).traceparent

      span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, ctx.status)

      if (traceparent && !ctx.response.hasHeader('traceparent')) {
        ctx.response.header('traceparent', traceparent)
      }
    }
  }
}
