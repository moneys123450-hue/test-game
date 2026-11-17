import * as THREE from '../vendor/three.module.min.js';

const ramp = new THREE.DataTexture(new Uint8Array([90, 133, 177, 218, 255]), 5, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.generateMipmaps = false; ramp.needsUpdate = true;

export function characterMaterial(source, vertexColors = false) {
  if (source.name === 'Skin warm porcelain' || source.name === 'Face warm shadow') {
    const m = source.clone(); m.vertexColors = vertexColors;
    m.roughness = .88; m.metalness = 0; return m;
  }
  // Preserve metallic highlights on trim; cloth and skin keep stepped shading.
  if (source.metalness > .15) {
    const m = source.clone(); m.vertexColors = vertexColors;
    m.metalness = .55; m.roughness = .32; return m;
  }
  return new THREE.MeshToonMaterial({ name: source.name, color: source.color,
    emissive: source.emissive, emissiveIntensity: source.emissiveIntensity,
    side: source.side, vertexColors, gradientMap: ramp });
}

export function createExpressions(model) {
  const meshes = [];
  model.traverse((o) => { if (o.morphTargetDictionary?.Blink !== undefined) meshes.push(o); });
  const pulse = (t, center, width) => {
    const x = Math.max(0, 1 - Math.abs(t - center) / width);
    return x * x * (3 - 2 * x);
  };
  return {
    supported: meshes.length > 0,
    update(time, phase = 0, forcedBlink = null) {
      const cycle = ((time + phase) % 5.7 + 5.7) % 5.7;
      const blink = forcedBlink ?? Math.max(pulse(cycle, 1.2, .105), pulse(cycle, 4.65, .09), pulse(cycle, 4.9, .085));
      const look = .65 * Math.sin(time * .43 + phase) + .20 * Math.sin(time * 1.17 + phase);
      for (const m of meshes) {
        const d = m.morphTargetDictionary, w = m.morphTargetInfluences;
        w[d.Blink] = blink;
        if (d.LookLeft !== undefined) w[d.LookLeft] = Math.max(0, -look);
        if (d.LookRight !== undefined) w[d.LookRight] = Math.max(0, look);
      }
      return { blink, look };
    },
  };
}
