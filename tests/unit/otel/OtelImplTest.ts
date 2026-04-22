/**
 * @athenna/otel
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { OtelImpl } from '#src/otel/OtelImpl'
import { context } from '@opentelemetry/api'
import { Test, BeforeEach, AfterEach, type Context } from '@athenna/test'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'

const otelCurrentContextBagKey = Symbol.for('athenna.otel.currentContextBag')

export default class OtelImplTest {
  @BeforeEach()
  public async beforeEach() {
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable())
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
  public async shouldThrowAClearErrorWhenCurrentRequestContextStoreIsMissing({ assert }: Context) {
    const otel = new OtelImpl()

    assert.throws(() => otel.getCurrentContextValue('exampleId'), 'Current request context store is not initialized')
    assert.throws(
      () => otel.setCurrentContextValue('exampleId', 'example-id-from-controller'),
      'Current request context store is not initialized'
    )
  }
}
