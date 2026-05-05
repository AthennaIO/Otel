/**
 * @athenna/otel
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { register } from 'node:module'
import { parse as semverParse } from 'semver'
import { isAbsolute, resolve } from 'node:path'
import { Config, EnvHelper, Rc } from '@athenna/config'
import { Options, Path, Module, File } from '@athenna/common'
import type { SemverNode, OtelIgniteOptions } from '#src/types'
import { createAddHookMessageChannel } from 'import-in-the-middle'

export class OtelIgnite {
  private parentURL: string
  private options: OtelIgniteOptions

  public setupHooks() {
    if (process.argv[2] === 'test') {
      return () => Promise.resolve()
    }

    const { registerOptions, waitForAllMessagesAcknowledged } =
      createAddHookMessageChannel()

    register(
      'import-in-the-middle/hook.mjs',
      this.parentURL,
      registerOptions as any
    )

    return waitForAllMessagesAcknowledged
  }

  public async load(parentURL: string, options?: OtelIgniteOptions) {
    this.parentURL = parentURL

    this.options = Options.create(options, {
      loadConfigSafe: true,
      athennaRcPath: './.athennarc.json'
    })

    this.setApplicationRootPath()

    this.options.envPath = this.resolvePath(this.options.envPath)
    this.options.athennaRcPath = this.resolvePath(this.options.athennaRcPath)

    this.setEnvVariablesFile()
    await this.setRcContentAndAppVars()

    Path.mergeDirs(Config.get('rc.directories', {}))

    this.setApplicationBeforePath()

    const waitForAllMessagesAcknowledged = this.setupHooks()

    await Config.safeLoad(Path.config(`otel.${Path.ext()}`))

    const { Otel } = await import('#src/facades/Otel')
    const { OtelProvider } = await import('#src/providers/OtelProvider')

    new OtelProvider().register()

    if (!Otel.isEnabled()) {
      return
    }

    Otel.start()

    await waitForAllMessagesAcknowledged()
  }

  /**
   * Resolve some relative path from the root of the project.
   */
  private resolvePath(path: string): string {
    if (!path) {
      return path
    }

    if (!isAbsolute(path)) {
      return resolve(Path.pwd(), path)
    }

    return path
  }

  /**
   * Parse some version string to the SemverNode type.
   */
  private parseVersion(version: string): SemverNode {
    const parsed = semverParse(version)

    if (!parsed) {
      return {
        major: null,
        minor: null,
        patch: null,
        prerelease: [],
        version: null,
        toString() {
          return this.version
        }
      }
    }

    return {
      major: parsed.major,
      minor: parsed.minor,
      patch: parsed.patch,
      prerelease: parsed.prerelease.map(release => release),
      version: parsed.version,
      toString() {
        return this.version
      }
    }
  }

  /**
   * Load all the content of the .athennarc.json or athenna property of
   * package json inside the "rc" config. .athennarc.json file will always
   * be the priority, but if it does not exist, Athenna will try to use
   * the "athenna" property of package.json. Also, set app name, app version
   * and athenna version variables in env.
   *
   * @example
   * ```ts
   * Config.get('rc.providers')
   * ```
   */
  public async setRcContentAndAppVars() {
    const file = new File(this.options.athennaRcPath, '')
    const pkgJson = await new File(Path.pwd('package.json')).getContentAsJson()
    const __dirname = Module.createDirname(import.meta.url)
    const corePkgJson = await new File(
      resolve(__dirname, '..', '..', 'package.json')
    ).getContentAsJson()
    const coreSemverVersion = this.parseVersion(corePkgJson.version)

    process.env.APP_NAME = process.env.APP_NAME || pkgJson.name
    process.env.APP_VERSION =
      process.env.APP_VERSION || this.parseVersion(pkgJson.version).toString()
    process.env.ATHENNA_VERSION = `Athenna Framework v${coreSemverVersion.toString()}`

    const athennaRc = {
      parentURL: this.parentURL,
      typescript: Env('IS_TS', false),
      version: process.env.APP_VERSION,
      athennaVersion: process.env.ATHENNA_VERSION,
      engines: pkgJson.engines || {},
      ignoreDirsBeforePath: ['nodeModules', 'nodeModulesBin'],
      commands: {},
      directories: {},
      services: [],
      preloads: [],
      providers: [],
      controllers: [],
      middlewares: [],
      namedMiddlewares: {},
      globalMiddlewares: [],
      environments: []
    }

    if (file.fileExists) {
      Config.set('rc', {
        ...athennaRc,
        ...file.getContentAsJsonSync(),
        ...Config.get('rc', {})
      })

      this.options.athennaRcPath = file.path

      await Rc.setFile(this.options.athennaRcPath)

      return
    }

    if (!pkgJson.athenna) {
      Config.set('rc', {
        ...athennaRc,
        ...Config.get('rc', {})
      })

      this.options.athennaRcPath = null

      return
    }

    this.options.athennaRcPath = Path.pwd('package.json')

    Config.set('rc', {
      ...athennaRc,
      ...pkgJson.athenna,
      ...Config.get('rc', {})
    })

    await Rc.setFile(this.options.athennaRcPath)
  }

  /**
   * Set the env file that the application will use. The env file path will be
   * automatically resolved by Athenna (using the NODE_ENV variable) if any
   * path is set.
   *
   * In case path is empty:
   * If NODE_ENV variable it's already set the .env.${NODE_ENV} file will be used.
   * If not, Athenna will read the .env file and try to find the NODE_ENV value and
   * then load the environment variables inside the .env.${NODE_ENV} file. If any
   * NODE_ENV value is found in .env or .env.${NODE_ENV} file does not exist, Athenna
   * will use the .env file.
   */
  public setEnvVariablesFile(): void {
    if (this.options.envPath) {
      return EnvHelper.resolveFilePath(this.options.envPath)
    }

    EnvHelper.resolveFile(true)
  }

  /**
   * Set the application chdir, change the process.cwd method to return the
   * root path where the application root is stored. Also resolve the environment
   * where the application is running (JavaScript or TypeScript).
   *
   * This method will determine if the application is using TypeScript by the meta url.
   *
   * Let's check this example when application is running in TypeScript environment:
   *
   * @example
   * ```ts
   * this.setApplicationRootPath()
   *
   * console.log(Path.ext()) // ts
   * console.log(Path.pwd()) // /Users/jlenon7/Development/Athenna/AthennaIO
   * console.log(Path.config(`app.${Path.ext()}`)) // /Users/jlenon7/Development/Athenna/AthennaIO/config/app.ts
   * ```
   */
  public setApplicationRootPath(): void {
    if (!Config.exists('rc.callPath')) {
      Config.set('rc.callPath', process.cwd())
    }

    const __dirname = Module.createDirname(import.meta.url)

    process.chdir(resolve(__dirname, '..', '..', '..', '..', '..'))

    /**
     * If env IS_TS is already set, then we cant change it.
     */
    if (Env('IS_TS') === undefined) {
      if (this.parentURL.endsWith('.ts')) {
        process.env.IS_TS = 'true'
      } else {
        process.env.IS_TS = 'false'
      }
    }
  }

  /**
   * Set the application before path, in all directories of Path class unless
   * the nodeModules and nodeModulesBin directories.
   *
   * @example
   * ```ts
   * this.setApplicationBeforePath()
   *
   * console.log(Path.config(`app.${Path.ext()}`)) // /Users/jlenon7/Development/Athenna/AthennaIO/config/build/app.ts
   * ```
   */
  public setApplicationBeforePath(): void {
    if (Env('IS_TS') || !this.options.beforePath) {
      return
    }

    Object.keys(Path.dirs).forEach(dir => {
      const ignoreDirs = Config.get('rc.ignoreDirsBeforePath')

      if (ignoreDirs.includes(dir)) {
        return
      }

      Path.dirs[dir] = this.options.beforePath + '/' + Path.dirs[dir]
    })
  }
}
