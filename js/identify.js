// Dichotomous key for Wyoming/Colorado moths
// Character states: size, antenna, fwColor, fwPattern, hwColor, posture

export const CHARACTERS = [
  {
    id: 'size',
    label: 'Forewing size',
    hint: 'Measure from body to wingtip',
    diagram: 'forewing',
    options: [
      { value: 'small',  label: 'Small',  desc: 'Under 15 mm' },
      { value: 'medium', label: 'Medium', desc: '15 – 35 mm' },
      { value: 'large',  label: 'Large',  desc: 'Over 35 mm' },
    ],
  },
  {
    id: 'antenna',
    label: 'Antenna type',
    hint: 'Look at the base of the antennae',
    diagram: 'antenna',
    options: [
      { value: 'feathered', label: 'Feathered / comb-like', desc: 'Wide side branches (usually males of silk moths, buck moths)' },
      { value: 'filiform',  label: 'Thread-like / tapered', desc: 'Slim, no branches — most moths' },
    ],
  },
  {
    id: 'fwColor',
    label: 'Forewing ground color',
    hint: 'Ignore pattern marks — what is the main background color?',
    diagram: 'forewing',
    options: [
      { value: 'white',  label: 'White / bright' },
      { value: 'cream',  label: 'Cream / pale yellow' },
      { value: 'gray',   label: 'Gray / silver' },
      { value: 'brown',  label: 'Brown / tan / rust' },
      { value: 'green',  label: 'Green' },
      { value: 'dark',   label: 'Dark / black / charcoal' },
    ],
  },
  {
    id: 'fwPattern',
    label: 'Forewing pattern',
    hint: 'Look for any marks on the forewing',
    diagram: 'forewing',
    options: [
      { value: 'plain',   label: 'Plain / unmarked' },
      { value: 'banded',  label: 'Cross-bands or stripes' },
      { value: 'spotted', label: 'Spots or dots' },
      { value: 'complex', label: 'Complex / irregular marks' },
    ],
  },
  {
    id: 'hwColor',
    label: 'Hindwing color',
    hint: 'Gently lift the forewing — what color is the hindwing?',
    diagram: 'hindwing',
    options: [
      { value: 'white',  label: 'White / very pale' },
      { value: 'yellow', label: 'Yellow' },
      { value: 'orange', label: 'Orange / peach' },
      { value: 'red',    label: 'Red / pink' },
      { value: 'gray',   label: 'Gray / brown — similar to FW' },
    ],
  },
  {
    id: 'posture',
    label: 'Resting posture',
    hint: 'How does the moth hold its wings at rest?',
    diagram: 'posture',
    options: [
      { value: 'flat',   label: 'Wings flat / spread' },
      { value: 'tent',   label: 'Wings folded tent-like over body' },
      { value: 'angled', label: 'Wings swept back / jet-fighter' },
    ],
  },
];

// Top 30 Wyoming/Colorado moths with character states
// inatId = iNaturalist taxon ID
export const SPECIES_DATA = [
  { inatId: 48714, name: 'White-lined Sphinx',       sci: 'Hyles lineata',          size: 'large',  antenna: 'filiform',  fwColor: 'brown', fwPattern: 'complex', hwColor: 'orange', posture: 'angled', notes: 'White stripes on forewing; pink-orange hindwing' },
  { inatId: 48484, name: 'Luna Moth',                sci: 'Actias luna',             size: 'large',  antenna: 'feathered', fwColor: 'green', fwPattern: 'plain',   hwColor: 'gray',   posture: 'flat',   notes: 'Unmistakable pale green with long hindwing tails' },
  { inatId: 48706, name: 'Polyphemus Moth',          sci: 'Antheraea polyphemus',    size: 'large',  antenna: 'feathered', fwColor: 'brown', fwPattern: 'complex', hwColor: 'gray',   posture: 'flat',   notes: 'Large eyespots on all wings' },
  { inatId: 48651, name: 'Great Ash Sphinx',         sci: 'Sphinx chersis',          size: 'large',  antenna: 'filiform',  fwColor: 'gray',  fwPattern: 'complex', hwColor: 'gray',   posture: 'angled', notes: 'Gray with yellow side spots on abdomen' },
  { inatId: 75496, name: 'Hummingbird Clearwing',    sci: 'Hemaris thysbe',          size: 'medium', antenna: 'filiform',  fwColor: 'brown', fwPattern: 'banded',  hwColor: 'orange', posture: 'angled', notes: 'Mostly clear wings with brown border; flies by day' },
  { inatId: 48766, name: 'Virginia Creeper Sphinx',  sci: 'Darapsa myron',           size: 'medium', antenna: 'filiform',  fwColor: 'brown', fwPattern: 'banded',  hwColor: 'orange', posture: 'angled', notes: 'Orange hindwing; feeds on Virginia creeper' },
  { inatId: 205738,name: 'Nevada Buck Moth',         sci: 'Hemileuca nevadensis',    size: 'large',  antenna: 'feathered', fwColor: 'white', fwPattern: 'banded',  hwColor: 'gray',   posture: 'flat',   notes: 'Black-banded white wings; flies by day in fall' },
  { inatId: 61694, name: 'Wavy-lined Emerald',       sci: 'Synchlora aerata',        size: 'small',  antenna: 'filiform',  fwColor: 'green', fwPattern: 'banded',  hwColor: 'gray',   posture: 'flat',   notes: 'Green with white wavy cross-lines' },
  { inatId: 61696, name: 'Oblique-striped Emerald',  sci: 'Synchlora lactiaria',     size: 'small',  antenna: 'filiform',  fwColor: 'green', fwPattern: 'banded',  hwColor: 'gray',   posture: 'flat',   notes: 'Green with oblique white stripe' },
  { inatId: 48553, name: 'Fall Webworm Moth',        sci: 'Hyphantria cunea',        size: 'medium', antenna: 'filiform',  fwColor: 'white', fwPattern: 'spotted', hwColor: 'white',  posture: 'flat',   notes: 'White; often has black spots; common in late summer' },
  { inatId: 47942, name: 'American Dagger Moth',     sci: 'Acronicta americana',     size: 'medium', antenna: 'filiform',  fwColor: 'gray',  fwPattern: 'complex', hwColor: 'white',  posture: 'flat',   notes: 'Gray with black dagger marks on forewing' },
  { inatId: 77234, name: 'Corn Earworm Moth',        sci: 'Helicoverpa zea',         size: 'medium', antenna: 'filiform',  fwColor: 'cream', fwPattern: 'spotted', hwColor: 'white',  posture: 'flat',   notes: 'Pale brownish with dark spot near center' },
  { inatId: 87285, name: 'Black Cutworm Moth',       sci: 'Agrotis ipsilon',         size: 'medium', antenna: 'filiform',  fwColor: 'dark',  fwPattern: 'complex', hwColor: 'white',  posture: 'flat',   notes: 'Dark gray-brown with kidney-shaped mark' },
  { inatId: 104736,name: 'Armyworm Moth',            sci: 'Mythimna unipuncta',      size: 'medium', antenna: 'filiform',  fwColor: 'brown', fwPattern: 'spotted', hwColor: 'white',  posture: 'flat',   notes: 'Pale brown with small white center dot' },
  { inatId: 169032,name: 'Cabbage Looper',           sci: 'Trichoplusia ni',         size: 'medium', antenna: 'filiform',  fwColor: 'brown', fwPattern: 'spotted', hwColor: 'gray',   posture: 'flat',   notes: 'Mottled brown; metallic silver figure-8 mark' },
  { inatId: 202817,name: 'Painted Lichen Moth',      sci: 'Hypoprepia fucosa',       size: 'small',  antenna: 'filiform',  fwColor: 'cream', fwPattern: 'spotted', hwColor: 'orange', posture: 'flat',   notes: 'Cream with orange/red stripes and spots' },
  { inatId: 104769,name: 'Banded Tussock Moth',      sci: 'Halysidota tessellaris',  size: 'medium', antenna: 'filiform',  fwColor: 'cream', fwPattern: 'banded',  hwColor: 'white',  posture: 'flat',   notes: 'Translucent yellowish wings with dark veins/spots' },
  { inatId: 48675, name: 'Tobacco Hornworm Moth',    sci: 'Manduca sexta',           size: 'large',  antenna: 'filiform',  fwColor: 'gray',  fwPattern: 'complex', hwColor: 'yellow', posture: 'angled', notes: 'Gray streaked; 6 orange/yellow spots on abdomen' },
  { inatId: 53580, name: 'Variegated Cutworm Moth',  sci: 'Peridroma saucia',        size: 'medium', antenna: 'filiform',  fwColor: 'brown', fwPattern: 'complex', hwColor: 'white',  posture: 'flat',   notes: 'Variable; pale kidney spot; yellowish subterminal dots' },
  { inatId: 119276,name: 'Lunate Zale',              sci: 'Zale lunata',             size: 'medium', antenna: 'filiform',  fwColor: 'brown', fwPattern: 'banded',  hwColor: 'gray',   posture: 'flat',   notes: 'Brown with dark irregular bands and lunate spot' },
  { inatId: 119285,name: 'One-spotted Zale',         sci: 'Zale unilineata',         size: 'medium', antenna: 'filiform',  fwColor: 'brown', fwPattern: 'banded',  hwColor: 'gray',   posture: 'flat',   notes: 'Similar to lunate; single dark cross-band' },
  { inatId: 49040, name: 'Ultronia Underwing',       sci: 'Catocala ultronia',       size: 'large',  antenna: 'filiform',  fwColor: 'gray',  fwPattern: 'complex', hwColor: 'red',    posture: 'flat',   notes: 'Gray FW; bright red & black banded hindwing shown in flight' },
  { inatId: 49073, name: 'Ilia Underwing',           sci: 'Catocala ilia',           size: 'large',  antenna: 'filiform',  fwColor: 'gray',  fwPattern: 'complex', hwColor: 'red',    posture: 'flat',   notes: 'Gray FW; red/orange HW with black median band' },
  { inatId: 130266,name: 'Pearly Wood-nymph',        sci: 'Eudryas unio',            size: 'medium', antenna: 'filiform',  fwColor: 'white', fwPattern: 'complex', hwColor: 'yellow', posture: 'flat',   notes: 'White with purple-brown FW edges; yellow HW' },
  { inatId: 189525,name: 'Cucullia antipoda',        sci: 'Cucullia antipoda',       size: 'medium', antenna: 'filiform',  fwColor: 'gray',  fwPattern: 'plain',   hwColor: 'white',  posture: 'tent',   notes: 'Pale gray; long narrow wings; tent posture' },
  { inatId: 130253,name: 'Three-spotted Fillip',     sci: 'Heterophleps triguttaria', size: 'small', antenna: 'filiform',  fwColor: 'cream', fwPattern: 'spotted', hwColor: 'gray',   posture: 'flat',   notes: 'Pale yellow with 3 brown dots' },
  { inatId: 183267,name: 'Snowy Eupithecia',         sci: 'Eupithecia niveopictata', size: 'small',  antenna: 'filiform',  fwColor: 'white', fwPattern: 'banded',  hwColor: 'white',  posture: 'flat',   notes: 'White with fine gray cross-lines' },
  { inatId: 134819,name: 'Southern Quaker',          sci: 'Apamea commoda',          size: 'medium', antenna: 'filiform',  fwColor: 'gray',  fwPattern: 'complex', hwColor: 'white',  posture: 'flat',   notes: 'Gray-brown with reniform and orbicular spots' },
  { inatId: 130280,name: 'Small Engrailed',          sci: 'Ectropis crepuscularia',  size: 'small',  antenna: 'feathered', fwColor: 'white', fwPattern: 'banded',  hwColor: 'white',  posture: 'flat',   notes: 'White with brown cross-bands; feathered antennae' },
  { inatId: 60399, name: 'Large Lace-border',        sci: 'Scopula limboundata',     size: 'small',  antenna: 'filiform',  fwColor: 'white', fwPattern: 'banded',  hwColor: 'white',  posture: 'flat',   notes: 'White with row of marginal dots; delicate pattern' },
];

export function runKey(answers, forecastSpecies = []) {
  // Score each species based on how many character states match
  return SPECIES_DATA.map(sp => {
    let matched = 0, total = 0, conflicts = 0;
    for (const [char, val] of Object.entries(answers)) {
      if (!val) continue; // skipped
      total++;
      if (sp[char] === val) matched++;
      else conflicts++;
    }
    // Boost if in tonight's forecast
    const inForecast = forecastSpecies.some(f =>
      f.inatId === sp.inatId || f.id === sp.inatId ||
      f.sci?.toLowerCase() === sp.sci.toLowerCase()
    );
    const baseScore = total > 0 ? matched / total : 0;
    return { ...sp, matchScore: Math.round(baseScore * 100), conflicts, inForecast };
  })
    .filter(sp => sp.conflicts === 0 || sp.matchScore >= 30)
    .sort((a, b) => {
      // Forecast species first, then by score
      if (b.inForecast !== a.inForecast) return b.inForecast - a.inForecast;
      return b.matchScore - a.matchScore;
    })
    .slice(0, 12);
}
