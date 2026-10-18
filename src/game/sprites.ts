/**
 * Pixel-art sprites for the rider and the beast, plus the rules that pick a
 * frame. ORIGINAL ART drawn for Driftline: nothing here derives from SkiFree,
 * and no beast is a yeti.
 *
 * A frame is a list of rows with one character per pixel, looked up in the
 * sheet's palette; '.' is transparent. Downhill is down the screen, so the
 * rider shows their back with ski tips pointing down, and the beast's head
 * and claws lead downhill with its shadow trailing uphill.
 */

export const TRANSPARENT = '.';

export interface SpriteSheet<F extends string> {
  readonly width: number;
  readonly height: number;
  /** Point, in sprite pixels from the top-left, drawn on the entity's collision centre. */
  readonly anchor: { readonly x: number; readonly y: number };
  readonly palette: Readonly<Record<string, string>>;
  readonly frames: Readonly<Record<F, readonly string[]>>;
}

export type PlayerFrame = 'straight' | 'left' | 'right' | 'crashed';
export type BeastFrame = 'glideA' | 'glideB' | 'lunge';
export type Lean = Extract<PlayerFrame, 'straight' | 'left' | 'right'>;

export const PLAYER: SpriteSheet<PlayerFrame> = {
  width: 24,
  height: 32,
  anchor: { x: 12, y: 11 },
  palette: {
    o: '#141a2a', // outline
    O: '#ff922b', // jacket, the gauge's orange
    d: '#c4561c', // jacket shade
    b: '#4da0ff', // helmet, skis, back stripe: the gauge's blue
    B: '#23509e', // trousers, gloves, helmet shade
    w: '#ffffff', // shine, snow spray
  },
  frames: {
    straight: [
      '........................',
      '..........oooo..........',
      '........oobbbboo........',
      '.......obwwbbbbBo.......',
      '.......obwbbbbbBo.......',
      '.......oBBBBBBBBo.......',
      '.....oooBbbbbbbBooo.....',
      '....oOOOoBBBBBBoOOdo....',
      '...oOOOOOOooooOOOOOdo...',
      '...oOOOOOOOOOOOOOOOdo...',
      '..oOOoOOOOOOOOOOOdoOdo..',
      '..oOOobbbbbbbbbbbBoOdo..',
      '..oOOoOOOOOOOOOOOdoOdo..',
      '..ooooOOOOOOOOOOOdoooo..',
      '......oddOOOOOOddo......',
      '......ooBBBBBBBBoo......',
      '......ooBBBooBBBoo......',
      '......oBBBo..oBBBo......',
      '.....oBBBo....oBBBo.....',
      '....oBBBBBo..oBBBBBo....',
      '....ooooooo..ooooooo....',
      '......obo......obo......',
      '......obo......obo......',
      '......obo......obo......',
      '......obo......obo......',
      '......obo......obo......',
      '......obo......obo......',
      '......obo......obo......',
      '......owo......owo......',
      '......owo......owo......',
      '......obo......obo......',
      '.......o........o.......',
    ],
    left: [
      '........................',
      '........oooo............',
      '......oobbbboo..........',
      '.....obwwbbbbBo.........',
      '.....obwbbbbbBo.........',
      '.....oBBBBBBBBo.........',
      '...oooBbbbbbbBooo.......',
      '...oOOOoBBBBBBoOOdo.....',
      '..oOOOOOOooooOOOOOdo....',
      '..oOOOOOOOOOOOOOOOdo....',
      '.oOOoOOOOOOOOOOOdoOdo...',
      '.oOOobbbbbbbbbbbBoOdo...',
      '.oOOoOOOOOOOOOOOdoOdo...',
      '.ooooOOOOOOOOOOOdoooo...',
      '......oddOOOOOOddobo....',
      '.......oBBBBBBBBobo.....',
      '.......oBBBooBBBobo.....',
      '......oBBBo..oBBBoo.....',
      '.....oBBBo....oBBBo.....',
      '....oBBBBBo..oBBBBBo....',
      '....ooooooo..ooooooo....',
      '.....obo......obo.......',
      '.....obo......obo.......',
      '.....obo......obo.......',
      '....obo......obo........',
      '....obo......obo........',
      '....obo......obo........',
      '...obo......obo.........',
      '...owo......owo.........',
      '...owo......owo.........',
      '...oo.......oo..........',
      '........................',
    ],
    right: [
      '........................',
      '............oooo........',
      '..........oobbbboo......',
      '.........obwwbbbbBo.....',
      '.........obwbbbbbBo.....',
      '.........oBBBBBBBBo.....',
      '.......oooBbbbbbbBooo...',
      '.....oOOOoBBBBBBoOOdo...',
      '....oOOOOOOooooOOOOOdo..',
      '....oOOOOOOOOOOOOOOOdo..',
      '...oOOoOOOOOOOOOOOdoOdo.',
      '...oOOobbbbbbbbbbbBoOdo.',
      '...oOOoOOOOOOOOOOOdoOdo.',
      '...ooooOOOOOOOOOOOdoooo.',
      '....oboddOOOOOOddo......',
      '.....oboBBBBBBBBo.......',
      '.....oboBBBooBBBo.......',
      '.....ooBBBo..oBBBo......',
      '.....oBBBo....oBBBo.....',
      '....oBBBBBo..oBBBBBo....',
      '....ooooooo..ooooooo....',
      '.......obo......obo.....',
      '.......obo......obo.....',
      '.......obo......obo.....',
      '........obo......obo....',
      '........obo......obo....',
      '........obo......obo....',
      '.........obo......obo...',
      '.........owo......owo...',
      '.........owo......owo...',
      '..........oo.......oo...',
      '........................',
    ],
    crashed: [
      '........................',
      '.........o..............',
      '.......ooboo............',
      '......obbbbbo...........',
      '.....obbwwbbbo..........',
      '.....obbwbbbbo.....oooo.',
      '.ooooobbbbbBBo...ooooBo.',
      '.oBoOoobbbBBoOoooOOoBBBo',
      'oBBBoOOooBooOOOOoOOOoBo.',
      '.oBoOOoOOoOOOOOOOoOOooo.',
      '.ooooOoOOOOOOOOOOooo....',
      '....booOOOOOOOOOOo......',
      '...bwbobbbbbbbbBBo......',
      '.bwwwwoOOOOOOOdddo...b..',
      'bwwwwb.oOOOOddddo...bwb.',
      'bwwwb..oooddddooo..ooowb',
      '.booo.ooBBooooBBoooobob.',
      '..obbooBBBBooBBBBobboo..',
      '...obbooBBo..oBBobbo....',
      '....obbboo...ooobboo....',
      '....ooobbo...obbooBo....',
      '....oBBobbooobbooBBo....',
      '.....ooooobobboooBoo....',
      '.........oobboo..o......',
      '........obboobbo........',
      '.......obboooobbo..bbbb.',
      '.....oobbo....obboobwwb.',
      '....oobbo......oobbowwb.',
      '...obboo.........obboob.',
      '..obboo...........obbo..',
      '..obo..............ooo..',
      '...o....................',
    ],
  },
};

export const SHADOW_BEAST: SpriteSheet<BeastFrame> = {
  width: 32,
  height: 32,
  anchor: { x: 16, y: 18 },
  palette: {
    o: '#07040b', // outline
    k: '#22143a', // shadow body
    m: '#4a2c73', // rim light
    p: '#d9c9f0', // horns, talons
    r: '#ff3b3b', // eye glow and maw, the gauge's chaser red
    y: '#fff1b0', // hot eye core, fangs
  },
  frames: {
    glideA: [
      '.............omo................',
      '......oo....omko...........o....',
      '.....ommo...omko.........oomo...',
      '......omo...omkoo......oommo....',
      '......omo...omkmmo...oommko.....',
      '.....omkmo..omkkkmo.ommkko......',
      '.....omkko...omkkkoomkkko.......',
      '.....omkkmo..omkkkmmkkko........',
      '......omkkmoomkkkkkkkkko........',
      '......omkkkmomkkkkkkkkko........',
      '.......omkkkmkkkkkkkkkko........',
      '......omkkkkkkkkkkkkkkkmo.......',
      '......ompkkkkkkkkkkkkkpko.......',
      '.....omkkpkkkkkkkkkkkpkkmo......',
      '.....omkkppkkkkkkkkkppkkko......',
      '....omkkkkppkkkkkkkppkkkkmo.....',
      '....omkkkkppkkkkkkkppkkkko......',
      '....omkkkkkppkkkkkppkkkkkmo.....',
      '....omkkkkkkkkkkkkkkkkkkkko.....',
      '...omkkkkkkkkkkkkkkkkkkkkko.....',
      '...omkkkoomkkrrkkrrkkomkkko.....',
      '...omkkkoomryyrkkryyroomkko.....',
      '...omkko.omrrkkkkkkrroomkko.....',
      '..omkkko..omkkkkkkkko.omkko.....',
      '..opkko....omkkkkkko..opkko.....',
      '..oppopo....oomkkoo...oppopo....',
      '.opopopo......ooo.....opoopo....',
      '.opopopo...............oopopo...',
      '..oopoo.................opoo....',
      '....o....................o......',
      '................................',
      '................................',
    ],
    glideB: [
      '...............omo..............',
      '...o...........ommo....oo.......',
      '..omoo.........omko...ommo......',
      '...ommoo......oomko...omo.......',
      '....ommmoo...ommkko...omo.......',
      '.....omkmmo.omkkkko..omkmo......',
      '......omkkmoomkkko...omkko......',
      '.......omkkmmkkkko..omkkko......',
      '.......omkkkkkkkkmoomkkko.......',
      '.......omkkkkkkkkkomkkkko.......',
      '.......omkkkkkkkkkmkkkko........',
      '......omkkkkkkkkkkkkkkkmo.......',
      '......ompkkkkkkkkkkkkkpko.......',
      '.....omkkpkkkkkkkkkkkpkkmo......',
      '.....omkkppkkkkkkkkkppkkko......',
      '....omkkkkppkkkkkkkppkkkkmo.....',
      '.....omkkkppkkkkkkkppkkkkko.....',
      '....omkkkkkppkkkkkppkkkkkko.....',
      '....omkkkkkkkkkkkkkkkkkkkko.....',
      '....omkkkkkkkkkkkkkkkkkkkkmo....',
      '....omkkkomkkrrkkrrkkoomkkko....',
      '....omkkoomryyrkkryyroomkkko....',
      '....omkkoomrrkkkkkkrro.omkko....',
      '....omkko.omkkkkkkkko..omkkmo...',
      '....omkpo..omkkkkkko....omkpo...',
      '...opoppo...oomkkoo....opoppo...',
      '...opoopo.....ooo......opopopo..',
      '..opopoo...............opopopo..',
      '...oopo.................oopoo...',
      '.....o....................o.....',
      '................................',
      '................................',
    ],
    lunge: [
      '..............omo...............',
      '.....o.......omko.........o.....',
      '....omo......omko.......oomo....',
      '.....omo.....omko......ommo.....',
      '.....ommo....omkmo....omko......',
      '.....omkmo...omkko...omkko......',
      '......omkmo..omkkmo.omkko.......',
      '......omkkmoomkkkkoomkko........',
      '......omkkkoomkkkkoomkko........',
      '.......omkkmomkkkkomkkko........',
      '.......omkkkmkkkkkmkkkko........',
      '.......omkkkkkkkkkkkkkkmo.......',
      '......omkkkkkkkkkkkkkkkko.......',
      '.....omkkkkkkkkkkkkkkkkkmo......',
      '.....omkpkkkkkkkkkkkkkpkko......',
      '....omkkkpkkkkkkkkkkkpkkkmo.....',
      '...omkkkkppkkkkkkkkkppkkkkmo....',
      '...omkkkkkppkkkkkkkppkkkkkko....',
      '..omkkkkkkkppkkkkkppkkkkkkkmo...',
      '..omkkkomkkppkkkkkppkkkomkkko...',
      '.omkkkkooomkkkkkkkkkkooomkkkmo..',
      '.omkkko..omkkkkkkkkkko..omkkko..',
      'omkkko...omkkrrkkrrkko...omkkmo.',
      'mkkko....omryyrkkryyro....omkkmo',
      'kkkko.....orrkkkkkkrr.....omkkko',
      'kkko......omkyryyryko......omkko',
      'ppppo......oorrrrrro......oppppp',
      'poopo........oroor........opoopo',
      'poopo.....................opoopo',
      'po.o.......................o.opo',
      'o.............................o.',
      '................................',
    ],
  },
};

/**
 * Candidate beasts in an early-1990s Windows-era palette: white body, two
 * greys, black outline, one red accent. Original creatures, none of them a yeti or any
 * other white ape. Each frame bakes in a soft ground shadow ('s') so a white
 * beast still separates from white snow.
 */
export const CANDIDATE_PALETTE: Readonly<Record<string, string>> = {
  o: '#000000', // outline
  w: '#ffffff', // body
  l: '#c0c0c0', // light shade
  g: '#808080', // mid shade
  r: '#ff0000', // eyes and maw
  s: '#b4c3da', // ground shadow
};

/** Frost Wraith: a hooded snow spirit gliding on a tattered cloak; the hem sways, and it flares with claws out to lunge. */
export const WRAITH_BEAST: SpriteSheet<BeastFrame> = {
  width: 32,
  height: 32,
  anchor: { x: 16, y: 18 },
  palette: CANDIDATE_PALETTE,
  frames: {
    glideA: [
      '.......................ooo......',
      '............ooooooooooowwlo.....',
      '..........oolwwwwwwwwwwwlo......',
      '.........olwwwwwwwwwwlooo.......',
      '........olwwwwwwwwwwwwlo........',
      '.......olwwwwwwwwwwwwwwlo.......',
      '.......olwwwwgoooogwwwwlo.......',
      '.......olwwwgoooooogwwwlo.......',
      '......olwwwgorroorrogwwwlo......',
      '......olwwwgoorooroogwwwlo......',
      '......olwwwgoooooooogwwwlo......',
      '......oglwwwgoooooogwwwlgo......',
      '.....oglwwwwwggooggwwwwwlgo.....',
      '.....oglwwwwwwwwwwwwwwwwlgo.....',
      '...oogllwwwwwwwwwwwwwwwwllgoo...',
      '..ogllwwolwwwwwwwwwwwwlowwllgo..',
      '.oglwwwwolwwwwwwwwwwwwlowwwwlgo.',
      '.oglwwwwolwwwlwwwwlwwwlowwwwlgo.',
      '.oglwwwwolwwwlwwwwlwwwlowwwwlgo.',
      '.oggllllolwwwlwwwwlwwwlollllggo.',
      '..ololololwwwlwwwwlwwwlolololo..',
      '..ololololwwwlwwwwlwwwlolololo..',
      '...oolooglwwwlwwwwlwwwlgooloo...',
      '.....ooglwwwwlwwwwlwwwwlgoo.....',
      '....oglwwwwwlwwwwlwwwwwlgo......',
      '...oglwwwwwwlwwwwlwwwwwwlgo.....',
      '..olwwgolwwglwwglwwgolwwgo......',
      '..olwgoolwgolwgolwgoolwgo.......',
      '..oloo.oloooloooloo.oloo........',
      '...o....o..sosssosssso..........',
      '.........ssssssssssssss.........',
      '................................',
    ],
    glideB: [
      '........................oo......',
      '............oooooooooooowlo.....',
      '..........oolwwwwwwwwwwwwlo.....',
      '.........olwwwwwwwwwwlooolo.....',
      '........olwwwwwwwwwwwwlo.o......',
      '.......olwwwwwwwwwwwwwwlo.......',
      '.......olwwwwgoooogwwwwlo.......',
      '.......olwwwgoooooogwwwlo.......',
      '......olwwwgorroorrogwwwlo......',
      '......olwwwgoorooroogwwwlo......',
      '......olwwwgoooooooogwwwlo......',
      '......oglwwwgoooooogwwwlgo......',
      '.....oglwwwwwggooggwwwwwlgo.....',
      '.....oglwwwwwwwwwwwwwwwwlgo.....',
      '...oogllwwwwwwwwwwwwwwwwllgoo...',
      '..ogllwwolwwwwwwwwwwwwlowwllgo..',
      '.oglwwwwolwwwwwwwwwwwwlowwwwlgo.',
      '.oglwwwwolwwwlwwwwlwwwlowwwwlgo.',
      '.oglwwwwolwwwlwwwwlwwwlowwwwlgo.',
      '.oggllllolwwwlwwwwlwwwlollllggo.',
      '..ololololwwwlwwwwlwwwlolololo..',
      '..ololololwwwlwwwwlwwwlolololo..',
      '...oolooglwwwlwwwwlwwwlgooloo...',
      '.....ooglwwwwlwwwwlwwwwlgoo.....',
      '......oglwwwwwlwwwwlwwwwwlgo....',
      '.....oglwwwwwwlwwwwlwwwwwwlgo...',
      '.....olwwgolwwglwwglwwgolwwgo...',
      '......oolwgoolwgolwgolwgoolwgo..',
      '........oolo.oolooolooolo.oolo..',
      '..........ossssosssos..o....o...',
      '.........ssssssssssssss.........',
      '................................',
    ],
    lunge: [
      '........................oo......',
      '............oooooooooooowlo.....',
      '..........oolwwwwwwwwwwwwlo.....',
      '.........olwwwwwwwwwwlooolo.....',
      '........olwwwwwwwwwwwwlo.o......',
      '.......olwwwwwwwwwwwwwwlo.......',
      '.......olwwwwgoooogwwwwlo.......',
      '.......olwwwgoooooogwwwlo.......',
      '......olwwwgorroorrogwwwlo......',
      '......olwwwgorroorrogwwwlo......',
      '......olwwwgoooooooogwwwlo......',
      '......oglwwwgoooooogwwwlgo......',
      '.....oglwwwwwoooooowwwwwlgo.....',
      '...oogglwwwwwwwwwwwwwwwwlggoo...',
      '..ogllwwwwwwwwwwwwwwwwwwwwllgo..',
      '.ogllwwwwwolwwwwwwwwlowwwwwllgo.',
      'oglwwwwwwwolwwwwwwwwlowwwwwwwlgo',
      'oglwwggllwolwlwwwwlwlowllggwwlgo',
      '.ogglololoolwlwwwwlwloolololggo.',
      '.ololololoolwlwwwwlwloololololo.',
      '.olololoooglwlwwwwlwlgooolololo.',
      '..o.o.o..oglwlwwwwlwlgo..o.o.o..',
      '........oglwwlwwwwlwwlgo........',
      '.......oglwwwlwwwwlwwwlgo.......',
      '......oglwwwwlwwwwlwwwwlgo......',
      '...oooglwwwwwlwwwwlwwwwwlgooo...',
      '..oggllwwwwwwwwwwwwwwwwwwllggo..',
      '..olwgoolwgolwgoolwgolwgoolwgo..',
      '..owgo.owgoowgo.owgoowgo.owgo...',
      '...olo..olo.olo..olo.olo..olo...',
      '....o....osssossssossso....o....',
      '.......ssssssssssssssssss.......',
    ],
  },
};

/** Avalanche Golem: a squat heap of packed snow lumps and ice shards that tumble as it rolls; lunges with its icicle maw wide. */
export const GOLEM_BEAST: SpriteSheet<BeastFrame> = {
  width: 32,
  height: 32,
  anchor: { x: 16, y: 19 },
  palette: CANDIDATE_PALETTE,
  frames: {
    glideA: [
      '................................',
      '................................',
      '...............o................',
      '..............owo......o........',
      '........o.....owo.....owo.......',
      '.......owo....olwo....owo.......',
      '.......owo....olwo....olwo......',
      '.......olwo.oolwgooo.oolwo......',
      '........olwowwwwwwwwolwgo.......',
      '.......olwgwwwwwwwwwwlwgo.......',
      '.....ooolwggwwwwwwwwggwwgoo.....',
      '...oowwwwwwggggwwggggwwwwwwoo...',
      '..owwwwwwgwworrwwrrowlgwwwwwwo..',
      '..owwwwwwwgwwwwwwwwwwgwwwwwwwo..',
      '..owwwwwwwgwwwwwwwwwlgwwwwwwwo..',
      '..owwwwwwwwgwwwwwwwlgwwwwwwwlo..',
      '..owwwwwwwoooooooooooowwwwwwlo..',
      '..owwwwwwoolwoooooowloowwwwlgo..',
      '.owwwgggggoowoooooowoogggggwwwo.',
      '.owwwgwwwowwoooooooowwowwwgwwwwo',
      'owwwwwgwwwwwwwwwwwwwwwwwwwgwwwlo',
      '.owwwgwwwwwwwwwwwwwwwwwwwlgwwwlo',
      '.owwggwwwwwwwwwwwwwwwwwwwllgwlo.',
      '..oowwwwwwwwwwwwwwwwwwwwwllglo..',
      '..ooowwgggggwwwwwwwwwwgwllgoo...',
      '.owwwogwwwwwgwwwwwwgggwgggo.....',
      '.owwwwwwwwwwlgwwwwgwwwwwwwwo....',
      '.owwwowwwwwwgwwlllgwwwwwwwlo....',
      '.owlgoowwllgwlllllggwwwwlgo.....',
      '..ooo.sooooooooooooooooooo......',
      '....ssssssssssssssssssssssss....',
      '................................',
    ],
    glideB: [
      '................................',
      '................................',
      '................................',
      '...............o................',
      '..............owo......o........',
      '........o.....owo.....owo.......',
      '.......owo....olwo....owo.......',
      '.......owo....olwo....olwo......',
      '.......olwo.oolwgooo.oolwo......',
      '........olwowwwwwwwwolwgo.......',
      '.......olwgwwwwwwwwwwlwgo.......',
      '.....ooolwggwwwwwwwwggwwgoo.....',
      '...oowwwwwwggggwwggggwwwwwwoo...',
      '..owwwwwwgwworrwwrrowlgwwwwwwo..',
      '..owwwwwwwgwwwwwwwwwwgwwwwwwwo..',
      '..owwwwwwwgwwwwwwwwwlgwwwwwwwo..',
      '..owwwwwwwwgwwwwwwwlgwwwwwwwlo..',
      '..owwwwwwwoooooooooooowwwwwwlo..',
      '..owwwwwwoolwoooooowloowwwwlgo..',
      '.owwwgggggoowoooooowoogggggwwwo.',
      '.owwwgwwwowwoooooooowwowwwgwwwwo',
      'owwwwwgwwwwwwwwwwwwwwwwwwwgwwwlo',
      '.owwwgwwwwwwwwwwwwwwwwwwwlgwwwlo',
      '.owwggwwwwwwwwwwwwwwwwwwwllgwlo.',
      '..oowwwwwwwwwwwwwwwwwwwwwllglo..',
      '....owwwwgwwwwwwwwwwwgggglgwwwo.',
      '.....ogggwgggwwwwwwggwwwwgwwwwo.',
      '....owwwwwwwwgwwwwwgwwwwwwlwwwo.',
      '....owwwwwwwwgwllllggwwwwlgwlgo.',
      '.....ooooooooooooooooooooooooo..',
      '....ssssssssssssssssssssssss....',
      '................................',
    ],
    lunge: [
      '...............o................',
      '..............owo...............',
      '..............owo...............',
      '..............olwo.....o........',
      '........o.....olwo....owo.......',
      '.......owo..oolwgooo..owo.......',
      '.......owo.owwwwwwwwo.olwo......',
      '.......olwowwwwwwwwwwoolwo......',
      '........olggwwwwwwwwggwgo.......',
      '.......olwgggggwwgggggwgo.......',
      '.....ooolgwworrwwrrowlgwgoo.....',
      '...oowwwwwwwwwwwwwwwwlwwwwwoo...',
      '..owwwwwwwgwwwwwwwwwlgwwwwwwwo..',
      '..owwwwwwwoooooooooooowwwwwwwo..',
      '..owwwwwwowlowloolwolwowwwwwwo..',
      '..owwwwwoowoowoooowoowoowwwwlo..',
      '..owwwwwoooooooooooooooowwwwgo..',
      '.owgggwwooooooorrooooooowwwgwwo.',
      '.owwwgggoooooorrrroooooogggwwwwo',
      'owwwwwgwoooooooooooooooowwgwwwlo',
      '.owwwgwwooowooowwooowooowwgwwwlo',
      '.owwggwwwolwolwllwlowlowwllgwlo.',
      '..oowwwwwwoooooooooooowwwllllo..',
      '...owwwwwwwwwwwwwwwwwwwwwllgo...',
      '....owwgggggwwwwwwwwwwgwllgo....',
      '.....ogwwwwwgwwwwwwgggwgggo.....',
      '....owwwwwwwlgwwwwgwwwwwwwwo....',
      '.....owwwwwwgwwlllgwwwwwwwlo....',
      '......owwllgwlllllggwwwwlgo.....',
      '......sooooooooooooooooooo......',
      '....ssssssssssssssssssssssss....',
      '................................',
    ],
  },
};

/** Snow Wolf, three-quarter overhead, galloping down and to the left at the rider; lunges with forelegs flung out and jaws open. */
export const WOLF_BEAST: SpriteSheet<BeastFrame> = {
  width: 32,
  height: 32,
  anchor: { x: 16, y: 16 },
  palette: CANDIDATE_PALETTE,
  frames: {
    glideA: [
      '...........................oo...',
      '..........................oggo..',
      '..........................owwwo.',
      '.........................owgglo.',
      '........................owwwwwo.',
      '........................owwwwgo.',
      '..................oooooowwgggos.',
      '................oowwwwwwwwwwoss.',
      '..............oowwwwwwwwgwwlos..',
      '.............owwwwwwwwwwwwoos...',
      '............owwwwwwwwwwwwloss...',
      '.........o.owwwwwwwwwwwwwlo.....',
      '.....o..owowwwwwwwwwwwwwwgo.....',
      '....owo.owlwwwwwwwwwwwwlggo.....',
      '....owloowglwwwwwwwwwllglgo.....',
      '....owglowgglwwwwwwwwwwoolgo....',
      '.....owwggggwwwwllwwwlossolgo...',
      '....owwgrwrwgwwwllllllos..olgo..',
      '....owwwwwwwgwwwllloowlo..oggo..',
      '....owwwwwwwgwwlloosowlo...oos..',
      '....owwwwwwlglgoosss.owlo...ss..',
      '...owwwwgwlgowloss...owlo.......',
      '..oowwwooooowlos......owlo......',
      '...owlgosssowlos......owlo......',
      '....ooos..owlos.......olgo......',
      '.....sss.owloss........oos......',
      '.........owlos..........ss......',
      '........owlos...................',
      '........olgos...................',
      '.........oos....................',
      '..........ss....................',
      '................................',
    ],
    glideB: [
      '................................',
      '............................oo..',
      '...........................oggo.',
      '..........................owgwwo',
      '........................oowwwgo.',
      '..................oooooowwgwwlos',
      '................oowwwwwwwwwglos.',
      '..............oowwwwwwwwgwwwoss.',
      '.............owwwwwwwwwwgglgos..',
      '............owwwwwwwwwwwwloos...',
      '...........owwwwwwwwwwwwwloss...',
      '.........oowwwwwwwwwwwwwwgo.....',
      '.....o..owwwwwwwwwwwwwwlgos.....',
      '....owo.owlwwwwwwwwwwllggos.....',
      '....owloowglwwwwwwwwwwwlgo......',
      '....owglgwgglwwwllwwwlolgo......',
      '....owwwwwwwgwwwllllloolgo......',
      '....owwgrwrwgwwwllllosolgo......',
      '....owwwwwwwgwwllowlosolgo......',
      '....owwwwwwlglglowlos.olgo......',
      '...owwwwwwlggowlowlos.oggo......',
      '..owwwwooooolgowllos...oos......',
      '..oowlossssolgowllos....ss......',
      '....ooss...olgowlgo.............',
      '.....ss....olgoowlo.............',
      '...........oggoowlo.............',
      '............oosowlo.............',
      '.............ssolgo.............',
      '................oos.............',
      '.................ss.............',
      '................................',
      '................................',
    ],
    lunge: [
      '...........................oo...',
      '..........................oggo..',
      '..........................owwwo.',
      '.........................owgglo.',
      '........................owwwwwo.',
      '........................owwwwgo.',
      '..................oooooowwgggos.',
      '................oowwwwwwwwwwoss.',
      '..............oowwwwwwwwgwwlos..',
      '.............owwwwwwwwwwwwoos...',
      '............owwwwwwwwwwwwloss...',
      '...........owwwwwwwwwwwwwlo.....',
      '..........owwwwwwwwwwwwwwgo.....',
      '.........owwwwwwwwwwwwwlglgoo...',
      '.....o..owwwwwwwwwwwwllgoollgo..',
      '....owo.owlwwwwwwwwwwwwossoolgo.',
      '....owlowwglwwwwllwwwlwlo..oggo.',
      '....owglwwgglwwwllllloowlo..oos.',
      '...owwwwwwwgwwwwllloossowlo..ss.',
      '...owwwgrwrgwwwlloosss..owlo....',
      '..owwwwwwwwgllgoosss.....owlo...',
      '.owwwwlwwwlgloosss.......olgo...',
      '.oowwlwwwlglosss..........oos...',
      '.owowowoowloss.............ss...',
      '..orrrrolloss...................',
      '..orrrolooss....................',
      '..owowlgoss.....................',
      '..olwwgos.......................',
      '...ooooss.......................',
      '....ssss........................',
      '................................',
      '................................',
    ],
  },
};

export const BEAST_STYLES = ['shadow', 'wraith', 'golem', 'wolf'] as const;
export type BeastStyle = (typeof BEAST_STYLES)[number];

export const BEASTS: Readonly<Record<BeastStyle, SpriteSheet<BeastFrame>>> = {
  shadow: SHADOW_BEAST,
  wraith: WRAITH_BEAST,
  golem: GOLEM_BEAST,
  wolf: WOLF_BEAST,
};

export function isBeastStyle(value: string | null): value is BeastStyle {
  return (BEAST_STYLES as readonly (string | null)[]).includes(value);
}

/** World px per sprite px the renderer aims for; it rounds so each sprite px is whole device px. */
const SPRITE_WORLD_PX = 2.6;

/**
 * Device px per sprite px for a world-to-device scale. Whole numbers keep
 * pixels crisp. A 390px phone gets 2 at dpr 2 and 1 at dpr 1, the same size
 * on screen either way.
 */
export function devicePxPerSpritePx(worldToDevice: number): number {
  return Math.max(1, Math.round(SPRITE_WORLD_PX * worldToDevice));
}

/**
 * Draws each frame once onto its own canvas, one canvas px per sprite px.
 * Needs a DOM, so only the renderer and the dev sprite sheet call it.
 */
export function bakeFrames<F extends string>(sheet: SpriteSheet<F>): Record<F, HTMLCanvasElement> {
  const baked: Partial<Record<F, HTMLCanvasElement>> = {};
  for (const [name, rows] of Object.entries<readonly string[]>(sheet.frames)) {
    const canvas = document.createElement('canvas');
    canvas.width = sheet.width;
    canvas.height = sheet.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === TRANSPARENT) return;
        ctx.fillStyle = sheet.palette[ch];
        ctx.fillRect(x, y, 1, 1);
      });
    });
    baked[name as F] = canvas;
  }
  return baked as Record<F, HTMLCanvasElement>;
}

/** Smoothed lateral speed, world px/s, past which the rider shows a lean... */
const LEAN_ON_SPEED = 90;
/** ...and below which they straighten up again. The gap stops flicker at the threshold. */
const LEAN_OFF_SPEED = 50;
/** Time constant of the lateral-speed smoothing, s. */
const LEAN_SMOOTHING_S = 0.08;

/**
 * Infers the rider's lean from how their x changes between renders. Driven
 * by game time, so a paused run holds its frame and a new run starts straight.
 */
export class LeanTracker {
  private lean: Lean = 'straight';
  private vx = 0;
  private last: { x: number; time: number } | null = null;

  reset(): void {
    this.lean = 'straight';
    this.vx = 0;
    this.last = null;
  }

  update(x: number, time: number): Lean {
    const last = this.last;
    if (last === null || time < last.time) {
      this.reset();
      this.last = { x, time };
      return this.lean;
    }
    const dt = time - last.time;
    if (dt === 0) return this.lean;
    this.vx += ((x - last.x) / dt - this.vx) * Math.min(1, dt / LEAN_SMOOTHING_S);
    this.last = { x, time };
    const speed = Math.abs(this.vx);
    if (speed < LEAN_OFF_SPEED) this.lean = 'straight';
    else if (speed > LEAN_ON_SPEED) this.lean = this.vx < 0 ? 'left' : 'right';
    return this.lean;
  }
}

/** Seconds each glide frame shows. */
const BEAST_GLIDE_FRAME_S = 0.2;
/** World px between beast and rider centres inside which the beast lunges. Catch happens at 44. */
export const BEAST_LUNGE_DISTANCE = 130;

export function beastFrame(time: number, distanceToRider: number, caught: boolean): BeastFrame {
  if (caught || distanceToRider < BEAST_LUNGE_DISTANCE) return 'lunge';
  return Math.floor(time / BEAST_GLIDE_FRAME_S) % 2 === 0 ? 'glideA' : 'glideB';
}
