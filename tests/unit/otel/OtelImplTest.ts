/**
 * @athenna/otel
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { OtelImpl } from '#src/otel/OtelImpl'
import { context, propagation, trace, ROOT_CONTEXT } from '@opentelemetry/api'
import { Test, BeforeEach, AfterEach, type Context } from '@athenna/test'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { W3CTraceContextPropagator } from '@opentelemetry/core'

const otelCurrentContextBagKey = Symbol.for('athenna.otel.currentContextBag')

export default class OtelImplTest {
  @BeforeEach()
  public async beforeEach() {
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable())
    propagation.setGlobalPropagator(new W3CTraceContextPropagator())
  }

  @AfterEach()
  public async afterEach() {
    context.disable()
  }

  @Test()
  public async shouldBeAbleToCreateSetAndGetCustomContextValues({ assert }: Context) {
    const otel = new OtelImpl()
    const tenantIdKey = otel.createContextKey('tenant.id')
    const nextContext = otel.setContextValue(tenantIdKey, 'tenant-1')

    assert.isUndefined(otel.getContextValue(tenantIdKey))
    assert.equal(otel.getContextValue(tenantIdKey, nextContext), 'tenant-1')
  }

  @Test()
  public async shouldExposeTheContextBagSymbolGetter({ assert }: Context) {
    const otel = new OtelImpl()

    assert.equal(otel.contextBagSymbol, Symbol.for('athenna.otel.currentContextBag'))
  }

  @Test()
  public async shouldBeAbleToRunCallbacksWithCustomContextValues({ assert }: Context) {
    const otel = new OtelImpl()
    const tenantIdKey = otel.createContextKey('tenant.id')

    await otel.withContextValue(tenantIdKey, 'tenant-1', async () => {
      assert.equal(otel.getContextValue(tenantIdKey), 'tenant-1')

      await Promise.resolve()

      assert.equal(otel.getContextValue(tenantIdKey), 'tenant-1')
    })

    assert.isUndefined(otel.getContextValue(tenantIdKey))
  }

  @Test()
  public async shouldBeAbleToCreateContextWithBindingsAndMutableStore({ assert }: Context) {
    const otel = new OtelImpl()
    const tenantIdKey = otel.createContextKey('tenant.id')
    let values: any = {}

    await otel.withContext(
      async () => {
        otel.setCurrentContextValue('exampleId', 'example-id-from-controller')

        values = {
          tenantId: otel.getContextValue(tenantIdKey),
          exampleId: otel.getCurrentContextValue('exampleId'),
          currentBag: context.active().getValue(otelCurrentContextBagKey as any)
        }

        await Promise.resolve()

        values.exampleIdAfterAwait = otel.getCurrentContextValue('exampleId')
      },
      {
        bindings: [{ key: tenantIdKey, resolve: () => 'tenant-1' }]
      }
    )

    assert.equal(values.tenantId, 'tenant-1')
    assert.equal(values.exampleId, 'example-id-from-controller')
    assert.equal(values.exampleIdAfterAwait, 'example-id-from-controller')
    assert.instanceOf(values.currentBag, Map)
    assert.equal(values.currentBag.get(tenantIdKey), 'tenant-1')
  }

  @Test()
  public async shouldBeAbleToInjectAndExtractTraceContextFromCarrier({ assert }: Context) {
    const otel = new OtelImpl()
    const spanContext = {
      traceId: '1234567890abcdef1234567890abcdef',
      spanId: '1234567890abcdef',
      traceFlags: 1
    }
    const activeContext = trace.setSpanContext(ROOT_CONTEXT, spanContext)
    const carrier = otel.injectContext({}, activeContext)
    const extractedContext = otel.extractContext(carrier)
    const extractedSpanContext = trace.getSpanContext(extractedContext)

    assert.equal(carrier.traceparent, '00-1234567890abcdef1234567890abcdef-1234567890abcdef-01')
    assert.equal(extractedSpanContext?.traceId, spanContext.traceId)
    assert.equal(extractedSpanContext?.spanId, spanContext.spanId)
  }

  @Test()
  public async shouldBeAbleToRunCallbacksWithExtractedContext({ assert }: Context) {
    const otel = new OtelImpl()
    const spanContext = {
      traceId: 'abcdefabcdefabcdefabcdefabcdefab',
      spanId: 'abcdefabcdefabcd',
      traceFlags: 1
    }
    const carrier = otel.injectContext({}, trace.setSpanContext(ROOT_CONTEXT, spanContext))
    const tenantIdKey = otel.createContextKey('tenant.id')
    let values: Record<string, unknown> = {}

    await otel.withExtractedContext(
      carrier,
      async () => {
        values = {
          traceId: trace.getSpanContext(context.active())?.traceId,
          tenantId: otel.getContextValue(tenantIdKey)
        }
      },
      {
        bindings: [{ key: tenantIdKey, resolve: () => 'tenant-1' }]
      }
    )

    assert.equal(values.traceId, spanContext.traceId)
    assert.equal(values.tenantId, 'tenant-1')
  }

  @Test()
  public async shouldExposeTraceAndSpanIdsFromTheCurrentActiveSpan({ assert }: Context) {
    const otel = new OtelImpl()
    const spanContext = {
      traceId: 'fedcbafedcbafedcbafedcbafedcbafe',
      spanId: 'fedcbafedcbafedc',
      traceFlags: 1
    }
    const activeContext = trace.setSpanContext(ROOT_CONTEXT, spanContext)
    let values: Record<string, unknown> = {}

    context.with(activeContext, () => {
      values = {
        traceId: otel.getTraceId(),
        spanId: otel.getSpanId(),
        traceIdFromBag: otel.getCurrentContextValue('traceId'),
        spanIdFromBag: otel.getCurrentContextValue('spanId')
      }
    })

    assert.equal(values.traceId, spanContext.traceId)
    assert.equal(values.spanId, spanContext.spanId)
    assert.equal(values.traceIdFromBag, spanContext.traceId)
    assert.equal(values.spanIdFromBag, spanContext.spanId)
  }

  @Test()
  public async shouldReturnUndefinedTraceAndSpanIdsWhenThereIsNoActiveSpan({ assert }: Context) {
    const otel = new OtelImpl()

    assert.isUndefined(otel.getTraceId())
    assert.isUndefined(otel.getSpanId())
    assert.isUndefined(otel.getCurrentContextValue('traceId'))
    assert.isUndefined(otel.getCurrentContextValue('spanId'))
  }

  @Test()
  public async shouldBeAbleToMutateTheCurrentRequestContextStore({ assert }: Context) {
    const otel = new OtelImpl()
    const bag = new Map<string | symbol, unknown>()

    context.with(context.active().setValue(otelCurrentContextBagKey as any, bag), () => {
      otel.setCurrentContextValue('exampleId', 'example-id-from-controller')

      assert.equal(otel.getCurrentContextValue('exampleId'), 'example-id-from-controller')
      assert.equal(bag.get('exampleId'), 'example-id-from-controller')

      otel.setCurrentContextValues({ tenantId: 'tenant-1' })

      assert.equal(otel.getCurrentContextValue('tenantId'), 'tenant-1')
      assert.isTrue(otel.deleteCurrentContextValue('tenantId'))
      assert.isUndefined(otel.getCurrentContextValue('tenantId'))
    })
  }

  @Test()
  public async shouldBeAbleToCaptureAndRestoreCurrentContextValues({ assert }: Context) {
    const otel = new OtelImpl()
    let snapshot: Record<string, unknown> = {}

    await otel.withContext(async () => {
      otel.setCurrentContextValue('avatarId', 'avatar-1')
      otel.setCurrentContextValue('integrationId', 'integration-1')
      snapshot = otel.captureCurrentContextValues()
    })

    const restoredContext = otel.restoreCurrentContextValues(snapshot)

    context.with(restoredContext, () => {
      assert.equal(otel.getCurrentContextValue('avatarId'), 'avatar-1')
      assert.equal(otel.getCurrentContextValue('integrationId'), 'integration-1')
    })
  }

  @Test()
  public async shouldReturnEmptyValuesWhenCurrentRequestContextStoreIsMissing({ assert }: Context) {
    const otel = new OtelImpl()

    assert.isUndefined(otel.getCurrentContextValue('exampleId'))

    otel.setCurrentContextValue('exampleId', 'example-id-from-controller')

    assert.isUndefined(otel.getCurrentContextValue('exampleId'))
  }
}
