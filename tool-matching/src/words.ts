import type { Way } from '@toolpath/tool-matching/feature-map'
import { diameter, length, type Units } from '@toolpath/tool-matching/format'
import type { Reason } from '@toolpath/tool-matching/solution'

/*
  The few words this page needs that the package leaves to an app. Everything else on the page,
  such as tool names and specs, feature names and why nothing fits, is the package's own text
  (`@toolpath/tool-matching/text`).
*/

/** How a step makes its feature, as the card's label says it. */
export const WAY_LABEL: Record<Way, string> = {
  drill: 'Drill',
  helical: 'Helical mill',
  mill: 'Mill',
  finish: 'Finish',
  chamfer: 'Chamfer',
  'tap-drill': 'Tap drill',
  'tap-mill': 'Mill tap hole',
  tap: 'Tap',
}

/** Each step's badge colour: holes in blue, milling in dark grey, taps in green, chamfers in grey. */
export const WAY_VARIANT: Record<Way, 'info' | 'default' | 'success' | 'secondary'> = {
  drill: 'info',
  'tap-drill': 'info',
  helical: 'info',
  mill: 'default',
  finish: 'default',
  chamfer: 'secondary',
  'tap-mill': 'success',
  tap: 'success',
}

/**
 * Why matching picked an assembly, in a few words. Matching returns its reasons as data
 * (`Solution.reasons`) so an app writes them in its own voice and units; these are this page's.
 */
export const reasonText = (reason: Reason, units: Units): string | null => {
  switch (reason.kind) {
    case 'nominal':
      return `${diameter(reason.drill, units)} drill for a ${diameter(reason.hole, units)} hole`
    case 'thread':
      return `Cuts ${reason.thread}`
    case 'engagement':
      return `${reason.percent}% thread for ${reason.thread}`
    case 'point':
      return reason.angle === null ? null : `${reason.angle}° point`
    case 'flute':
      return `Cuts ${length(reason.depth, units)} deep${reason.shortest ? ', the shortest that does' : ''}`
    case 'reach':
      return `Reaches ${length(reason.depth, units)}${reason.shortest ? ', the shortest that does' : ''}`
    case 'widest':
      return reason.widest ? 'The widest end mill that fits' : null
    case 'cone':
      return `${reason.pointAngle}° cone spans the chamfer`
    case 'corner':
      return reason.rule === 'sharp'
        ? 'Leaves a sharp corner'
        : `${length(reason.radius, units)} corner for a ${length(reason.bound, units)} fillet`
    case 'flutes':
      return reason.preferred ? `${reason.flutes} flutes suit the material` : null
    case 'collet':
    case 'clamp':
    case 'holder':
      // The card names the holder and collet itself.
      return null
  }
}
