/**
 * @athenna/otel
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import {
  type InstrumentationConfigMap,
  getNodeAutoInstrumentations as getNodeAutoInstrumentationsOriginal
} from '@opentelemetry/auto-instrumentations-node'

import { Options } from '@athenna/common'

export function getNodeAutoInstrumentations(
  instrumentations: InstrumentationConfigMap
) {
  instrumentations = Options.create(instrumentations, {
    '@opentelemetry/instrumentation-net': { enabled: false },
    '@opentelemetry/instrumentation-dns': { enabled: false },
    '@opentelemetry/instrumentation-socket.io': { enabled: false },
    '@opentelemetry/instrumentation-pg': { enabled: false },
    '@opentelemetry/instrumentation-mysql': { enabled: false },
    '@opentelemetry/instrumentation-mysql2': { enabled: false }
  })

  return getNodeAutoInstrumentationsOriginal(instrumentations)
}
