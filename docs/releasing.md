# Releasing

A release is a `vX.Y.Z` tag on `main`. Pushing the tag runs the
[Release workflow](../.github/workflows/release.yml), which builds both images
for `linux/amd64` and pushes them to GitHub Container Registry, tagged `X.Y.Z`
(no `v`):

- `ghcr.io/stefan-stefanooov/stock-history-api:X.Y.Z`
- `ghcr.io/stefan-stefanooov/stock-history-web:X.Y.Z`

There is no `latest` tag: the homelab pins exact versions. The images carry the
OCI labels `org.opencontainers.image.source` (this repository),
`org.opencontainers.image.revision` (the tagged commit) and
`org.opencontainers.image.version` (`X.Y.Z`).

The version lives only in the tag. The `version` fields in the `package.json`
files are not used and are not bumped.

## Cutting a release

1. Check that CI on `main` is green and that `main` holds what should ship:

   ```sh
   git switch main && git pull
   gh run list --workflow ci.yml --branch main --limit 1
   ```

2. Pick the version with [semver](https://semver.org): `Z` for fixes, `Y` for
   new features, `X` for a breaking API change. A prerelease such as
   `v1.2.0-rc.1` also works and publishes `1.2.0-rc.1`.

3. Tag `main` and push the tag:

   ```sh
   git tag -a v1.2.3 -m "v1.2.3" origin/main
   git push origin v1.2.3
   ```

4. Watch the workflow. Both images must publish:

   ```sh
   gh run watch "$(gh run list --workflow release.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
   ```

5. Check the published images:

   ```sh
   docker pull ghcr.io/stefan-stefanooov/stock-history-api:1.2.3
   docker inspect --format '{{json .Config.Labels}}' ghcr.io/stefan-stefanooov/stock-history-api:1.2.3
   ```

6. Deploy: open a PR in the
   [homelab repo](https://github.com/stefan-stefanooov/homelab) that bumps
   both image tags to `X.Y.Z` (in `workloads/stock-history/api.yaml` and
   `web.yaml`). Merging it to homelab `main` is the deploy:
   Argo CD syncs it right away. Then check that the Application is Synced and
   Healthy: `kubectl -n argocd get applications`.

## The packages are public

The homelab pulls without credentials, so both packages must stay public. They
were public from the first push (`v0.1.0`); no setting needed changing. To check,
pull anonymously as in step 5 after `docker logout ghcr.io`. If a pull ever asks
for credentials, the owner sets the package back to public under **Danger Zone**
→ **Change visibility** in its settings:

- <https://github.com/users/stefan-stefanooov/packages/container/stock-history-api/settings>
- <https://github.com/users/stefan-stefanooov/packages/container/stock-history-web/settings>

## When something goes wrong

- **One image failed to publish**: fix the cause (for example a GHCR outage), then
  rerun only the failed job: `gh run rerun <run-id> --failed`. Both jobs always run
  to the end, so the run shows which one failed.
- **The release is broken**: never move or reuse a published tag, because
  something may already have pulled it. Fix on `main` and release the next patch
  version.
- **A tag was pushed by mistake** and its run has not published anything:
  cancel the run (`gh run cancel <run-id>`), then delete the tag
  (`git push origin :refs/tags/vX.Y.Z` and `git tag -d vX.Y.Z`).
