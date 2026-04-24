/**
 * @athenna/otel
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import {
  trace,
  context,
  createContextKey,
  SpanStatusCode,
  type Span,
  type Context
} from '@opentelemetry/api'

import { Log } from '@athenna/logger'
import { Config } from '@athenna/config'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { Is, Options, Macroable } from '@athenna/common'
import { getRPCMetadata, RPCType } from '@opentelemetry/core'
import { DisabledOtelException } from '#src/exceptions/DisabledOtelException'
import { ContextNotInitializedException } from '#src/exceptions/ContextNotInitializedException'

const otelCurrentContextBagKey = Symbol.for('athenna.otel.currentContextBag')

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
   * Create a custom OpenTelemetry context key.
   *
   * @example
   * ```ts
   * const tenantIdKey = Otel.createContextKey('tenant.id')
   * ```
   */
  public createContextKey(name: string) {
    return createContextKey(name)
  }

  /**
   * Get a value from the provided OpenTelemetry context or the active one.
   *
   * @example
   * ```ts
   * const tenantId = Otel.getContextValue(tenantIdKey)
   * ```
   */
  public getContextValue<T = any>(
    key: string | symbol,
    ctx?: Context
  ): T | undefined {
    return (ctx || context.active()).getValue(key as any) as T | undefined
  }

  /**
   * Set a value in the provided OpenTelemetry context or the active one.
   *
   * @example
   * ```ts
   * const nextContext = Otel.setContextValue(tenantIdKey, 'tenant-1')
   * ```
   */
  public setContextValue<T = any>(
    key: string | symbol,
    value: T,
    ctx?: Context
  ) {
    return (ctx || context.active()).setValue(key as any, value)
  }

  /**
   * Run a callback with a custom value bound to the OpenTelemetry context.
   *
   * @example
   * ```ts
   * await Otel.withContextValue(tenantIdKey, 'tenant-1', async () => {
   *   console.log(Otel.getContextValue(tenantIdKey))
   * })
   * ```
   */
  public withContextValue<T = any, Result = any>(
    key: string | symbol,
    value: T,
    callback: () => Result,
    ctx?: Context
  ) {
    return context.with(this.setContextValue(key, value, ctx), callback)
  }

  /**
   * Create a derived OpenTelemetry context with bindings applied and the
   * mutable request-scoped store initialized.
   *
   * @example
   * ```ts
   * const nextContext = Otel.createContext({
   *   bindings: [{ key: tenantIdKey, resolve: () => 'tenant-1' }]
   * })
   * ```
   */
  public createContext(
    options: {
      ctx?: Context
      bindings?: {
        key: string | symbol
        resolve?: () => any
        includeIfUndefined?: boolean
      }[]
      resolveBinding?: (binding: {
        key: string | symbol
        resolve?: () => any
        includeIfUndefined?: boolean
      }) => any
    } = {}
  ) {
    let nextContext = options.ctx || context.active()
    const store = this.getOrCreateCurrentContextStore(nextContext)

    if (!nextContext.getValue(otelCurrentContextBagKey as any)) {
      nextContext = nextContext.setValue(otelCurrentContextBagKey as any, store)
    }

    for (const binding of options.bindings || []) {
      const value = options.resolveBinding
        ? options.resolveBinding(binding)
        : binding.resolve?.()

      if (Is.Undefined(value) && !binding.includeIfUndefined) {
        continue
      }

      store.set(binding.key, value)
      nextContext = nextContext.setValue(binding.key as any, value)
    }

    return nextContext
  }

  /**
   * Run a callback inside a derived OpenTelemetry context with bindings
   * applied and the mutable request-scoped store initialized.
   *
   * @example
   * ```ts
   * await Otel.withContext(async () => {
   *   console.log(Otel.getCurrentContextValue('tenantId'))
   * }, {
   *   bindings: [{ key: tenantIdKey, resolve: () => 'tenant-1' }]
   * })
   * ```
   */
  public withContext<Result = any>(
    callback: () => Result,
    options: {
      ctx?: Context
      bindings?: {
        key: string | symbol
        resolve?: () => any
        includeIfUndefined?: boolean
      }[]
      resolveBinding?: (binding: {
        key: string | symbol
        resolve?: () => any
        includeIfUndefined?: boolean
      }) => any
    } = {}
  ) {
    return context.with(this.createContext(options), callback)
  }

  /**
   * Get a value from the mutable request-scoped context store.
   *
   * @example
   * ```ts
   * const exampleId = Otel.getCurrentContextValue('exampleId')
   * ```
   */
  public getCurrentContextValue<T = any>(
    key: string | symbol,
    ctx?: Context
  ): T | undefined {
    return this.getCurrentContextStore(ctx).get(key) as T | undefined
  }

  /**
   * Set a value inside the mutable request-scoped context store.
   *
   * @example
   * ```ts
   * Otel.setCurrentContextValue('exampleId', 'example-id-from-controller')
   * ```
   */
  public setCurrentContextValue<T = any>(
    key: string | symbol,
    value: T,
    ctx?: Context
  ) {
    this.getCurrentContextStore(ctx).set(key, value)

    return this
  }

  /**
   * Delete a value from the mutable request-scoped context store.
   *
   * @example
   * ```ts
   * Otel.deleteCurrentContextValue('exampleId')
   * ```
   */
  public deleteCurrentContextValue(
    key: string | symbol,
    ctx?: Context
  ): boolean {
    return this.getCurrentContextStore(ctx).delete(key)
  }

  /**
   * Set multiple values inside the mutable request-scoped context store.
   *
   * @example
   * ```ts
   * Otel.setCurrentContextValues({ tenantId: 'tenant-1', requestId: 'req-1' })
   * ```
   */
  public setCurrentContextValues(
    values: Record<string | symbol, unknown>,
    ctx?: Context
  ) {
    const store = this.getCurrentContextStore(ctx)

    for (const key of Reflect.ownKeys(values)) {
      store.set(key as string | symbol, values[key as keyof typeof values])
    }

    return this
  }

  /**
   * Get the HTTP RPC metadata for the current active context.
   *
   * @example
   * ```ts
   * const httpRPCMetadata = Otel.getHttpRPCMetadata()
   * ```
   */
  public getHttpRPCMetadata() {
    const rpcMetadata = getRPCMetadata(this.context.active())

    if (rpcMetadata?.type !== RPCType.HTTP) {
      return null
    }

    return rpcMetadata
  }

  /**
   * Set the route for the HTTP RPC metadata for the current active context.
   *
   * @example
   * ```ts
   * Otel.setHttpRPCMetadataRoute('/api/v1/users')
   * ```
   */
  public setHttpRPCMetadataRoute(route: string) {
    const rpcMetadata = this.getHttpRPCMetadata()

    if (rpcMetadata && route) {
      rpcMetadata.route = route
    }
  }

  /**
   * Create the OpenTelemetry SDK instance based on configurations
   * set inside the config/otel.ts file.
   */
  private createSDK() {
    const options = Options.create(Config.get('otel.sdk'), {
      metricReaders: [],
      logRecordProcessors: []
    })

    return new NodeSDK(options)
  }

  /**
   * Return the mutable request-scoped context store from the active context.
   */
  private getCurrentContextStore(ctx?: Context) {
    if (Config.is('otel.enabled', false)) {
      throw new DisabledOtelException(
        'OpenTelemetry is disabled and a context could not be retrieved'
      )
    }

    const store = (ctx || context.active()).getValue(
      otelCurrentContextBagKey as any
    )

    if (!store || !(store instanceof Map)) {
      Log.channelOrVanilla('exception').error(new ContextNotInitializedException())

      return new Map<string | symbol, unknown>()
    }

    return store as Map<string | symbol, unknown>
  }

  /**
   * Return the current mutable store or create a new one for the provided
   * context when it does not exist yet.
   */
  private getOrCreateCurrentContextStore(ctx?: Context) {
    const store = (ctx || context.active()).getValue(
      otelCurrentContextBagKey as any
    )

    if (store instanceof Map) {
      return store as Map<string | symbol, unknown>
    }

    return new Map<string | symbol, unknown>()
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
