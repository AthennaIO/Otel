/**
 * @athenna/otel
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Otel } from '@athenna/otel'
import { Middleware } from '@athenna/http'
import type { Context, MiddlewareContract } from '@athenna/http'
import { ATTR_HTTP_ROUTE, ATTR_HTTP_REQUEST_METHOD } from '@opentelemetry/semantic-conventions';

@Middleware({ isGlobal: true })
export class OtelMiddleware implements MiddlewareContract {
  public async handle(ctx: Context) {
    const span = Otel.getCurrentSpan()

    if (span) {
      Otel.setHttpRPCMetadataRoute(ctx.request.routeUrl)

      span.updateName(`${ctx.request.method} ${ctx.request.routeUrl}`)

      span.setAttribute(ATTR_HTTP_ROUTE, ctx.request.routeUrl)
      span.setAttribute(ATTR_HTTP_REQUEST_METHOD, ctx.request.method)
    }
  }
}
