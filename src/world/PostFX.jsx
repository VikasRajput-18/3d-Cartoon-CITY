// Cinematic post-processing — Bloom + Vignette + SMAA.
// Desktop-only and fully additive: it never touches scene lights, materials or
// game logic, so removing it returns the game to its exact prior look.
// Rendered conditionally by WorldCanvas; the auto-quality system can drop it.
import { EffectComposer, Bloom, Vignette, SMAA } from '@react-three/postprocessing'

export default function PostFX({ bloom = true }) {
  return (
    <EffectComposer disableNormalPass multisampling={0}>
      <SMAA />
      {bloom ? (
        <Bloom
          intensity={0.4}
          luminanceThreshold={0.9}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      ) : null}
      <Vignette offset={0.3} darkness={0.5} eskil={false} />
    </EffectComposer>
  )
}
