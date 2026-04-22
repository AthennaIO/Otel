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
}
