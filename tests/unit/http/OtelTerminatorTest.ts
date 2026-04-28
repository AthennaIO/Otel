/**
 * @athenna/otel
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Test, BeforeEach, AfterEach, type Context } from '@athenna/test'
import type { TerminateContext } from '@athenna/http'
import { OtelTerminator } from '#src/http/OtelTerminator'
import { OtelImpl } from '#src/otel/OtelImpl'
import { context, trace, ROOT_CONTEXT } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'

export default class OtelTerminatorTest {
  @BeforeEach()
  public async beforeEach() {
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable())
  }

  @AfterEach()
  public async afterEach() {
    context.disable()
  }

  @Test()
  public async shouldAddTheTraceparentHeaderToTheResponse({ assert }: Context) {
    const terminator = new OtelTerminator()
    const spanContext = {
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      traceFlags: 1
    }
    ioc.instance('Athenna/Core/Otel', new OtelImpl())
    const headers: Record<string, string> = {}
    const ctx = {
      status: 500,
      response: {
        hasHeader: (header: string) => header in headers,
        header: (header: string, value: string) => {
          headers[header] = value
          return ctx.response
        }
      }
    } as unknown as TerminateContext
    const activeContext = trace.setSpanContext(ROOT_CONTEXT, spanContext)

    await context.with(activeContext, () => terminator.terminate(ctx))

    assert.equal(headers.traceparent, '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')
  }

  @Test()
  public async shouldNotOverrideAnExistingTraceparentHeader({ assert }: Context) {
    const terminator = new OtelTerminator()
    const spanContext = {
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      traceFlags: 1
    }
    ioc.instance('Athenna/Core/Otel', new OtelImpl())
    const headers: Record<string, string> = {
      traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01'
    }
    const ctx = {
      status: 200,
      response: {
        hasHeader: (header: string) => header in headers,
        header: (header: string, value: string) => {
          headers[header] = value
          return ctx.response
        }
      }
    } as unknown as TerminateContext
    const activeContext = trace.setSpanContext(ROOT_CONTEXT, spanContext)

    await context.with(activeContext, () => terminator.terminate(ctx))

    assert.equal(headers.traceparent, '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01')
  }
}
