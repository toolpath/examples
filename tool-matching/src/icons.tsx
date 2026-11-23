import { RulerIcon } from '@phosphor-icons/react'
import type { Tool } from '@toolpath/tool-support'
import type { FC, ReactNode } from 'react'

/*
  The Toolpath app's own tool and measurement icons (`packages/ui/src/icons` in the app), so a
  drill or an end mill reads here as it does there. Filled, 16 × 16, in `currentColor`. The app
  has no tap, so the tap is drawn to match: the drill's shank over a threaded body.
*/

type IconProps = { className?: string }

const Svg: FC<IconProps & { children: ReactNode }> = ({ className, children }) => (
  <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
    {children}
  </svg>
)

export const DrillIcon: FC<IconProps> = ({ className }) => (
  <Svg className={className}>
    <path d="M6.23271 10.2027V8.51556L9.76589 7.38455V9.03822L6.23271 10.2027ZM6.23271 7.53599V5.8489L9.76589 4.71788V6.37156L6.23271 7.53599ZM9.10309 0.90918H6.89692C6.53028 0.91027 6.23333 1.20722 6.23224 1.57386V4.67971L9.76777 3.54591L9.74892 1.555C9.73807 1.20292 9.45518 0.920025 9.10309 0.90918ZM6.23224 13.371L8.00001 15.1387L9.76777 13.371L9.77249 10.084L6.23695 11.2453L6.23224 13.371Z" />
  </Svg>
)

export const EndmillIcon: FC<IconProps> = ({ className }) => (
  <Svg className={className}>
    <path d="M10.8003 14.5332C10.8003 14.9014 10.5014 15.2001 10.1333 15.2002H6.37061C7.38795 14.7659 8.49193 14.0807 9.46338 13.0283C10.0138 12.4321 10.4514 11.7619 10.8003 11.0762V14.5332ZM10.6665 5.33301C10.7401 5.33301 10.8003 5.39316 10.8003 5.4668V7.78125C10.7316 8.1288 10.6438 8.49993 10.5298 8.88086C10.1752 10.0652 9.59205 11.3167 8.68018 12.3047C7.56903 13.5084 6.26198 14.1646 5.19971 14.498V9.79785C6.17138 9.36085 7.21016 8.69219 8.13037 7.69531C8.79026 6.98043 9.29038 6.1602 9.6665 5.33301H10.6665ZM8.48096 5.33301C8.17675 5.91759 7.80231 6.47756 7.34619 6.97168C6.67021 7.70394 5.92117 8.23228 5.19971 8.61035V5.4668C5.19971 5.39316 5.25986 5.33301 5.3335 5.33301H8.48096Z" />
    <path d="M13.6582 3.11035C13.3572 3.96304 12.5507 4.53301 11.6465 4.5332H4.35645C3.45209 4.5332 2.64587 3.96307 2.34473 3.11035L1.59961 1H3.29688L3.85352 2.57715C3.92877 2.79038 4.13032 2.93359 4.35645 2.93359H11.6465C11.8724 2.9334 12.0742 2.79024 12.1494 2.57715L12.7061 1H14.4033L13.6582 3.11035Z" />
  </Svg>
)

export const ChamferMillIcon: FC<IconProps> = ({ className }) => (
  <Svg className={className}>
    <path d="M12 10.1455C12 10.1949 11.9813 10.2426 11.9482 10.2793L8.14844 14.502C8.06905 14.5897 7.93095 14.5897 7.85156 14.502L6.76855 13.2979C7.21986 12.3745 7.80812 11.479 8.54688 10.8193C9.33117 10.1193 10.6642 9.66745 12 9.41113V10.1455ZM9.29688 9.06641C8.74377 9.30992 8.2362 9.60749 7.82812 9.97168C7.06137 10.6562 6.4542 11.536 5.98535 12.4287L4.05176 10.2793C4.01871 10.2426 4.00001 10.1949 4 10.1455V9.06641H9.29688ZM11.7998 1.33301C11.9102 1.33301 11.9999 1.42281 12 1.5332V8H4V1.5332C4.00007 1.42281 4.08978 1.33301 4.2002 1.33301H11.7998Z" />
  </Svg>
)

/** Drawn for this page: a shank, then five thread crests narrowing to a short lead. */
export const TapIcon: FC<IconProps> = ({ className }) => (
  <Svg className={className}>
    <path d="M6.9 0.9h2.2c.37 0 .67.3.67.67V5.2H6.23V1.57c0-.37.3-.67.67-.67Z" />
    <path d="M5.5 6h5l-.6 1.2h-3.8Zm0 2h5l-.6 1.2h-3.8Zm0 2h5l-.6 1.2h-3.8Zm.25 2h4.5l-.8 1.2h-2.9Zm.75 2h3l-1.5 1.1Z" />
  </Svg>
)

/**
 * Drawn for this page: an ER collet side-on, its double taper split down the middle into two jaws.
 * One straight cut through the whole height, so both halves keep a clean outline at 16 px.
 */
export const ColletIcon: FC<IconProps> = ({ className }) => (
  <Svg className={className}>
    <path d="M4.6 1h2.6v14H6.2L2.6 4.6Zm4.2 0h2.6l2 3.6L9.8 15h-1Z" />
  </Svg>
)

/** A diameter: a shank, or a hole. */
export const DiameterIcon: FC<IconProps> = ({ className }) => (
  <Svg className={className}>
    <path d="M13.3578 4.06201C14.1698 5.16468 14.6508 6.52617 14.6508 8.00049C14.6508 11.6732 11.6731 14.6509 8.0004 14.6509C6.52608 14.6509 5.16459 14.1699 4.06192 13.3579L5.35489 12.0649C6.11575 12.5612 7.02418 12.8501 8.0004 12.8501C10.679 12.8501 12.85 10.6791 12.85 8.00049C12.85 7.02427 12.5611 6.11584 12.0648 5.35498L13.3578 4.06201Z" />
    <path d="M8.0004 1.3501C9.72968 1.3501 11.3049 2.01027 12.4877 3.09229L11.2123 4.36768C10.3569 3.61079 9.23256 3.15088 8.0004 3.15088C5.32182 3.15088 3.15079 5.32191 3.15079 8.00049C3.15079 9.23265 3.6107 10.357 4.36758 11.2124L3.09219 12.4878C2.01018 11.305 1.35001 9.72977 1.35001 8.00049C1.35001 4.32779 4.3277 1.3501 8.0004 1.3501Z" />
  </Svg>
)

export const FlutesIcon: FC<IconProps> = ({ className }) => (
  <Svg className={className}>
    <path d="M3.23145 7.02344C3.16718 7.33893 3.13379 7.66553 3.13379 8C3.13379 10.1497 4.52777 11.972 6.46094 12.6162L5.8916 14.3242C3.24334 13.4417 1.33301 10.9448 1.33301 8C1.33301 7.54216 1.37889 7.09497 1.4668 6.66309L3.23145 7.02344Z" />
    <path d="M14.5322 6.66309C14.6202 7.09503 14.667 7.54209 14.667 8C14.667 10.9452 12.7561 13.442 10.1074 14.3242L9.53809 12.6162C11.4717 11.9723 12.8662 10.15 12.8662 8C12.8662 7.66546 12.8319 7.33899 12.7676 7.02344L14.5322 6.66309Z" />
    <path d="M8 1.33301C9.69705 1.33301 11.245 1.96851 12.4219 3.0127L11.2275 4.3584C10.3686 3.59653 9.23852 3.13379 8 3.13379C6.76122 3.13379 5.63053 3.59624 4.77148 4.3584L3.57715 3.0127C4.75406 1.96822 6.30269 1.33301 8 1.33301Z" />
  </Svg>
)

export const LengthOfCutIcon: FC<IconProps> = ({ className }) => (
  <Svg className={className}>
    <path d="M12.2666 13.3663C12.2666 13.6424 12.0427 13.8663 11.7666 13.8663H8.27833C9.44255 13.4367 10.7074 12.7617 11.8242 11.7247C11.979 11.581 12.1263 11.4321 12.2666 11.2804V13.3663Z" />
    <path d="M12.167 4.00008C12.2219 4.00026 12.2664 4.04475 12.2666 4.09969V9.54989C11.9432 10.0429 11.5575 10.5164 11.0986 10.9425C9.67849 12.2612 7.98028 12.9322 6.667 13.2403V9.38778C7.59004 9.04752 8.67377 8.4181 9.64356 7.33309H10.833C10.8882 7.33309 10.9336 7.28868 10.9336 7.23348V4.00008H12.167Z" />
    <path d="M8.00001 7.42391C7.5445 7.78521 7.08776 8.04733 6.667 8.23641V4.09969C6.66721 4.04466 6.71154 4.00012 6.76661 4.00008H8.00001V7.42391Z" />
    <path
      fillRule="evenodd"
      d="M4.00001 8.00008V9.33342H2.00001L2.00001 12.6667H4V14.0001H0.666672L0.666672 8.00008H4.00001Z"
    />
    <path
      fillRule="evenodd"
      d="M4.01024 1.77673L2.91244 -1.3337L4.42122 -1.86621L5.51902 1.24422C5.59428 1.45745 5.79583 1.60005 6.02195 1.60005H13.3117C13.5378 1.60005 13.7394 1.45745 13.8146 1.24422L14.9124 -1.86621L16.4212 -1.3337L15.3234 1.77673C15.0224 2.62966 14.2162 3.20005 13.3117 3.20005H6.02195C5.11745 3.20005 4.31127 2.62966 4.01024 1.77673Z"
    />
  </Svg>
)

/** Stick-out: how much of the cutter stands below the holder. */
export const LengthBelowHolderIcon: FC<IconProps> = ({ className }) => (
  <Svg className={className}>
    <path d="M12.2666 13.2002C12.2665 13.5683 11.9677 13.8663 11.5996 13.8663H7.83985C8.85657 13.4319 9.95994 12.747 10.9307 11.6954C11.4811 11.099 11.9177 10.428 12.2666 9.74223V13.2002Z" />
    <path d="M12.1338 4.00005C12.2072 4.00029 12.2666 4.06035 12.2666 4.13383V6.45122C12.198 6.79776 12.1107 7.16725 11.9971 7.54692C11.6424 8.73152 11.0587 9.98354 10.1465 10.9717C9.03558 12.1752 7.72913 12.8306 6.667 13.1641V8.46391C7.6385 8.0269 8.67667 7.35806 9.59668 6.36137C10.2565 5.64653 10.7577 4.82719 11.1338 4.00005H12.1338Z" />
    <path d="M9.94727 4.00005C9.64311 4.58446 9.26948 5.14472 8.81348 5.63872C8.13757 6.37093 7.38841 6.89932 6.667 7.27739V4.13383C6.667 4.06026 6.72626 4.00015 6.79981 4.00005H9.94727Z" />
    <path
      fillRule="evenodd"
      d="M4.00001 4.13338V5.46671L2.00001 5.46671L2.00001 12.6667H4V14H0.666672L0.666672 4.13338H4.00001Z"
    />
    <path
      fillRule="evenodd"
      d="M4.01008 1.77673L2.91228 -1.3337L4.42106 -1.86621L5.51886 1.24422C5.59412 1.45745 5.79567 1.60005 6.02179 1.60005H13.3116C13.5377 1.60005 13.7392 1.45745 13.8145 1.24422L14.9123 -1.86621L16.4211 -1.3337L15.3233 1.77673C15.0222 2.62966 14.2161 3.20005 13.3116 3.20005H6.02179C5.11729 3.20005 4.31111 2.62966 4.01008 1.77673Z"
    />
  </Svg>
)

export const AngleIcon: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M11.49 3 7.98 11.74c.86.58 1.65 1.23 2.39 1.96 1.45 1.45 2.6 3.15 3.44 5.09l.09.21h7.17v2h-16c-.55 0-1.14-.04-1.53-.43-.39-.39-.69-.9-.46-1.57L9.49 3h2Zm-4.26 10.62L5.07 19h6.65a12.8 12.8 0 0 0-2.75-3.9 13 13 0 0 0-1.74-1.48Z" />
  </svg>
)

export const CornerRadiusIcon: FC<IconProps> = ({ className }) => (
  <Svg className={className}>
    <path d="M7.16525 7.25324C7.24335 7.17513 7.36999 7.17513 7.44809 7.25324L9.88355 9.6887C9.96166 9.7668 9.96166 9.89344 9.88355 9.97154L9.30383 10.5513C9.22572 10.6294 9.09909 10.6294 9.02098 10.5513L6.58552 8.11581C6.50742 8.0377 6.50742 7.91107 6.58552 7.83296L7.16525 7.25324Z" />
    <path
      fillRule="evenodd"
      d="M14 0H12.1333V8C12.1333 10.651 9.9843 12.8 7.33333 12.8H2V14.6667H7.33333C11.0152 14.6667 14 11.6819 14 8V0Z"
    />
    <path d="M6.66668 5.66667C6.66668 6.58714 5.92048 7.33333 5.00001 7.33333C4.07954 7.33333 3.33334 6.58714 3.33334 5.66667C3.33334 4.74619 4.07954 4 5.00001 4C5.92048 4 6.66668 4.74619 6.66668 5.66667Z" />
  </Svg>
)

/** The icon for a cutter, by its kind. */
/**
 * The tool library: Phosphor's books (regular weight) as two-colour line art, each book filled
 * white under a thin `currentColor` outline. Phosphor's own fill weight cuts the spines' bands
 * out, so the white here is the books' outer shapes alone.
 */
export const LibraryIcon: FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 256 256" className={className} aria-hidden>
    <path
      fill="white"
      d="M231.65,194.55,198.46,36.75a16,16,0,0,0-19-12.39L132.65,34.42a16.08,16.08,0,0,0-12.3,19l33.19,157.8A16,16,0,0,0,169.16,224a16.25,16.25,0,0,0,3.38-.36l46.81-10.06A16.09,16.09,0,0,0,231.65,194.55ZM104,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V48A16,16,0,0,0,104,32Z"
    />
    <path
      fill="currentColor"
      d="M231.65,194.55,198.46,36.75a16,16,0,0,0-19-12.39L132.65,34.42a16.08,16.08,0,0,0-12.3,19l33.19,157.8A16,16,0,0,0,169.16,224a16.25,16.25,0,0,0,3.38-.36l46.81-10.06A16.09,16.09,0,0,0,231.65,194.55ZM136,50.15c0-.06,0-.09,0-.09l46.8-10,3.33,15.87L139.33,66Zm6.62,31.47,46.82-10.05,3.34,15.9L146,97.53Zm6.64,31.57,46.82-10.06,13.3,63.24-46.82,10.06ZM216,197.94l-46.8,10-3.33-15.87L212.67,182,216,197.85C216,197.91,216,197.94,216,197.94ZM104,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V48A16,16,0,0,0,104,32ZM56,48h48V64H56Zm0,32h48v96H56Zm48,128H56V192h48v16Z"
    />
  </svg>
)

export const ToolIcon: FC<IconProps & { kind: Tool['kind'] }> = ({ kind, className }) => {
  if (kind === 'DrillBit' || kind === 'SpotDrill') return <DrillIcon className={className} />
  if (kind.endsWith('Tap')) return <TapIcon className={className} />
  if (kind.startsWith('Chamfer')) return <ChamferMillIcon className={className} />
  return <EndmillIcon className={className} />
}

/** One piece of a spec, as `describe` writes it ("27 mm flute"), split into icon, value and label. */
export interface SpecPiece {
  Icon: FC<IconProps>
  value: string
  label: string
}

const Ruler: FC<IconProps> = ({ className }) => <RulerIcon className={className} aria-hidden />

/** The pieces `describe` writes, and what each one is. The value is what the pattern captures. */
const SPEC_PIECES: Array<[RegExp, FC<IconProps>, string]> = [
  [/^(\d+) flutes?$/, FlutesIcon, 'Flutes'],
  [/^(.+) flute$/, LengthOfCutIcon, 'Flute length'],
  [/^(Ø.+) shank$/, DiameterIcon, 'Shank diameter'],
  [/^(.+°) point$/, AngleIcon, 'Point angle'],
  [/^(.+°) chamfer$/, AngleIcon, 'Chamfer angle'],
  [/^(.+) pitch$/, Ruler, 'Thread pitch'],
  [/^(.+) gauge length$/, Ruler, 'Gauge length'],
  [/^Clamps (.+)$/, DiameterIcon, 'Clamps'],
  [/^(.+) corner$/, CornerRadiusIcon, 'Corner radius'],
]

/** A spec piece as icon, value and label; null for the end shape ("Square end"), which has none. */
export const readSpecPiece = (text: string): SpecPiece | null => {
  for (const [pattern, Icon, label] of SPEC_PIECES) {
    const value = pattern.exec(text)?.[1]
    if (value) return { Icon, value, label }
  }
  return null
}
