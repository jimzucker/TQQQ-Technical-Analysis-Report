# Change plan — support levels above price, any ticker, chart navigation, indicators

Written 2026-10-25. This file records what was asked for, what the review found, and the plan agreed. It is meant to be shared with the original owner of the app. The [README change log](../README.md#change-log) records each phase as it lands.

**Status:** test automation, the security checks, phase 3 (chart scrolling), phase 1 (levels above price), remembered settings with readable dates, phase 4 (Bollinger Bands), levels from at least 200 sessions, the every-combination tests, and phase 5 (show or hide every layer) are done. Phase 2 is under way: part 1 (several tickers from a list) is done; parts 2 and 3 are not started.

**Pull requests, each built on the one before:**

| Order | Branch | What it holds |
|---|---|---|
| 1 | `test-automation` | Tests only. No change to what the app does |
| 2 | `security-checks` | Vulnerability checks and one escaping fix (section 10) |
| 3 | `chart-scroll-and-levels-above-price` | Phases 3 and 1 |
| 4 | `usability-memory-and-dates` | Remembered settings and readable chart dates (section 11) |
| 5 | `bollinger-bands` | Phase 4, Bollinger Bands (section 7) |
| 6 | `levels-min-200-sessions` | Every level from at least the last 200 sessions; the chart fits every time frame (section 12) |
| 7 | `test-every-combination` | Tests only: the chart checked in every combination of options (section 13) |
| 8 | `show-hide-indicators` | Phase 5: show or hide every chart layer, with its tests (section 8) |
| 9 | `multi-ticker` | Phase 2, part 1: several tickers from a list (section 5) |

---

## 1. What was asked for

The requests, copied word for word:

> do a review of this application and create a plan to modify it to show a)all support levels even if they are above the current levels, currnetly it only shows support for current price and below, it removes higher support levels b) a second phase to let me request different tickers not just TQQQ

> c) phase 3 to make the navigation of chart more standard, now hwne scrollign the page with finger press on mause pad the chart starts zooming d) add bollinger bands e) give abilitty to hid show indictors to make ti easier to read

> Above-price levels on the chart do as recommended / Phase 2 - option b, default list TQQQ, QQQ, SPY if a user asks for a ticker it should be validate and if valid add to default list so it is maintained

> keep alog of my prompt and this plan in a file id docs so it can be shared with the original owner of the the app, in readme add a change log

> oh ok, do 3 and one on this branch that will be the first PR for the owner

> do a review of the application do we have good test coverage automation, do we have any gaps we need to close before we submit a PR with these 2 changes

> i want to make a branch with any required test automation improvmements that will be PR#1 to the app owner, then make all our functional changes a second PR ontop of PR#1 leveraing all the ststs

> does each branch contain a file with the prompt and plan adn update hte change log inreadme?

> is branch 2 ontop of branch 1

> fix reset view on branch 2 / on branch one do we have any vunerabilties are check vunerabilties part of test automation?

> on merge do we have github configured to run tests

> lets make vunerabilty fixes a PR on top of branch 1 keep it seperate so review is not overwhelmeed

> include prompt and plan for vunerabilties on it and any test enh for vunerabilties

> se we will have branch 1 for tests, branch 2 for vunerabilties , branch 3 for functional changes

> prs shoudl be rebased on each other in order

> how do we test branch 3 before we submit PR?

> yes / i tried to test but link is not working

> after pr created alwasy remind me to disable daily updates remmeber that!

> change default on branch 3 to 1m from 12m

> did we squash on all 3 branches so pr are clean?

> remember to always do that for PRs

> track pad works great lets send PR if all tests passed in order, make it clear in each pr them must be reviewed and merge din order as they build on each other

> lets create PR4 to address some usablity / does it remember locally my choices for light-dark, remeber the ptions I set like # months, which metrics to show (ie remmeber what I did in last use/session and not reset to defaults / look at main graph dates are hard to see/read what do you sugget ot improve the UX for the dates see screenshot

> is there any changes on the owners main that requires us to rebase PRs?

> send it

> close the draft PRs in my fork

> is update disabled on my fork main?

> let's start phase 4 bollinger bands as PR5

> have we covered all changes with tests ?

> ij di recommenation

> looking at sight when we added support levels above we seemed ot have lost all the support levels below!

> we should have a test that we keep all known support levels above and below

> for last 200 days

> make bollinger on by default unless a user changes

> whats in PR5

> pr5 we should be seeing all support levels valid the last 200days but we are not

> we should see min 200, more if bigger time window

> chart looks odd / we shoudl show one level below current floore band

> do you think thats right to do?

> yes do it

> test shoudl check rendering for all timer periods thinks look bad on 12m for instance

> 1m has alot of white space

> make sure tests cover all UI opionts and combinations

> of time frames

> lets make adding this automation of all compbinations a seperate PR

> in current functional PR we have alot of whitespace margins can we sue more of the screen, is there a reason for the big margins that we would want to keep them

> lets not combine functioanl changes with the test PRS

> ok

> send PRs 5, 6 and 7

> margins are very tight now can we double the width on PR7?

> let me review irst

> formatting is off on this text

> make margins 50% wider

> go push PRs 6 and 7

> does all CI pass with the recent changes?

> whats next

> yes, include any changes to tests as part of this change

> how long does a full combo run take

> eta?

> support below price removes the current support it should not either show the support level we are in or the one closestst above and below even when unchecked

> status ?

> send PR 8

> anyone

> yes start PR 9

> the time tiles moved they should be near the graph

> 3 month view not correct showing one lower support just current support and higher

> never mind my review was wrong its oK

## 2. Decisions made

| Question | Decision |
|---|---|
| Levels above price: shown by default? | **Yes**, in a muted colour, with a switch to hide them |
| Other tickers: fixed list, or any ticker? | **Any ticker.** A requested ticker is checked; if it passes, it is added to the daily list and kept up to date from then on |
| Starting list | TQQQ, QQQ, SPY |
| Who may add tickers, and how many | **Anyone**, at most 50 tickers on the list and at most 5 additions per visitor per day (decided 2026-10-25) |

## 3. How the app works today

| Part | What it does |
|---|---|
| `pipeline/fetch.py`, `pipeline/build.py` | Download TQQQ and QQQ daily prices (Yahoo, with Tiingo and Alpha Vantage as backups), check them, write `docs/data/tqqq.json` |
| `docs/js/support.js` | The support method. The page and the nightly snapshot job (`pipeline/snapshot.js`) use this one file |
| `docs/js/app.js`, `docs/js/charts.js` | Draw the report and the charts. The site is static GitHub Pages with no server |
| `.github/workflows/refresh.yml` | Runs every weekday evening after the US close and commits new data |

---

## 4. Phase 1 — show support levels above the current price

**What the review found.** `docs/js/support.js:165` marks a zone as "broken" when the close is below it:

```js
z.broken = price < z.low - half;
```

Every zone above today's price therefore counts as broken, and `support.js:175` keeps only zones that are not broken. The levels above price only show up as one line at the foot of the table and in the "what changed" feed.

Measured on the data as of 2026-10-23 (close $66.29):

| Window | Levels shown | Levels hidden above the price |
|---|---|---|
| 1 month | **none** | $67.43 (score 97), $75.47 (score 83) |
| 3 months | 2 | $75.47 |
| 6 months | 2 | $70.26 (3 touches, score 70, Strong) |
| 12 months | 5 | $70.26 (3 touches), $75.47 |

The 1-month view says no support was found, even though two well-scored levels sit just above the price.

**Plan.**

| Step | Change | Where |
|---|---|---|
| 1 | Split zones into **at or below price** (S1–S5, unchanged) and **above price**, returned as their own list, nearest first, limit 5 | `support.js:164–180` |
| 2 | Own labels for levels above price (A1, A2, …) with the status "Above price — was support, price closed below it". They do not take places from S1–S5 | `support.js` |
| 3 | Show them in the levels table above the "Last close" row, so the table reads in price order | `app.js:228–252` |
| 4 | Draw them on the chart in a muted colour, shown by default, with a legend entry and a switch | `app.js:413`, legend |
| 5 | Add "Nearest level above price: $X, Y% above" to the findings and the bottom line. Stop the 1-month view saying no levels exist when some sit above the price | `findings()`, `bottomLine()` |
| 6 | Save every level above price in the daily snapshot, not just the first 5 | `snapshot()` at `support.js:537` |
| 7 | Add them to the CSV export. Update the README glossary and the Method panel in `index.html:169,181` | |
| 8 | Tests: a zone above price is listed, not dropped. S1–S5 match today's output on every saved history file | `tests/support.test.js` |

---

## 5. Phase 2 — any ticker, added to the daily list once it passes the checks

**What the review found.** "TQQQ", "QQQ" and the 3× leverage are hard-coded in about 40 places: the data file name, the fetch calls, page titles, the benchmark panel, the "daily resetting cost" finding and the disclaimer. A browser can't download prices from Yahoo directly, because Yahoo blocks requests coming from other websites, so viewing a new ticker live needs a small proxy service.

**How it will work.**

1. The visitor types a ticker.
2. If it is on the daily list, the page loads its saved data: the full report, with history and what-changed.
3. If it is not, the page asks the proxy. The proxy checks that the ticker exists and has at least 260 trading days of data, sends the prices back so the report shows right away, and asks GitHub to start an **add-ticker** job.
4. The add-ticker job runs the same checks as the nightly refresh (`fetch.py validate()`). If the ticker passes, the job adds it to `tickers.json`, builds its data and commits. The nightly refresh keeps it up to date from then on.
5. If it fails, the page says why in plain words ("only 140 trading days of history; 260 needed") and nothing is added.

**Plan.**

| Step | Change |
|---|---|
| 1 | `pipeline/tickers.json`: TQQQ (benchmark QQQ, 3×), QQQ (benchmark SPY, 1×), SPY (no benchmark, 1×). New tickers default to 1× against SPY |
| 2 | `build.py --symbol X` writes `docs/data/<sym>/`. Move TQQQ's existing files there so its history is kept. The nightly job loops over the list, and one failed ticker does not stop the others |
| 3 | Copy the indicator maths (`indicators.py`) into JS so the page can work out indicators for a live ticker. A test checks the JS numbers match the Python ones on every series in the saved data |
| 4 | Proxy: a free-tier Cloudflare Worker in a new `proxy/` folder, with `GET /prices?symbol=` and `POST /add?symbol=` |
| 5 | New `.github/workflows/add-ticker.yml`, started by the proxy: checks again, adds to the list, builds, commits |
| 6 | Page: a ticker box with a dropdown of listed tickers, `?ticker=` in the page address, and all ticker, benchmark and leverage wording taken from the ticker's settings. Leverage text only for leveraged funds |

**Limits, because the site is public** (see the open question in section 2):
- Tickers must be 1–10 characters (letters, digits, `.`, `-`, `^`), and only stocks and ETFs are accepted.
- At most 50 tickers on the list. Once it is full, a new ticker can still be viewed live but is not added.
- At most 5 additions per visitor per day.
- A listed ticker that fails 5 nightly runs in a row opens an issue rather than being retried for ever.
- Not measured yet: how long the nightly run takes with 50 tickers, and whether Yahoo slows down repeated downloads. This will be timed with a real list before the limit is raised.

**Setup the owner will need to do** (about 10 minutes; step-by-step notes will come with the code):
- A free Cloudflare account, and one `npx wrangler deploy`.
- A GitHub fine-grained token for this repository only, with **Actions: write** and nothing else, saved as a secret in the Worker.

---

**Split into three pull requests**, each on the one before:

| PR | What | Status |
|---|---|---|
| 9 | Several tickers from `docs/data/tickers.json` (TQQQ, QQQ, SPY): a menu and `?ticker=` links, per-ticker data folders, wording from each ticker's entry, the nightly refresh building every ticker | Done |
| 10 | The indicator maths in JavaScript, so the page can analyse a ticker not yet on the list | Not started |
| 11 | Request any ticker: a Cloudflare Worker fetches it and starts an "add ticker" job, within the limits above | Not started; needs the owner's Cloudflare account and a GitHub token |

**Decisions made while building PR 9.**
- TQQQ's files stay at `docs/data/` (no move, so its history and anything linking to `docs/data/tqqq.json` are untouched); other tickers get `docs/data/<symbol>/`.
- SPY's benchmark is QQQ rather than none: it compares the S&P 500 with the Nasdaq-100 and avoids a special "no benchmark" case throughout the page.
- The benchmark series is now `bench_close`; files written before the change (`qqq_close`) are still read.
- The time buttons (1M–12M) had always been in the bar at the top of the page. Since levels now come from at least 200 sessions, they mainly set how much of the chart is shown, so they moved into a toolbar directly above the chart, with Daily/Mondays and the zoom buttons (asked for while reviewing this pull request).

## 6. Phase 3 — standard chart navigation

**What the review found.** `app.js:375` sets `wheelZoom: true` on the main chart, so the handler at `charts.js:322–331` turns every scroll event over the chart into a zoom and stops the page scrolling. Two-finger scrolling on a trackpad sends the same scroll events, so moving down the page zooms the chart whenever the pointer passes over it.

**Plan**, matching how TradingView and embedded Google Maps behave:

| Gesture | Today | After |
|---|---|---|
| Two-finger scroll up/down, mouse wheel | Zooms the chart | **Scrolls the page** |
| Two-finger swipe left/right | Ignored | **Moves the chart through time** |
| Trackpad pinch | Zooms | Zooms. The Mac browser sends a pinch as a scroll with Ctrl held, which the existing check already handles |
| Ctrl/⌘ + scroll | Zooms | Zooms |
| Drag, double-click, + / − / 0 keys, phone pinch | Work | Unchanged |
| Buttons | Reset view | Add **+** and **−** |

Steps: remove `wheelZoom: true`; add a sideways-swipe handler that pans the chart; show a 2-second hint on the first plain scroll ("Pinch or hold ⌘ and scroll to zoom"); update the help text in `index.html:104` and `README.md:129`. Checked by hand in Chrome and Safari with a trackpad, because the unit tests do not cover gestures.

---

## 7. Phase 4 — Bollinger Bands

**What the review found.** The bands are already worked out (`indicators.py:77`) and saved in `tqqq.json`, but they only feed the written findings and the indicator table. Nothing draws them.

**Plan.** Draw the upper and lower bands on the price chart as thin lines with a light fill between them. Draw the middle band only if it differs from the 20-day average line, which will be checked against the data first. Add the band values to the hover tooltip and a legend entry. Off by default, with a switch.

**Done (fifth pull request).** The middle band was checked against the 20-day average: identical in all 482 sessions, so it is not drawn twice. The bands are drawn in the 20-day average's blue, dashed, with a light fill; the price scale stretches to fit them when they are on, so they are never cut off. On by default, as asked; switching them off is remembered, and readers whose saved switches predate the bands get them on. Four browser tests; they fail on the previous code.

---

## 8. Phase 5 — show or hide every indicator

**What the review found.** Volume, RSI, MACD, % below 12-month high, the 3-day low and Volume by price can already be switched on and off (`index.html:96–101`). The 20, 50 and 200-day averages, the support zones and the swing-low markers are always drawn.

**Plan.**
1. Two rows of switches. **On the price chart:** 20 / 50 / 200-day averages, Bollinger Bands, support below price, levels above price, swing-low markers, 3-day low, Volume by price. **Panels below:** Volume, RSI, MACD, % below 12-month high.
2. A **Simple view** button (candles, support zones, 50 and 200-day averages only) and a **Show all** button.
3. Choices are kept between visits, as they already are, and saved in the page address so a shared link opens with the same view.
4. The legend lists only the layers that are switched on.

**Done (eighth pull request), with the test changes in the same pull request, as asked.**

| Item | Done |
|---|---|
| New switches | More support below the price, 20-day, 50-day and 200-day averages, swing lows — 13 switches in all, on by default as before. The nearest level below or at the price (S1) and the nearest above (A1) always stay on the chart; "More support below" and "More levels above" add the rest, so unticking them never hides the level the price is in |
| Two labelled rows | "On the price chart" (9) and "Panels below" (4) |
| Simple view / Show all | Simple view: candles, support below the price, 50 and 200-day averages. Show all: everything |
| Legend | Lists only what is shown |
| Page address | `?show=…` when the layers differ from the defaults; a shared link wins over a reader's saved layers |
| Every-combination tests | Per pull request: 28 settings (all off, all on, each alone, each off alone). Weekly: every combination of the 7 switches that change where things are drawn (four panels, Bollinger Bands, the two kinds of level), each with the other 6 all on and all off — 256 settings. All 8,192 combinations of 13 switches would take about 4 hours |

---

## 9. Test automation (done first, as its own pull request)

The review of the tests found that the page code had no tests at all, and both changes above are mostly page code. That pull request comes first, so the changes can be checked against it. It adds no features.

| Gap found | Closed by |
|---|---|
| `app.js` and `charts.js` (about 1,300 lines) had no tests | Browser tests that open the real page in Chrome, desktop and phone sizes |
| Nothing showed whether a change moved a support level | `tests/golden.test.js`: every level and "what changed" item for 241 sessions, compared with a recorded copy |
| Seven tests read the live data file, which changes daily, and passed without checking anything if it was missing | They read a frozen copy in `tests/fixtures/` |
| `pipeline/snapshot.js` (the nightly job) had no tests | `tests/snapshot.test.js` runs it on a temporary folder |
| `fetch.py` was 66% covered; choosing between data sources was untested | `pipeline/tests/test_sources.py`, no network needed; now 85% |
| Coverage was never measured | Shown per file on each CI run's summary page |

Found while doing this, not changed:
- **Reset view does not return to the opening view.** The chart opens on the chosen window, but Reset view, double-click and the 0 key show all two years of history. A browser test records this as the current behaviour. *Fixed in the third pull request: they now return to the window the chart opened on.*
- `fetch.py:95` uses `datetime.utcfromtimestamp()`, which Python has marked for removal.

## 10. Security checks (its own pull request, after the tests)

**What was checked on 2026-10-25, and what was found.**

| Check | Result |
|---|---|
| Python packages (`pip-audit`, the versions the daily refresh installs today: pandas 3.1.0, numpy 2.5.4, yfinance 1.7.0, requests 2.34.2 and their dependencies) | No known vulnerabilities |
| npm packages (`npm audit`; only the Playwright test tool, 3 packages) | No known vulnerabilities. All 3 have verified registry signatures |
| Text from the data files reaching the page | **One gap.** In "What changed", an item's type was put on the page as HTML, not text. A browser test showed it could add an element to the page. Fixed: it is now escaped like the item's text. The data comes from this repository's own nightly job, so this was not reachable from outside today; it matters for the planned any-ticker feature |
| Node.js version in CI | **Out of date.** The workflows used Node 20, which stopped receiving security fixes on 2026-04-30. Moved to Node 24; all tests pass on it |
| Was anything checking for vulnerabilities? | **No.** No audit step and no Dependabot |
| Do tests run on a pull request and after a merge? | Yes (`tests.yml`). **But nothing stops a merge when they fail**: `main` has no branch protection in the owner's repository |
| GitHub Actions versions | `checkout@v4`, `setup-python@v5`, `setup-node@v4`, `upload-artifact@v4` are each three major versions behind. No known vulnerability; left for Dependabot to propose one at a time |
| Python package versions | `requirements.txt` sets minimum versions only, so each run installs whatever is newest. Not changed here; the weekly audit checks those versions |

**What this pull request adds.**

| Change | Why |
|---|---|
| `.github/workflows/security.yml`: `pip-audit` and `npm audit` on every pull request, after each merge, and every Monday | A new advisory can appear for a package that has not changed, so a weekly run catches it |
| A step that runs the audit on `requests` 2.19.0, which has known vulnerabilities, and stops the run if the audit reports nothing | So a broken audit step cannot pass without anyone noticing |
| `npm audit signatures` | Checks the test tool's packages were signed by the npm registry |
| `.github/dependabot.yml`: weekly update pull requests for the Python packages, the npm test tool and the GitHub Actions | Keeps versions current without anyone having to remember |
| `tests/browser/security.spec.js`: puts HTML and script in every text field of the data files and checks none of it reaches the page as HTML | Covers the gap above, and every other place data text is shown |
| The escaping fix in `docs/js/app.js` (`renderChanges`) | The gap above |
| Node 24 in all three workflows; the test workflow's token limited to reading the repository | Node 20 gets no more security fixes; the tests need no write access |

**Settings the owner has to change** (a pull request cannot change these):
1. **Require the tests to pass before merging:** Settings → Branches → Add rule for `main` → *Require status checks to pass*, and pick "Python and JavaScript unit tests", "Browser tests (the page itself)", "Python packages" and "npm packages (test tooling)".
2. **Turn on vulnerability alerts:** Settings → Code security → *Dependabot alerts*. The config file only drives the weekly update pull requests, not the alerts.

## 11. Remembered settings and readable dates (fourth pull request)

**What was measured.** Every setting was changed, then the page was reopened from its plain address, as from a bookmark:

| Setting | Remembered before | After |
|---|---|---|
| Light/dark theme | Yes | Yes |
| Panels and overlays shown | Yes | Yes |
| Daily / Mondays | Yes | Yes |
| Window (number of months) | **No** — back to 1M | Yes |
| Method settings (swing period, cluster distance, minimum touches) | **No** — back to the defaults | Yes |

The window and method settings lived only in the page address. They are now also kept in the browser. A link that carries settings still wins, so shared links open as sent.

**Why the dates were hard to read.** The date strip's position assumed a 14-pixel gap under the last panel, but the last panel has no gap, so the dates were drawn inside the volume panel, on top of its bars. They were also small, faint grey, and written "09-25".

| Before | After |
|---|---|
| Drawn over the volume bars | Their own strip under the last panel, with a small tick at each date |
| "09-25" | "Sep 25"; the first trading day of a month in bold ("Oct"); January with its year ("Jan 2026") |
| Faint grey, 11px | Darker, 12px |
| Hover tag "2026-10-16" | "Fri, Oct 16, 2026", kept on the chart near the edges |

## 12. Every level from at least the last 200 sessions (sixth pull request)

**What was asked.** Show every support level found in at least the last 200 sessions, and more when the chosen window is longer.

**What the page did.** It found levels only within the chosen window — 21 sessions for 1 month, which on 2026-10-23 had nothing below the price — and listed at most five on each side.

**What it does now.**

| | Before | After |
|---|---|---|
| How far back levels are found | The window (1M = 21 sessions) | At least 200 sessions, or the window if longer (12M = 252) |
| How many are listed | Strongest 5 on each side | Every level found |
| 1M on 2026-10-23 | Nothing below the price; A1, A2 above | S1–S6 below ($66.72 to $37.16); A1, A2 above |
| What the window still sets | — | How much of the chart opens; the period for returns and volatility |
| Levels outside the chart's view | Tags pushed into view beside the wrong price | One edge tag naming the nearest: "▼ S3 $50.18 · 3 more below" |
| The next floor below the current one | Off the chart on 1M | Always on the chart, unless reaching it would stretch the price scale by more than half; then the edge tag names it |

Unchanged: the 1/3/6/12-month comparison panel (it compares those exact lengths), and the daily snapshot and "What changed" (12 months, strongest five each side), so the recorded-output test is identical.

**The next floor below.** Asked for after seeing the chart. Measured on 2026-10-23: bringing S2 ($57.48) into the 1-month view grows the price scale by 35%; for 3 months by 3%; for 6–12 months not at all. A limit of 50% keeps a far-off floor from squashing the candles; past it, the edge tag names the floor instead.

**Chart fixes found by checking every time frame** (all in this pull request; the tests that check every combination are the next one):

| Problem | Cause | Fix |
|---|---|---|
| At 12 months the price tags hid the newest candles | Space after the newest bar was 4 bars: about 15 px at 12 months, less than one tag | Space is the width of the widest tag, in pixels |
| At 1 month a wide empty gap after the newest candle | The same 4 bars: about 320 px at 1 month (132 px measured beyond what the tags need) | As above |
| With close-together levels, tags (including the last price) pushed up to 48 px from their line | Tags were nudged apart in one direction only, and a stack that ran off the panel slid back, price tag included | The last-price tag never moves; others move away from it with a short line back to their level; tags that do not fit are folded into the edge tag, which moves to the left corner when the price tag is in its way |
| On a phone, Mondays view, the first date label cut off at the left edge | No check for the chart's edge | Labels that would be cut off are left out |
| Large empty margins on wide screens | The page stopped at 1180 px wide | 1600 px; text blocks keep their own line-length limits (72–92 characters), so reading is unchanged. The margin each side is 48 px on a desktop (it was 16, which felt tight at the new width) and stays 16 px on a phone. The help under the chart was one long paragraph on seven topics; it is now six short labelled items, 3 columns on a desktop, 2 mid-size, 1 on a phone |

**Found while doing this.** When a level was above or below the visible part of the chart, its tag was pushed into view and sat beside the wrong price (for example "S2 $57.48" next to $85). This was also true of the owner's code when zoomed in. Fixed: such levels get one tag at that edge.

## 13. Tests for every chart combination (seventh pull request, tests only)

**What was asked.** Tests should check the chart's drawing at every time frame, and cover every option and combination. Kept as its own pull request, with no change to the app.

**How many combinations.** 8 chart switches (256 settings) × 5 time frames × Daily/Mondays × light/dark × desktop/phone = 10,240 drawings. Measured: about 90 ms each including the checks, 7.2 minutes on an 8-core Mac. Too slow for every pull request, so:

| When | What is drawn | Time measured |
|---|---|---|
| Every pull request | Every time frame × Daily/Mondays × light/dark × 18 switch settings (all off, all on, each alone, each off alone); custom lengths 21–252; method settings at their limits; clicking each switch at each time frame | about 40 s on an 8-core Mac |
| Every Monday and on demand | The same, with all 256 switch settings | 7.2 min on an 8-core Mac |

**What each drawing is checked for:** no tag over another tag or a candle; the last-price tag exactly on its price; a tag moved off its line joined back to it; every level tagged or counted in an edge tag; date labels not colliding or cut off; no candle cut off at the top or bottom; panels and legend matching the switches; no errors. A self-check removes the room kept for tags and confirms the checker reports the hidden candles.

**What it found.** Run against the earlier code, it found the problems fixed in the sixth pull request: tags pushed off their lines (up to 48 px, the price tag included), the edge tag landing on the price tag, and a date label cut off on a phone. Against the sixth pull request: all 10,240 drawings pass.

## 14. Order of work

| Order | Phase | Size |
|---|---|---|
| 1st | 3 — chart navigation | Small |
| 2nd | 1 — levels above price | Small |
| 3rd | 4 + 5 — Bollinger Bands and switches, done together | Medium |
| 4th | 2 — any ticker | Largest |

Each phase goes on its own branch with its own pull request, and gets a line in the README change log when it is merged.
