@AGENTS.md

## Testing (don't re-derive)

No Docker on maxi. DB tests: `eval "$(scripts/test-db.sh)" && npm test`. Live auction e2e: `npm run e2e:live`. Details in `scripts/README.md`.
