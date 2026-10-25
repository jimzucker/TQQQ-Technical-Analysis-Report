#!/usr/bin/env bash
# The daily data lives on its own branch, `market-data`, so main holds only code.
# The page reads it from GitHub's raw-file address; the pipeline writes it here.
#
#   pipeline/data_branch.sh get           check out the branch at .market-data/ and point
#                                         docs/data at its data/ folder (the pipeline and a
#                                         local preview then use docs/data as before)
#   pipeline/data_branch.sh put "message" commit docs/data to the branch and push it
#
# The first `get` in a repository without the branch creates it from main's last copy of
# docs/data, with no shared history, and `put` then publishes it even if nothing changed.
# Prints "created=true|false" for the workflows ($GITHUB_OUTPUT when set).
set -euo pipefail

BRANCH="${DATA_BRANCH:-market-data}"
DIR=.market-data
cd "$(git rev-parse --show-toplevel)"

say() { echo "data branch: $*"; }

get() {
  local created=false
  rm -rf "$DIR"; git worktree prune
  if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null; then
    git fetch --quiet origin "$BRANCH:refs/remotes/origin/$BRANCH"
    git worktree add --quiet -B "$BRANCH" "$DIR" "origin/$BRANCH"
    say "checked out $BRANCH at $(git -C "$DIR" log -1 --format='%h (%s)')"
  else
    # main's last copy: HEAD if docs/data is still there, else the commit before it was removed
    local src=HEAD
    if ! git cat-file -e HEAD:docs/data/tickers.json 2>/dev/null; then
      local gone
      gone=$(git rev-list -n 1 HEAD -- docs/data/tickers.json)
      if [ -z "$gone" ]; then say "STOPPED: no $BRANCH branch and no docs/data in main's history to start it from"; exit 1; fi
      src="$gone^"
    fi
    git worktree add --quiet --orphan -b "$BRANCH" "$DIR"
    git archive "$src" docs/data | tar -x --strip-components=1 -C "$DIR"
    created=true
    say "created $BRANCH from main's docs/data at $(git rev-parse --short "$src")"
  fi
  [ -f "$DIR/data/tickers.json" ] || { say "STOPPED: $BRANCH has no data/tickers.json"; exit 1; }
  # docs/data -> the branch's data/ (a real docs/data folder is only replaced if git tracks
  # none of it, so a checkout from before the move keeps its files)
  if [ -d docs/data ] && [ ! -L docs/data ]; then
    if [ -n "$(git ls-files docs/data)" ]; then say "STOPPED: docs/data is still tracked on this branch"; exit 1; fi
    rm -rf docs/data
  fi
  ln -sfn "../$DIR/data" docs/data
  say "docs/data now reads and writes $DIR/data ($(ls "$DIR/data" | wc -l | tr -d ' ') entries)"
  echo "created=$created" | tee -a "${GITHUB_OUTPUT:-/dev/null}"
}

put() {
  local message="${1:?usage: data_branch.sh put \"commit message\"}"
  [ -d "$DIR" ] || { say "STOPPED: run 'get' first"; exit 1; }
  git -C "$DIR" add -A data
  if git -C "$DIR" diff --cached --quiet && git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null; then
    say "nothing changed"; return 0
  fi
  git -C "$DIR" commit --quiet -m "$message" --allow-empty
  git -C "$DIR" push --quiet origin "HEAD:refs/heads/$BRANCH"
  say "pushed $(git -C "$DIR" log -1 --format='%h (%s)') to $BRANCH"
}

case "${1:-}" in
  get) get ;;
  put) shift; put "$@" ;;
  *) echo "usage: pipeline/data_branch.sh get | put \"message\"" >&2; exit 2 ;;
esac
