# Neon Pursuit Imported Art Assets

Neon Pursuit uses original gameplay code with permissively licensed third-party art assets for the current vertical slice.

## Kenney asset packs

The current production models come from Kenney asset packs and are distributed under **CC0 1.0**.

- Car Kit — player, traffic and police vehicle meshes
- City Kit: Roads — road and intersection meshes
- City Kit: Commercial — modular commercial and skyscraper meshes

Original creator: Kenney (`https://kenney.nl/`)

Build source mirror: `bevyengine/bevy_asset_files`

Pinned source commit: `4f2b9f1a7f6064a272fb2d4886e6537bb836605e`

Pinned source root:
`https://raw.githubusercontent.com/bevyengine/bevy_asset_files/4f2b9f1a7f6064a272fb2d4886e6537bb836605e/kenney/`

The source repository includes the original Kenney license files alongside the mirrored packs. `scripts/fetch-assets.mjs` downloads only the required GLB/texture files during development and production builds, validates their file signatures, and writes an asset manifest into the generated `public/assets/kenney` directory.

## Runtime policy

The game does not hotlink these models during play. Build tooling copies pinned assets into the app's public directory before Vite builds the PWA. The built game therefore serves the models from its own origin and can precache them for offline use.

Any future non-CC0 asset must be added here with its author, source, exact license, source revision and any required attribution before it can pass production review.
