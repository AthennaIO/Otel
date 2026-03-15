/**
 * @athenna/otel
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export interface SpanOptions {
  /**
   * Custom span name.
   * 
   * @default `${target.constructor.name}.${property}`
   */
  name?: string

  /**
   * Additional attributes to add to the span.
   */
  attributes?: Record<string, string | number | boolean>
}
