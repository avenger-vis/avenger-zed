# Zed Registry Publication Handoff

Do not publish or open a registry pull request without explicit authorization.
When authorization is given, use this reviewed 0.1 handoff:

1. Confirm the release commit is pushed to a branch of the public
   `https://github.com/avenger-vis/avenger-zed` repository. Zed rejects a
   detached-only submodule commit.
2. Repeat `pnpm install --frozen-lockfile`, `pnpm test`, the manual Zed editing
   smoke matrix, and native Cargo-watch acceptance from a clean checkout.
3. Confirm `extension.toml` still reports `id = "avenger"` and
   `version = "0.1.0"`, and that the root `LICENSE` is present.
4. Fork `zed-industries/extensions` to a personal GitHub account, as recommended
   by Zed so maintainers can push corrections to the submission branch.
5. Add this repository as an HTTPS submodule. SSH submodule URLs are not
   accepted:

   ```sh
   git submodule add https://github.com/avenger-vis/avenger-zed.git extensions/avenger
   git add extensions/avenger
   ```

6. Add the matching registry entry to the top-level `extensions.toml`:

   ```toml
   [avenger]
   submodule = "extensions/avenger"
   version = "0.1.0"
   ```

7. Run `pnpm sort-extensions` in the registry checkout and review both
   `.gitmodules` and `extensions.toml`.
8. Open a pull request to `zed-industries/extensions` that names the tested Zed
   version and platforms and explains that Avenger 0.1 is a configuration-only
   language extension whose runnable intentionally targets an Avenger source
   workspace.

For an update, push the new extension commit first, update the registry
submodule, and change the registry version to exactly match `extension.toml`.
