import * as THREE from 'three';
import { seeded } from './util.js';

function makeCanvasTexture(draw, size = 256) {
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function makeSky(sunDirection) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      horizonColor: { value: new THREE.Color(0xf0c79a) },
      middleColor: { value: new THREE.Color(0xb6c2bb) },
      zenithColor: { value: new THREE.Color(0x4b7895) },
      glowColor: { value: new THREE.Color(0xf4b879) },
      sunDirection: { value: sunDirection.clone() },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 horizonColor;
      uniform vec3 middleColor;
      uniform vec3 zenithColor;
      uniform vec3 glowColor;
      uniform vec3 sunDirection;
      varying vec3 vDirection;
      void main() {
        vec3 direction = normalize(vDirection);
        float elevation = max(direction.y, 0.0);
        vec3 sky = mix(horizonColor, middleColor, smoothstep(0.0, 0.05, elevation));
        sky = mix(sky, zenithColor, smoothstep(0.015, 0.28, elevation));
        float sunAngle = max(dot(direction, normalize(sunDirection)), 0.0);
        float glow = pow(sunAngle, 18.0) * 0.48 + pow(sunAngle, 4.0) * 0.12;
        sky = mix(sky, glowColor, clamp(glow, 0.0, 0.66));
        gl_FragColor = vec4(sky, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(14000, 48, 32), material);
  dome.frustumCulled = false;
  return dome;
}

export function createScenery(scene, seed = 1) {
  const random = seeded(seed ^ 0xc1d3), clouds = [];
  const sunDirection = new THREE.Vector3(-0.42, 0.30, -0.86).normalize();
  scene.background = null;
  scene.fog = new THREE.FogExp2(0xdcbb92, 0.000145);
  const skyDome = makeSky(sunDirection); scene.add(skyDome);

  const cloudTexture = makeCanvasTexture((ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.04, size / 2, size / 2, size * 0.5);
    gradient.addColorStop(0, 'rgba(255,255,255,0.94)');
    gradient.addColorStop(0.28, 'rgba(255,255,255,0.72)');
    gradient.addColorStop(0.62, 'rgba(255,255,255,0.28)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
  });
  for (let i = 0; i < 26; i++) {
    const cluster = new THREE.Group();
    const count = 8 + Math.floor(random() * 7);
    for (let j = 0; j < count; j++) {
      const material = new THREE.SpriteMaterial({
        map: cloudTexture, color: 0xfff0da, transparent: true,
        opacity: 0.45 + random() * 0.25, depthWrite: false,
        blending: THREE.NormalBlending,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.set((random() - 0.5) * 1100, (random() - 0.5) * 100, (random() - 0.5) * 850);
      const size = 380 + random() * 720;
      sprite.scale.set(size, size * (0.38 + random() * 0.24), 1);
      cluster.add(sprite);
    }
    cluster.position.set((random() - 0.5) * 9000, 700 + random() * 1900, (random() - 0.5) * 9000);
    cluster.userData.drift = 0.9 + random() * 1.1;
    scene.add(cluster); clouds.push(cluster);
  }
  for (let i = 0; i < 40; i++) {
    const cirrus = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture, color: 0xfff0da, transparent: true, opacity: 0.18, depthWrite: false }));
    cirrus.position.set((random() - 0.5) * 9000, 3600, (random() - 0.5) * 9000);
    cirrus.scale.set(2400, 260, 1); scene.add(cirrus);
  }

  const sunTexture = makeCanvasTexture((ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size * 0.48);
    gradient.addColorStop(0, 'rgba(255,245,204,1)'); gradient.addColorStop(0.18, 'rgba(255,211,132,.86)');
    gradient.addColorStop(0.48, 'rgba(249,151,82,.3)'); gradient.addColorStop(1, 'rgba(255,166,89,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
  });
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sun.position.copy(sunDirection).multiplyScalar(12000); sun.scale.set(620, 620, 1); scene.add(sun);

  const ventTexture = makeCanvasTexture((ctx, size) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size * 0.49);
    gradient.addColorStop(0, 'rgba(40,40,39,.68)'); gradient.addColorStop(0.5, 'rgba(55,55,51,.32)');
    gradient.addColorStop(1, 'rgba(55,55,51,0)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
  }, 64);
  const ventPuffs = [];
  for (let i = 0; i < 7; i++) {
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: ventTexture, transparent: true, depthWrite: false, opacity: 0.5 - i * 0.045 }));
    puff.position.set(3000 + Math.sin(i * 2.1) * i * 9, 600 + i * 50, -650 + Math.cos(i * 1.7) * i * 8);
    puff.scale.set(82 + i * 8, 94 + i * 10, 1); scene.add(puff); ventPuffs.push(puff);
  }

  const ambient = new THREE.HemisphereLight(0xffe0b8, 0x4a3f33, 0.9); scene.add(ambient);
  const sunlight = new THREE.DirectionalLight(0xffd7a1, 2.0);
  sunlight.position.copy(sunDirection).multiplyScalar(10000); scene.add(sunlight); sunlight.castShadow = false;
  const coolFill = new THREE.DirectionalLight(0x6f8ea8, 0.35);
  coolFill.position.copy(sunDirection).negate().multiplyScalar(8000); scene.add(coolFill);
  return {
    sun, clouds,
    update(dt, state) {
      skyDome.position.copy(state.position);
      sun.position.copy(state.position).addScaledVector(sunDirection, 12000);
      for (const cloud of clouds) { cloud.position.x += cloud.userData.drift * dt; if (cloud.position.x > 5000) cloud.position.x = -5000; }
      for (let i = 0; i < ventPuffs.length; i++) {
        const puff = ventPuffs[i]; puff.position.x += Math.sin(state.missionTime * 0.4 + i) * dt * 3;
        puff.position.y += dt * 0.65; if (puff.position.y > 1020) puff.position.y = 600;
      }
      sun.material.opacity = 0.84 + 0.05 * Math.sin(state.missionTime * 0.13);
    },
  };
}
