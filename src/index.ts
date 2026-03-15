/**
 * @athenna/otel
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export * from '#src/types'

export { Span } from '#src/annotations/Span'

export { Otel } from '#src/facades/Otel'
export { OtelImpl } from '#src/otel/OtelImpl'
export { OtelIgnite } from '#src/otel/OtelIgnite'
export { OtelProvider } from '#src/providers/OtelProvider'

export { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base'
export { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
export { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
export { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc'
