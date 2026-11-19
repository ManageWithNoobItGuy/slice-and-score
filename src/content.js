/* Lesson content for "Slice & Score" */
const TEAM = {
  squad: ["Alisson", "Hakimi", "Van Dijk", "Dias", "Kimmich", "Bellingham", "Pedri", "Messi", "Mbappe", "Haaland", "Ronaldo"],
  shirts: [1, 2, 4, 3, 6, 5, 8, 10, 11, 9, 7],
  pos: ["gk", "def", "def", "def", "def", "mid", "mid", "mid", "fwd", "fwd", "fwd"],
};
const BASE_ENV_SRC = `squad = ["Alisson", "Hakimi", "Van Dijk", "Dias", "Kimmich", "Bellingham", "Pedri", "Messi", "Mbappe", "Haaland", "Ronaldo"]
form = "WDLWWWLDWWLW"
score = "LIO 3-1 EAG"
clock = "89:57"`;

const SQUAD_LINE = 'squad = ["Alisson", "Hakimi", "Van Dijk", "Dias", "Kimmich", "Bellingham", "Pedri", "Messi", "Mbappe", "Haaland", "Ronaldo"]';

/* must / mustNot: {re, msg} checked against what the student typed */
const NEG = { re: "\\[\\s*-", msg: "Use a negative index" };

const MISSIONS = [
  /* ---------------- 00 ---------------- */
  {
    id: "m0", tab: "Kick-off", tag: "MISSION 00 · WARM-UP",
    title: "The Team Sheet",
    story: "The coach has pinned today's team sheet on the dressing-room wall. In Python, a team sheet is a <b>list</b>. Every player has a slot number called an <b>index</b>, and Python starts counting at <b>0</b>, like the kick-off spot.",
    board: [
      { big: "[ … ]", lbl: "A list", s: "11 players, one variable" },
      { big: "0 · 1 · 2 …", lbl: "Indexes", s: "every slot has a number" },
      { big: "squad[0]", lbl: "Call a player", s: "the first one is slot 0" },
    ],
    think: "There are 11 players. If the first one is number 0, what number is the last one?",
    code: `${SQUAD_LINE}

print(len(squad))   # 11  how many players
print(squad[0])     # Alisson  the first player

word = "GOAL"       # strings are sequences too!
print(word[0])      # G`,
    rules: [
      "A <b>list</b> lives inside <code>[ ]</code>. Items are separated by commas.",
      "<code>len(x)</code> tells you how many items (or characters) there are.",
      "Indexes start at <b>0</b>. So the last index is always <code>len − 1</code>.",
      "A <b>string</b> like <code>\"GOAL\"</code> has indexes too: G=0, O=1, A=2, L=3.",
    ],
    viz: ["squad"],
    quick: ["squad", "len(squad)", "squad[0]", '"GOAL"[0]'],
    predict: [
      { code: "len(squad)", opts: ["10", "11", "12"], a: 1, why: "There are 11 names in the list. <code>len()</code> counts items, so it starts from 1 like normal counting." },
      { code: 'len("FC Python")', opts: ["8", "9", "10"], a: 1, why: "F, C, <b>space</b>, P, y, t, h, o, n. The space counts as a character, so the answer is 9." },
      { code: '"GOAL"[1]', opts: ["'G'", "'O'", "'A'"], a: 1, why: "Index 0 is G, so index 1 is the <b>second</b> letter, O." },
    ],
    challenges: [
      { p: "How many players are on the team sheet? Use <code>len()</code>.", stars: 1, a: "len(squad)", must: [{ re: "len\\s*\\(", msg: "Use len()" }], hints: ["Put the list's name inside <code>len( )</code>."] },
      { p: "Call up the goalkeeper. They're the <b>first</b> player in the list.", stars: 1, a: "squad[0]", hints: ["Use square brackets after the name: <code>squad[ ? ]</code>", "The first index is not 1…"] },
      { p: 'How many letters are in the word <code>"PENALTY"</code>?', stars: 1, a: 'len("PENALTY")', must: [{ re: "len\\s*\\(", msg: "Use len()" }], hints: ['Text needs quotes: <code>len("PENALTY")</code>'] },
    ],
    real: [
      "Open your Python editor (IDLE, Thonny or VS Code) and make a new file called <code>matchday.py</code>.",
      "Type the <code>squad</code> list exactly as shown. Check the commas and quotes!",
      "Add <code>print(len(squad))</code> and <code>print(squad[0])</code>, then run it.",
    ],
    checkpoint: "I can explain why the first player is at index 0, not 1.",
    coach: {
      time: "10–15 min",
      flow: ["Show the team sheet and ask: <i>if I shout “player 1!”, who comes?</i> Then reveal that Python's first slot is 0.", "Let them tap through the Training Ground: <code>squad</code>, <code>len(squad)</code>, <code>squad[0]</code>.", "Do the 3 predictions <b>out loud</b> before clicking."],
      watch: ["Thinking the last index is 11 (it's 10).", "Forgetting quotes around text: <code>len(PENALTY)</code> gives a NameError. Good moment to read an error together."],
      ask: ["Why might programmers count from 0? (The index is “how many steps from the start”.)"],
    },
  },

  /* ---------------- 01 ---------------- */
  {
    id: "m1", tab: "Indexing", tag: "MISSION 01 · INDEXING",
    title: "Call Up a Player",
    story: "The coach shouts a number and you send on the right player. Write <code>squad[i]</code> where <b>i</b> is the index. Careful: the <b>shirt number</b> is NOT the index! Need someone near the end? Count backwards with a <b>negative</b> index: <code>-1</code> is the last player.",
    board: [
      { big: "squad[3]", lbl: "From the front", s: "walk 3 steps from the start" },
      { big: "squad[-1]", lbl: "From the back", s: "-1 is the last player" },
      { big: "squad[11]", lbl: "Off the pitch", s: "IndexError!" },
    ],
    think: "Messi wears shirt No.10. Is Messi at index 10?",
    code: `${SQUAD_LINE}

squad[3]     # 'Dias'
squad[7]     # 'Messi'    (shirt No.10, but index 7!)
squad[10]    # 'Ronaldo'  the last one
squad[-1]    # 'Ronaldo'  -1 counts from the end
squad[-2]    # 'Haaland'  second-last
squad[11]    # IndexError: list index out of range`,
    rules: [
      "<code>squad[i]</code> gives you <b>one</b> item.",
      "Valid indexes go from <code>0</code> to <code>len(squad) − 1</code>, so 0 … 10 here.",
      "Negative indexes count from the end: <code>-1</code> is last, <code>-2</code> is second-last … <code>-11</code> is first.",
      "Go past either end and Python blows the whistle: <b>IndexError</b>. The player is out of play!",
    ],
    viz: ["squad"],
    quick: ["squad[3]", "squad[7]", "squad[-1]", "squad[-3]", "squad[11]", "squad[len(squad) - 1]"],
    predict: [
      { code: "squad[3]", opts: ["'Van Dijk'", "'Dias'", "'Kimmich'"], a: 1, why: "Count from 0: Alisson(0), Hakimi(1), Van Dijk(2), <b>Dias(3)</b>." },
      { code: "squad[-3]", opts: ["'Haaland'", "'Mbappe'", "'Messi'"], a: 1, why: "Count back from the end: Ronaldo(-1), Haaland(-2), <b>Mbappe(-3)</b>." },
      { code: "squad[11]", opts: ["'Ronaldo'", "IndexError", "None"], a: 1, why: "11 players means indexes 0 to 10. There is no slot 11, so Python raises an <b>IndexError</b>." },
    ],
    challenges: [
      { p: "Who plays at index 5? Call them up.", stars: 1, a: "squad[5]", hints: ["<code>squad[ number ]</code>"] },
      { p: "The <b>No.10</b> is the playmaker. Find them by looking at the shirts in the picture, then call them up by their <b>index</b>.", stars: 1, a: "squad[7]", hints: ["Find the shirt with 10 on it. What small number is written <b>above</b> it?", "It's Messi. Count Messi's index from 0."] },
      { p: "Get the last player using a <b>negative</b> index.", stars: 1, a: "squad[-1]", must: [NEG], hints: ["The last one is <code>-1</code>."] },
      { p: "Dias is at index 3. Call Dias using a <b>negative</b> index.", stars: 2, a: "squad[-8]", must: [NEG], hints: ["Look at the orange number <b>under</b> Dias in the picture.", "Or do the maths: 3 − 11 = ?"] },
      { p: "Make the referee blow the whistle! Write an index that causes an <b>IndexError</b>.", stars: 2, expectError: "IndexError", show: "squad[11]", hints: ["Ask for a player who doesn't exist: an index that's too big (or too far back)."] },
      { p: 'Strings have indexes too. Get the letter <code>K</code> from <code>"KICKOFF"</code>, but <b>not</b> the first K!', stars: 3, a: '"KICKOFF"[3]', mustNot: [{ re: "\\[\\s*0\\s*\\]", msg: "Not the first K" }], hints: ['Write the word with quotes, then the brackets: <code>"KICKOFF"[ ? ]</code>', "K=0, I=1, C=2, K=?"] },
    ],
    real: [
      "In <code>matchday.py</code>, print 3 different players using indexes.",
      "Print the last player in two ways: <code>squad[-1]</code> and <code>squad[len(squad) - 1]</code>. Do they match?",
      "Add <code>print(squad[11])</code>, run it and <b>read the error message</b>. Then fix the line.",
    ],
    checkpoint: "I can call any player with a positive <b>and</b> a negative index, and explain why <code>squad[11]</code> crashes.",
    coach: {
      time: "20 min",
      flow: ["Play “coach shouts a number”: you say an index, the student types it and checks the ball animation.", "Shirt numbers vs index is the key trap. Spend time on the No.10 challenge.", "Point out the two rows of numbers on every chip: black = positive, orange = negative. Rule of thumb: positive − 11 = negative (3 − 11 = −8).", "Celebrate the IndexError challenge: errors are information, not failure."],
      watch: ["Off-by-one: thinking index 3 is the 3rd player.", "Thinking <code>-1</code> means “one before the first”.", "Typing <code>squad(3)</code> with round brackets: read the TypeError together."],
      ask: ["Why is <code>squad[-1]</code> better than <code>squad[10]</code> if the squad changes size?"],
      extend: "Ask them to predict <code>squad[len(squad)]</code> and <code>squad[-12]</code> before running them.",
    },
  },

  /* ---------------- 02 ---------------- */
  {
    id: "m3", tab: "Slicing", tag: "MISSION 02 · SLICING",
    title: "Pick the Unit",
    story: "A coach doesn't only call one player. They call a whole <b>unit</b>: the defence, the midfield, the attack. A <b>slice</b> <code>squad[start:stop]</code> gives you a new list from <b>start</b> up to, but <b>NOT including</b>, <b>stop</b>.",
    board: [
      { big: "[start", lbl: "Start here", s: "included ✅" },
      { big: "· · ·", lbl: "Keep going right", s: "one step at a time" },
      { big: "stop]", lbl: "Stop before", s: "NOT included ✋" },
    ],
    think: "squad[1:5] — how many players is that? (Tip: stop − start)",
    code: `${SQUAD_LINE}

squad[1:5]    # ['Hakimi', 'Van Dijk', 'Dias', 'Kimmich']  index 1,2,3,4
squad[:3]     # from the start  → index 0,1,2
squad[8:]     # to the end      → index 8,9,10
squad[-3:]    # the last 3 players
squad[5:100]  # too big? No crash! Slices are friendly`,
    rules: [
      "The slice <b>includes start</b> but <b>stops before stop</b>.",
      "Number of items = <code>stop − start</code> (when both are inside the list).",
      "Leave out start → begin at the first player. Leave out stop → run to the end.",
      "Slices never cause an IndexError. Out-of-range numbers are trimmed to fit.",
      "A slice always gives back a <b>list</b> (or a string from a string), even with one item.",
    ],
    viz: ["squad"],
    lab: { vars: ["squad"], step: false },
    quick: ["squad[1:5]", "squad[:3]", "squad[8:]", "squad[-3:]", "squad[5:100]", "squad[3:3]"],
    predict: [
      { code: "squad[1:3]", opts: ["['Hakimi', 'Van Dijk']", "['Hakimi', 'Van Dijk', 'Dias']", "['Alisson', 'Hakimi', 'Van Dijk']"], a: 0, why: "Start at 1 (Hakimi), stop <b>before</b> 3. So you get index 1 and 2: Hakimi and Van Dijk." },
      { code: "len(squad[2:7])", opts: ["4", "5", "6"], a: 1, why: "stop − start = 7 − 2 = <b>5</b> players (index 2, 3, 4, 5, 6)." },
      { code: "squad[9:50]", opts: ["['Haaland', 'Ronaldo']", "IndexError", "[]"], a: 0, why: "Slices are forgiving: 50 is trimmed to the end of the list. No error!" },
    ],
    challenges: [
      { p: "Pick the 4 <b>defenders</b> (the blue shirts).", stars: 1, a: "squad[1:5]", must: [{ re: ":", msg: "Use a slice" }], hints: ["The first defender is at index 1. The first <b>midfielder</b> is where you stop."] },
      { p: "Pick the <b>midfield three</b> (the green shirts).", stars: 1, a: "squad[5:8]", must: [{ re: ":", msg: "Use a slice" }], hints: ["Start at the first green shirt. Stop at the first red one."] },
      { p: "Pick the <b>attack</b> (red shirts) with a negative start and <b>no stop</b> number.", stars: 2, a: "squad[-3:]", must: [{ re: "\\[\\s*-\\s*\\d+\\s*:\\s*\\]", msg: "Negative start, empty stop" }], hints: ["Leaving the stop empty means “to the end”: <code>squad[ ? : ]</code>"] },
      { p: "Everyone <b>except</b> the goalkeeper. You may only use the digits 0 and 1!", stars: 2, a: "squad[1:]", must: [{ re: ":", msg: "Use a slice" }], mustNot: [{ re: "[2-9]|\\d\\d", msg: "Only 0 or 1" }], hints: ["Start after the keeper, and leave the stop empty."] },
      { p: "Midfield <b>and</b> attack together in one slice, using <b>negative</b> numbers only.", stars: 3, a: "squad[-6:]", must: [NEG], mustNot: [{ re: "(\\[|:)\\s*\\d", msg: "No positive numbers" }], hints: ["That's the last 6 players.", "<code>squad[-? :]</code>"] },
      { p: "Pick <b>nobody</b>! Write a slice that gives an empty list <code>[]</code>.", stars: 3, a: "squad[3:3]", must: [{ re: ":", msg: "Use a slice" }], hints: ["What happens if start and stop are the same number?"] },
    ],
    real: [
      "Make three variables: <code>defence</code>, <code>midfield</code>, <code>attack</code> using slices, and print them.",
      "<b>Predict first</b>, then check: what does <code>len(defence)</code> print?",
      "Change <code>attack</code> to use a negative start. Does it still print the same?",
    ],
    checkpoint: "I can explain why <code>squad[1:5]</code> does NOT include Bellingham at index 5.",
    coach: {
      time: "20–25 min",
      flow: ["Start with the <b>Slice Lab</b>: let them move start/stop and press Kick. Watch the red STOP ✋ marker: the ball never touches it.", "Then go to the Coach's Orders without the lab. They should type the slices themselves.", "Connect to football: the units really are neat slices of the team sheet."],
      watch: ["Including the stop: writing <code>squad[1:4]</code> for 4 defenders.", "Expecting <code>squad[5:100]</code> to crash (it doesn't; compare with <code>squad[100]</code>, which does)."],
      ask: ["Why is <code>squad[a:b] + squad[b:c]</code> the same as <code>squad[a:c]</code>? (Because stop is excluded, nothing is counted twice.)"],
      extend: "Ask: what is <code>squad[:5] + squad[5:]</code>?",
    },
  },

  /* ---------------- 03 ---------------- */
  {
    id: "m4", tab: "Step", tag: "MISSION 03 · STEP",
    title: "Passing Drills",
    story: "Training time! The coach says <i>“every second player, step forward!”</i> The third number in a slice is the <b>step</b>: <code>squad[start:stop:step]</code>. A <b>negative</b> step runs backwards, like a replay on rewind ⏪. You'll also use <code>form</code>, the <b>form guide</b>: the last 12 results (W win, D draw, L loss), oldest → newest.",
    board: [
      { big: "[::2]", lbl: "Every 2nd", s: "jump 2 slots each time" },
      { big: "[::-1]", lbl: "Rewind", s: "whole list backwards" },
      { big: "[4:0:-1]", lbl: "Backwards from 4", s: "stops BEFORE 0" },
    ],
    think: "With a negative step, should start be bigger or smaller than stop?",
    code: `${SQUAD_LINE}
form = "WDLWWWLDWWLW"

squad[::2]     # every 2nd player: index 0,2,4,6,8,10
squad[1::2]    # every 2nd, starting at 1
squad[::-1]    # the whole team backwards
squad[4:0:-1]  # index 4,3,2,1 (stops before 0)
form[::-1]     # newest result first`,
    rules: [
      "<code>[start:stop:step]</code>: the step is how far to jump each time. Default is 1.",
      "Negative step = walk <b>backwards</b>. Now start should be on the <b>right</b> and stop on the <b>left</b>.",
      "With a negative step, empty start means “from the end” and empty stop means “to the very beginning”.",
      "A step of <code>0</code> is not allowed (ValueError). You'd never move!",
    ],
    viz: ["squad", "form"],
    lab: { vars: ["squad", "form"], step: true },
    quick: ["squad[::2]", "squad[1::2]", "squad[::-1]", "squad[4:0:-1]", "form[::-1]", "form[-5:]"],
    predict: [
      { code: "squad[::3]", opts: ["['Alisson', 'Dias', 'Pedri', 'Haaland']", "['Van Dijk', 'Bellingham', 'Mbappe']", "['Alisson', 'Van Dijk', 'Kimmich', 'Pedri', 'Mbappe', 'Ronaldo']"], a: 0, why: "Start at 0 and jump 3: index 0, 3, 6, 9 → Alisson, Dias, Pedri, Haaland." },
      { code: '"GOAL"[::-1]', opts: ["'GOAL'", "'LAOG'", "'LOGA'"], a: 1, why: "Step −1 reads the string backwards: L, A, O, G." },
      { code: "squad[2:0:-1]", opts: ["['Van Dijk', 'Hakimi']", "['Van Dijk', 'Hakimi', 'Alisson']", "[]"], a: 0, why: "Start at 2 and go backwards. Stop <b>before</b> 0, so Alisson is not included." },
    ],
    challenges: [
      { p: "Every second player, starting with the goalkeeper.", stars: 1, a: "squad[::2]", hints: ["You can leave start and stop empty: <code>squad[ : : ? ]</code>"] },
      { p: "Read the form guide <b>backwards</b> (newest result first).", stars: 1, a: "form[::-1]", hints: ["Rewind = step −1."] },
      { p: "The players with an <b>odd</b> index (1, 3, 5, …).", stars: 2, a: "squad[1::2]", hints: ["Same jump as before, different starting point."] },
      { p: "The defenders in <b>reverse</b> order: Kimmich, Dias, Van Dijk, Hakimi.", stars: 2, a: "squad[4:0:-1]", hints: ["Start at Kimmich (index 4) and go backwards.", "Where should you stop so that Hakimi (1) is included but Alisson (0) isn't?"] },
      { p: "The last 5 results, <b>newest first</b>, in ONE slice (only one pair of <code>[ ]</code>).", stars: 3, a: "form[:-6:-1]", maxBrackets: 1, hints: ["With step −1 and an empty start, you begin at the newest result.", "You want index −1, −2, −3, −4, −5. Stop <b>before</b> which index?"] },
      { p: "⚽ Penalty shoot-out! The takers are the attackers then the midfielders, starting from <b>Ronaldo</b> and going backwards (Ronaldo, Haaland, Mbappe, Messi, Pedri).", stars: 3, a: "squad[10:5:-1]", maxBrackets: 1, hints: ["Start at Ronaldo's index, step −1.", "Pedri is index 6. Stop <b>before</b> Bellingham."] },
    ],
    real: [
      "Print <code>squad[::2]</code> and <code>squad[1::2]</code>. Together, do they include every player exactly once?",
      "Print <code>form[::-1]</code>. Then print <code>form[-5:]</code> and <code>form[:-6:-1]</code>. What's the difference?",
      "Try <code>squad[::0]</code> and read the error.",
    ],
    checkpoint: "I can explain why <code>squad[4:0:-1]</code> doesn't include Alisson.",
    coach: {
      time: "20–25 min",
      flow: ["In the Slice Lab, keep start/stop empty and only change the step: 1, 2, 3, −1, −2.", "Then fix start=4, step=−1 and slowly move stop. The STOP ✋ marker is now on the <b>left</b>.", "The last two challenges are hard on purpose. Allow hints, and praise them for trying."],
      watch: ["Writing <code>squad[0:4:-1]</code> for backwards (gives <code>[]</code>, because start is left of stop).", "Thinking step=2 means “the 2nd player”."],
      ask: ["Why does <code>squad[0:4:-1]</code> give an empty list? (Walking left from 0 never reaches 4.)"],
      extend: "Can they find two different slices that both give Ronaldo, Haaland, Mbappe, Messi, Pedri?",
    },
  },

  /* ---------------- 04 ---------------- */
  {
    id: "m5", tab: "Strings", tag: "MISSION 04 · STRINGS",
    title: "Read the Scoreboard",
    story: "The stadium scoreboard is just a <b>string</b>! Every character has its own index: letters, digits, <b>spaces</b>, even the dash. Your job: pull the useful information out of it.",
    board: [
      { big: '"LIO 3-1 EAG"', lbl: "Scoreboard", s: "one string, 11 characters" },
      { big: "score[4]", lbl: "Pick a digit", s: "you get '3' (text!)" },
      { big: "int('3')", lbl: "Make a number", s: "now you can do maths" },
    ],
    think: "Is score[4] the number 3 or the text '3'? What do you think score[4] + score[6] gives?",
    code: `score = "LIO 3-1 EAG"
clock = "89:57"

score[:3]        # 'LIO'  home team
score[-3:]       # 'EAG'  away team
score[4]         # '3'   ← this is TEXT, not a number
int(score[4])    # 3     ← now it's a number`,
    rules: [
      "Strings index and slice exactly like lists.",
      "A <b>space</b> is a character too. It has an index!",
      "Slicing a string gives a string. Indexing gives a 1-letter string.",
      "<code>'3'</code> is text. Use <code>int()</code> to turn it into the number <code>3</code>.",
    ],
    viz: ["score", "clock"],
    quick: ["score[:3]", "score[-3:]", "score[4]", "int(score[4])", "score[3]", "clock[:2]"],
    predict: [
      { code: "score[3]", opts: ["'O'", "' '", "'3'"], a: 1, why: "L=0, I=1, O=2, and index 3 is the <b>space</b>." },
      { code: "score[4] + score[6]", opts: ["4", "'31'", "'3-1'"], a: 1, why: "Both are <b>text</b>, so <code>+</code> glues them together: '3' + '1' = <b>'31'</b>. To add the goals, use <code>int()</code> first." },
      { code: "clock[-2:]", opts: ["'57'", "'89'", "':5'"], a: 0, why: "The last two characters of \"89:57\" are 5 and 7." },
    ],
    challenges: [
      { p: "Get the home team code.", stars: 1, a: "score[:3]", hints: ["The first three characters."] },
      { p: "Get the away team code using a <b>negative</b> number.", stars: 1, a: "score[-3:]", must: [{ re: "-", msg: "Use a negative number" }], hints: ["The last three characters."] },
      { p: "Get the minutes from the clock (<code>'89'</code>).", stars: 2, a: "clock[:2]", hints: ["Look at the clock picture. Where does the colon sit?"] },
      { p: "Get just the score part: <code>'3-1'</code>.", stars: 2, a: "score[4:7]", hints: ["It starts at the 3 (index 4). Remember: stop is NOT included."] },
      { p: "How many goals were scored in total? The answer must be the <b>number</b> <code>4</code>, not text.", stars: 3, a: "int(score[4]) + int(score[6])", hints: ["Turn each digit into a number with <code>int()</code>, then add.", "<code>int(score[?]) + int(score[?])</code>"] },
      { p: "Flip the away code: get <code>'GAE'</code> in ONE slice.", stars: 3, a: "score[:-4:-1]", maxBrackets: 1, hints: ["Backwards = negative step, starting at the end.", "You want −1, −2, −3. Stop <b>before</b> −4."] },
    ],
    real: [
      'Make <code>score = "LIO 3-1 EAG"</code> and print the home and away codes.',
      "Print <code>score[4] + score[6]</code> and then <code>int(score[4]) + int(score[6])</code>. Explain the difference.",
      'Bonus: make your own result string, e.g. <code>"THA 2-0 JPN"</code>. Does your code still work?',
    ],
    checkpoint: "I can explain why <code>score[4] + score[6]</code> gives '31' and not 4.",
    coach: {
      time: "15–20 min",
      flow: ["Have them count the characters of the scoreboard out loud, including the spaces.", "The '31' prediction is the “aha” moment of the lesson. Let them be wrong, then explain text vs number."],
      watch: ["Forgetting the space is a character.", "Writing <code>int(score[4] + score[6])</code>, which gives 31, not 4."],
      ask: ["Would <code>score[:3]</code> still work for <code>\"LIONS 3-1 EAGLES\"</code>? Why not? (Leads to the idea of fixed-width data.)"],
    },
  },

];

/* ---------------- PROJECT ---------------- */
const PROJECT_DATA = `squad = ["Courtois", "Saliba", "Marquinhos", "Gvardiol", "Cancelo",
         "Modric", "Rodri", "De Bruyne", "Salah", "Kane", "Mbappe",
         "Son", "Neymar", "Vinicius", "Musiala"]
# index 0 = goalkeeper, 1-4 = defenders, 5-7 = midfielders,
# 8-10 = forwards, 11-14 = substitutes on the bench

form = "WLWWDWLWWWDLWW"    # last 14 results, oldest -> newest
result = "FCP 4-2 TIG"     # today's final score: FC Python vs Tigers`;

const PROJECT_TASKS = [
  { id: "keeper", title: "1 · Goalkeeper", desc: "<code>keeper</code> = the first player in the squad.", ref: { keeper: "squad[0]" } },
  { id: "captain", title: "2 · Captain", desc: "The captain is the <b>11th</b> player in the list (the last starter). Store them in <code>captain</code>.", ref: { captain: "squad[10]" } },
  { id: "starters", title: "3 · Starters & bench", desc: "<code>starters</code> = the first 11 players. <code>bench</code> = everyone after them.", ref: { starters: "squad[:11]", bench: "squad[11:]" } },
  { id: "units", title: "4 · Units", desc: "<code>defence</code> = the 4 defenders. <code>attack</code> = the 3 forwards.", ref: { defence: "squad[1:5]", attack: "squad[8:11]" } },
  { id: "form", title: "5 · Form guide", desc: "<code>last5</code> = the last 5 results, in the <b>same order</b> as <code>form</code> (oldest → newest). <code>latest</code> = the most recent result.", ref: { last5: "form[-5:]", latest: "form[-1]" } },
  { id: "score", title: "6 · Read the score", desc: "<code>home_goals</code> and <code>away_goals</code> as <b>numbers</b>, then <code>total_goals</code>.", ref: { home_goals: "int(result[4])", away_goals: "int(result[6])", total_goals: "int(result[4]) + int(result[6])" } },
  { id: "pens", title: "⭐ Bonus · Penalty takers", bonus: true, desc: "<code>penalty_takers</code> = 5 players. Start with the captain and go <b>backwards</b> one by one. One slice only!", ref: { penalty_takers: "squad[10:5:-1]" } },
  { id: "rewind", title: "⭐ Bonus · Rewind the season", bonus: true, desc: "<code>newest_first</code> = the whole form string, newest result first.", ref: { newest_first: "form[::-1]" } },
  { id: "report", title: "7 · Print the report", desc: "Use <code>print()</code> to show <b>at least 5 lines</b> of your match report.", print: 5 },
];

const PROJECT_STARTER = `# ⚽ MATCHDAY ANALYST: FC Python vs Tigers
# The club computer gave you this data. DON'T change it!

${PROJECT_DATA}

# ---------- YOUR CODE STARTS HERE ----------
# Replace each None with indexing or slicing on the data above.
# No typing the answers by hand. The coach will check!

# Task 1: the goalkeeper
keeper = None

# Task 2: the captain (the 11th player in the list)
captain = None

# Task 3: starters (first 11) and bench (the rest)
starters = None
bench = None

# Task 4: the 4 defenders and the 3 forwards
defence = None
attack = None

# Task 5: the last 5 results (same order: oldest -> newest),
#         and the most recent result
last5 = None
latest = None

# Task 6: goals as NUMBERS (hint: int)
home_goals = None
away_goals = None
total_goals = None

# BONUS: penalty takers (captain first, then backwards, 5 players)
penalty_takers = None

# BONUS: the whole form guide, newest first
newest_first = None

# Task 7: print your match report (at least 5 lines)
print("===== MATCH REPORT =====")
print("Final score:", result)
`;

/* ---------------- QUIZ ---------------- */
const QUIZ_DATA = `team = ["Ana", "Bo", "Cy", "Dan", "Eve", "Fin", "Gus"]
word = "STADIUM"`;

const QUIZ = [
  { t: "mcq", q: "What is <code>team[2]</code>?", opts: ["'Bo'", "'Cy'", "'Dan'"], a: 1, why: "Index 0 is Ana, 1 is Bo, <b>2 is Cy</b>." },
  { t: "mcq", q: "What happens with <code>team[7]</code>?", opts: ["'Gus'", "None", "IndexError"], a: 2, why: "7 players means indexes 0 to 6. Index 7 doesn't exist, so you get an <b>IndexError</b>." },
  { t: "text", q: "What is <code>word[:3]</code>? (type the result)", a: "word[:3]", why: "The first three characters: S, T, A." },
  { t: "text", q: "What is <code>word[::2]</code>? (type the result)", a: "word[::2]", why: "Index 0, 2, 4, 6 → S, A, I, M." },
  { t: "mcq", q: "Which one is <b>NOT</b> the same as <code>team[0]</code>?", opts: ["team[-7]", "team[:1]", "team[len(team) - 7]"], a: 1, why: "<code>team[:1]</code> is a <b>slice</b>, so it gives a list <code>['Ana']</code>, not the string <code>'Ana'</code>." },
  { t: "mcq", q: "The coach wants the <b>last 2</b> players and wrote <code>team[-2:-1]</code>. What's wrong?", opts: ["It gives ['Fin'] because stop is not included. Fix: team[-2:]", "Nothing, it gives ['Fin', 'Gus']", "It's an IndexError. Fix: team[-2]"], a: 0, why: "The stop (−1 = Gus) is <b>not included</b>. Leave the stop empty to go to the end." },
  { t: "code", q: "Get the letter <code>'D'</code> from <code>word</code> using a <b>negative</b> index.", a: "word[-4]", must: [NEG], why: "S T A D I U M: D is 4th from the end, so <code>word[-4]</code>." },
  { t: "code", q: "⭐ Final boss: get <code>['Gus', 'Eve', 'Cy', 'Ana']</code> in one slice.", a: "team[::-2]", maxBrackets: 1, why: "Start at the end and jump backwards by 2: <code>team[::-2]</code>." },
];
