let dictionary = [];

fetch('words_dictionary.json')
  .then(r => r.json())
  .then(obj => {
    // obj is { "apple":0, "banana":0, … }
    dictionary = Object.keys(obj);
    main();  // kick off your game now that dict is ready
  })
  .catch(err => console.error("Failed to load dictionary:", err));

var chosenWords = [];
var wordSegments = {};      // ← new: map each chosen word to its 4 segments
var tilePool = [];
var selectedTiles = [];

var submittedWords = new Set();
var score = 0;

// track which quartile‐words you’ve found
var foundQuartiles = new Set();

// ensure the “all found” bonus only fires once
var bonusAwarded  = false;


function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function PickWords() {
  chosenWords = [];
  let wordPool = [...words];
  while (chosenWords.length < 5 && wordPool.length > 0) {
    let idx = getRandomInt(0, wordPool.length - 1);
    chosenWords.push(wordPool.splice(idx, 1)[0]);
  }
}

// helper to check real words
function isRealWord(w) {
  console.log(dictionary);
  return dictionary.includes(w.toLowerCase());
}

function DivideWord(word) {
  const totalLength = word.length;
  const numSegments = 4;
  let segments = [];
  let remaining = totalLength;

  for (let i = 0; i < numSegments - 1; i++) {
    let maxLen = Math.min(4, remaining - 2 * (numSegments - i - 1));
    let minLen = Math.max(2, remaining - 4 * (numSegments - i - 1));
    let segLen = getRandomInt(minLen, maxLen);
    segments.push(word.substr(totalLength - remaining, segLen));
    remaining -= segLen;
  }
  segments.push(word.substr(totalLength - remaining, remaining));
  return segments;
}

function DivideWords() {
  tilePool = [];
  wordSegments = {};            // ← clear previous mapping
  for (let word of chosenWords) {
    let segments = DivideWord(word);
    wordSegments[word] = segments;  // ← store the exact segments
    tilePool.push(...segments);
  }
  Shuffle(tilePool);
}

function Shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = getRandomInt(0, i);
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function RenderTiles() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  tilePool.forEach((segment, index) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.textContent = segment;
    tile.dataset.index = index;
    tile.addEventListener("click", () => {
      if (tile.classList.contains("selected")) {
        tile.classList.remove("selected");
        selectedTiles = selectedTiles.filter(t => t.index !== index);
      } else {
        tile.classList.add("selected");
        selectedTiles.push({ index: index, segment });
      }
      UpdateCurrentWord();
    });
    grid.appendChild(tile);
  });
}

function UpdateCurrentWord() {
  const span = document.getElementById("current-word");
  const word = selectedTiles.map(t => t.segment).join('');
  span.textContent = word || "_";
}

function SubmitWord() {
  const userSegs = selectedTiles.map(t => t.segment);
  const word     = userSegs.join('').toLowerCase();

  // 1) nothing selected?
  if (userSegs.length === 0) {
    ShowMessage("Select some tiles first!", "red");
    return;
  }

  // 2) no repeats
  if (submittedWords.has(word)) {
    ShowMessage(`You've already used "${word}".`, "orange");
    ClearSelection();
    return;
  }

  // 3) real-word check
  if (!isRealWord(word)) {
    ShowMessage(`"${word}" isn't in the dictionary.`, "red");
    ClearSelection();
    return;
  }

  // mark as used so they can’t re-submit
  submittedWords.add(word);

  // is it one of our 5 Quartiles?
  const isQuartile = Object.values(wordSegments).some(segments =>
    areSameSegments(segments, userSegs)
  );

  // base points = number of segments used
  const basePoints = userSegs.length;
  // quartile doubles your points
  const earned = (isQuartile && basePoints === 4)
                ? basePoints * 2
                : basePoints;

  // award points
  score += earned;
  document.getElementById("score").textContent = score;

  // WIN CHECK
  if (score >= 100) {
    ShowMessage("🏆 Congratulations! You reached 100 points and won!", "purple");
    document.getElementById("submit-button").disabled = true;
    document.querySelectorAll(".tile").forEach(t => {
      t.style.pointerEvents = "none";
      t.classList.add("used");
    });
    return;
  }

  if (isQuartile && basePoints === 4) {
    // record this quartile
    foundQuartiles.add(word);

    ShowMessage(`🎉 Quartile! "${word}" +${earned} points.`, "green");

    // move & lock only these 4 tiles
    const grid = document.getElementById("grid");
    selectedTiles.forEach(t => {
      const tileEl = document.querySelector(`.tile[data-index="${t.index}"]`);
      tileEl.classList.add("found");
      tileEl.classList.remove("selected");
      grid.appendChild(tileEl);
    });

    // ALL-FOUND BONUS
    if (!bonusAwarded && foundQuartiles.size === chosenWords.length) {
      bonusAwarded = true;
      score += 50;
      document.getElementById("score").textContent = score;
      ShowMessage("🏅 All quartiles found! Bonus +40 points!", "purple");
    }
  }
  else {
    ShowMessage(`Nice! "${word}" +${earned} points.`, "blue");
    // just deselect (no lock)
    ClearSelection();
  }

  // reset selection display
  selectedTiles = [];
  UpdateCurrentWord();
}

function ClearSelection() {
  selectedTiles.forEach(t => {
    const tileEl = document.querySelector(`.tile[data-index="${t.index}"]`);
    tileEl.classList.remove("selected");
  });
  selectedTiles = [];
  UpdateCurrentWord();
}


function areSameSegments(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

function ShowMessage(text, color = "black") {
  const msg = document.getElementById("message");
  msg.textContent = text;
  msg.style.color = color;
}

// ——————————————————————————————
// 1) generate all ways to split `word` into 2–4-letter chunks
function allValidSplits(word) {
  const results = [];
  function dfs(start, path) {
    if (start === word.length) {
      results.push(path.slice());
      return;
    }
    for (let len = 2; len <= 4; len++) {
      if (start + len <= word.length) {
        path.push(word.substr(start, len));
        dfs(start + len, path);
        path.pop();
      }
    }
  }
  dfs(0, []);
  return results;
}

// 2) Given a tilePool and the 5 quartile-segment arrays, 
//    return true iff you can score ≥100 points in theory
function poolIsWinnable(tilePool, quartileSegLists) {
  // 5 quartiles × 8 pts each
  let maxScore = quartileSegLists.length * 8;
  const hasSeg = new Set(tilePool);

  for (let w of dictionary) {
    // try every segmentation of w
    for (let segs of allValidSplits(w)) {
      if (segs.every(s => hasSeg.has(s))) {
        // non-quartile words give 1pt per segment
        maxScore += segs.length;
        break;
      }
    }
    if (maxScore >= 100) return true;
  }
  return false;
}

// 3) Loop until you find 5 words whose pool is winnable
function generateWinnableWords(candidates) {
  while (true) {
    // pick 5 random candidates
    const pick = [];
    const pool = [...candidates];
    for (let i = 0; i < 5; i++) {
      const idx = getRandomInt(0, pool.length - 1);
      pick.push(pool.splice(idx, 1)[0]);
    }

    // split them & build testPool
    const testSegMap = {};
    const testPool   = [];
    for (let w of pick) {
      const segs = DivideWord(w);
      testSegMap[w] = segs;
      testPool.push(...segs);
    }

    if (poolIsWinnable(testPool, Object.values(testSegMap))) {
      // found a winnable deal—commit to your game state:
      chosenWords  = pick;
      wordSegments = testSegMap;
      tilePool     = testPool.slice();
      Shuffle(tilePool);
      return;
    }
    // else: retry
  }
}

function main() {
  // 1) choose only dictionary words length 8–16 as quartile sources
  const candidates = dictionary.filter(w => w.length >= 8 && w.length <= 16);

  // 2) generate a provably winnable set
  generateWinnableWords(candidates);

  console.log("Winnable deal:", chosenWords, wordSegments);
  RenderTiles();

  // hook up buttons
  document.getElementById("submit-button")
          .addEventListener("click", SubmitWord);
  document.getElementById("clear-button")
          .addEventListener("click", ClearSelection);
}

main();


