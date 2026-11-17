import { paletteRole } from './fusion/bridge'

// One build serves both palettes. The hidden worker loads no React and no CSS.
if (paletteRole() === 'worker') {
  void import('./worker/start-worker').then(({ startWorker }) => startWorker())
} else {
  void import('./main-palette').then(({ renderMainPalette }) =>
    renderMainPalette(document.getElementById('root')!),
  )
}
