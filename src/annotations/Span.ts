/**
 * @athenna/otel
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Otel } from '#src/facades/Otel'
import type { SpanOptions } from '#src/types/SpanOptions'

export function Span(options?: SpanOptions) {
  return (target: any, key: any, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value
    const className = target.constructor.name

    descriptor.value = function (this: any, ...args: any[]) {
      const spanName = options?.name || `${className}.${key}`

      return Otel.record(spanName, span => {
        if (options?.attributes) {
          span.setAttributes(options.attributes)
        }

        return originalMethod.apply(this, args)
      })
    }

    return descriptor
  }
}
