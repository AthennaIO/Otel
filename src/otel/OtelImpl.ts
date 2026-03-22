/**
 * @athenna/otel
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Config } from '@athenna/config'
import { Macroable } from '@athenna/common'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { trace, context, SpanStatusCode, type Span } from '@opentelemetry/api'

export class OtelImpl extends Macroable {
  /**
   * Holds the OpenTelemetry SDK instance.
   */
  private sdk: NodeSDK

  public constructor() {
    super()
    this.sdk = this.createSDK()
  }

  /**
   * Verify if the OpenTelemetry is enabled.
   *
   * @example
   * ```ts
   * if (Otel.isEnabled()) {
   *   console.log('OpenTelemetry is enabled')
   * }
   * ```
   */
  public isEnabled() {
    return Config.is('otel.enabled', true)
  }

  /**
   * Start the OpenTelemetry SDK instance. Will only start if the
   * OpenTelemetry is enabled in the `config/otel.ts` file.
   *
   * @example
   * ```ts
   * Otel.start()
   * ```
   */
  public start() {
    if (!this.isEnabled()) {
      return this
    }

    this.sdk.start()

    return this
  }

  /**
   * Gracefully shutdown the OpenTelemetry SDK instance.
   *
   * @example
   * ```ts
   * await Otel.close()
   * ```
   */
  public async close() {
    await this.sdk.shutdown()
  }

  /**
   * Automatically start a span and end it after the closure is executed.
   *
   * @example
   * ```ts
   * Otel.record('my.operation', () => {
   *   console.log('my operation')
   * })
   *
   * Otel.record('my.operation', () => {
   *   console.log('my operation')
   * })
   * ```
   */
  public record<T>(name: string, closure: (span: Span) => T): T {
    const tracer = trace.getTracer('@athenna/otel')

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return tracer.startActiveSpan(name, span => {
      try {
        const result = closure(span)

        if (result instanceof Promise) {
          return result
            .then(value => {
              span.end()

              return value
            })
            .catch(error => {
              throw this.handleRecordError(error, span)
            })
        }

        span.end()

        return result as T
      } catch (error) {
        throw this.handleRecordError(error, span)
      }
    })
  }

  /**
   * Get the current span from the context. Will return `undefined` if no
   * span is active.
   *
   * @example
   * ```ts
   * const span = Otel.getCurrentSpan()
   *
   * span?.setAttributes({ 'hello': 'world' })
   * ```
   */
  public getCurrentSpan() {
    return trace.getActiveSpan()
  }

  /**
   * Get the trace API from the OpenTelemetry SDK.
   *
   * @example
   * ```ts
   * const span = Otel.trace.getSpan(Otel.context.active())
   * ```
   */
  public get trace() {
    return trace
  }

  /**
   * Get the current context from the context. Will return `undefined` if no
   * context is active.
   *
   * @example
   * ```ts
   * const currentActiveContext = Otel.context.active()
   * ```
   */
  public get context() {
    return context
  }

  /**
   * Create the OpenTelemetry SDK instance based on configurations
   * set inside the config/otel.ts file.
   */
  private createSDK() {
    return new NodeSDK(Config.get('otel.sdk'))
  }

  /**
   * Handle the error that occurs when recording a span.
   */
  private handleRecordError(error: any, span: Span) {
    span.recordException(error)
    span.setStatus({ code: SpanStatusCode.ERROR, message: error?.message })
    span.end()

    return error
  }
}
