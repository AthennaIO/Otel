/**
 * @athenna/otel
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export * from '#src/types'

export {
  BatchLogRecordProcessor,
  SimpleLogRecordProcessor,
  ConsoleLogRecordExporter
} from '@opentelemetry/sdk-logs'

export { Span } from '#src/annotations/Span'

export { Otel } from '#src/facades/Otel'
export { OtelImpl } from '#src/otel/OtelImpl'
export { OtelIgnite } from '#src/otel/OtelIgnite'
export { OtelProvider } from '#src/providers/OtelProvider'

export { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base'
export { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
export { getNodeAutoInstrumentations } from '#src/helpers/getNodeAutoInstrumentations'
export { OTLPLogExporter as HttpOTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
export { OTLPLogExporter as GrpcOTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc'
export { OTLPTraceExporter as HttpOTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
export { OTLPTraceExporter as GrpcOTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
export { OTLPMetricExporter as HttpOTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
export { OTLPMetricExporter as GrpcOTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc'
