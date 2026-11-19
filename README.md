# Slice & Score ⚽

A football-themed, step-by-step lesson on **Python indexing and slicing** for young learners (around 11 years old).

- 5 missions: Kick-off, Indexing (+ negative indexes), Slicing, Step, Strings
- Interactive Training Ground: type Python, and a ball shows which items Python picks
- Coach's Orders challenges with hints, a **Matchday Analyst** project, and an 8-question quiz
- Coach notes for teachers (toggle in the top bar)

The page runs a small in-browser Python simulator for indexing/slicing. Students should also run their code in real Python.

## Files

- `Slice-and-Score.html`: the whole app in one file (open it in a browser)
- `docs/index.html`: same file, served by GitHub Pages
- `src/`: source (`engine.js` mini-Python, `content.js` lesson content, `app.js` UI, `style.css`)

## Edit and rebuild

Change the lesson in `src/content.js`, then run:

```bash
python3 src/build.py
```
