/**
 * @athenna/otel
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Facade } from '@athenna/ioc'
import { OtelImpl } from '#src/otel/OtelImpl'

export const Otel = Facade.createFor<OtelImpl>('Athenna/Core/Otel')
