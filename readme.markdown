table-cache is a library that caches postgres tables or shards of tables. The
cached tables are updated in real time so your cache will always be up to
date. This will allow very fast (and synchronous!) access to your data while
reducing the load on your database.

Also, the cached data are to be queried via indexes that you provide. You may
provide more than one index per table so that you can query your data in a
flexible way.

You may receive a notification if an index has changed so that this library
could be used as a building block for your real-time data-layer.

This library is built upon [table-access](https://github.com/LuvDaSun/table-access)
and uses the filter api from that library.

# automated tests
NEVER commit something that breaks the build! If you do, you suck. You can
easily prevent this by linking the `test.sh` script as a git `pre-push` or
`pre-commit` hook!

like this:
```bash
ln test.sh .git/hooks/pre-commit
```

If you use a git commit hook for testing, you may also bypass this hook with
the `--no-verify` or `-n` option of git commit, like this:
```bash
git commit -nm'some commit message'
```
