import createError from 'http-errors'

import { gatherBasicBuilderData } from '@liquid-labs/catalyst-lib-build'
import { httpSmartResponse } from '@liquid-labs/http-smart-response'

import { setupCoverage } from './lib/setup-coverage'
import { setupPassing } from './lib/setup-passing'
import { updateReadme } from './lib/update-readme'

const defaultPassingBadges = ['unit-tests']

const help = {
  name        : 'Setup project badges',
  summary     : 'Sets up badges and inserts them into the README..',
  description : ''
}

const method = 'put'
const path = ['badges', 'coverage', 'add']
const parameters = [
  {
    name      : 'noCoverage',
    isBoolean : true,
    summary   : 'Suppresses generation of the coverage badge.'
  },
  {
    name      : 'noPassing',
    isBoolean : true,
    summary   : 'Suppresses generation of passing badges.'
  },
  {
    name         : 'passingBadges',
    isMultivalue : true,
    summary      : `Lists the workflow badges to create if present. Defaults to [ '${defaultPassingBadges.join("', '")}' ]. If \`requirePassingBadges\` is true, then this will instead result in an error if no matching workflow found. Use \`noPassing\` to supress generation of passing badges entirely.`
  },
  {
    name      : 'requirePassingBadges',
    isBoolean : true,
    summary   : 'If a any `passingBadges` not found, then an exception is raised.'
  }
]

const func = ({ app, reporter }) => async(req, res) => {
  reporter.isolate()

  const { noCoverage, noPassing, passingBadges = defaultPassingBadges, requirePassingBadges } = req.vars

  const { builderName, builderVersion, workingPkgRoot } = gatherBasicBuilderData({ builderPkgDir: __dirname, req})

  const builders = []

  if (noCoverage !== true) {
    builders.push(setupCoverage({ workingPkgRoot, myName, myVersion }))
  }
  if (noPassing !== true) {
    builders.push(setupPassing({ workingPkgRoot, myName, myVersion, passingBadges, requirePassingBadges }))
  }

  const results = await Promise.all(builders)

  const badgeLines = []
  const dependencyIndex = {}
  const scripts = []

  for (const result of results) {
    badgeLines.push(result.badgeLine)
    for (const dep of result.dependencies || []) {
      dependencyIndex[dep] = true
    }
    scripts.push(...(result.scripts || []))
  }

  const badgesLine = badgeLines.join(' ')
  const readmePromise = updateReadme({ workingPkgRoot, badgesLine })

  const data = {
    dependencies : Object.keys(dependencyIndex).sort(),
    scripts      : scripts.sort((a, b) => {
      if (a.priority < b.priority) return -1
      else if (a.priority > b.priority) return 1
      else return 0
    })
  }

  const msg = `Created ${1} badge.`

  await readmePromise

  httpSmartResponse({ msg, data, req, res })
}

export { help, func, method, parameters, path }
