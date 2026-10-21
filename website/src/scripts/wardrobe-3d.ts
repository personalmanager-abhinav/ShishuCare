import * as THREE from 'three';

type GarmentKind = 'soft' | 'structured' | 'knit' | 'quilt';

type Garment = {
  node: HTMLElement;
  image: HTMLImageElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  group: THREE.Group;
  cloth: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  base: Float32Array;
  pointer: THREE.Vector2;
  pointerTarget: THREE.Vector2;
  rotation: THREE.Vector2;
  rotationVelocity: THREE.Vector2;
  intensity: number;
  intensityTarget: number;
  pressed: boolean;
  dragged: boolean;
  down: THREE.Vector2;
  kind: GarmentKind;
};

const kindById: Record<string, GarmentKind> = {
  P101: 'knit',
  P102: 'soft',
  P103: 'knit',
  P104: 'structured',
  P105: 'structured',
  P106: 'quilt',
  P107: 'soft',
};

const physics = {
  soft: { wave: 0.075, twist: 0.22, damping: 0.91, stiffness: 0.045 },
  structured: { wave: 0.035, twist: 0.13, damping: 0.86, stiffness: 0.075 },
  knit: { wave: 0.055, twist: 0.18, damping: 0.89, stiffness: 0.06 },
  quilt: { wave: 0.025, twist: 0.09, damping: 0.83, stiffness: 0.09 },
} satisfies Record<
  GarmentKind,
  { wave: number; twist: number; damping: number; stiffness: number }
>;

function buildScene(node: HTMLElement, image: HTMLImageElement): Promise<Garment> {
  return new Promise((resolve, reject) => {
    const load = () => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
      camera.position.set(0, 0, 4.25);
      const group = new THREE.Group();
      scene.add(group);

      const texture = new THREE.Texture(image);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
      const aspect = image.naturalWidth / image.naturalHeight;
      const geometry = new THREE.PlaneGeometry(2.15 * aspect, 2.15, 28, 34);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        alphaTest: 0.08,
        transparent: true,
        depthWrite: true,
        side: THREE.DoubleSide,
        roughness: 0.82,
        metalness: 0,
      });
      const cloth = new THREE.Mesh(geometry, material);
      cloth.castShadow = true;
      cloth.receiveShadow = true;
      group.add(cloth);

      const back = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          map: texture,
          alphaTest: 0.08,
          transparent: true,
          depthWrite: true,
          side: THREE.BackSide,
          color: 0xe9e1d9,
          roughness: 0.94,
        }),
      );
      back.position.z = -0.035;
      group.add(back);

      scene.add(new THREE.HemisphereLight(0xeef7ff, 0x8b6d56, 1.15));
      const windowLight = new THREE.DirectionalLight(0xfff4e6, 1.7);
      windowLight.position.set(-3, 4, 5);
      scene.add(windowLight);
      const rim = new THREE.DirectionalLight(0xa8d9f5, 0.55);
      rim.position.set(4, 1, 2);
      scene.add(rim);

      const base = new Float32Array(geometry.attributes.position.array as ArrayLike<number>);
      const kind = kindById[node.dataset.wardrobeProduct || ''] || 'soft';
      node.classList.add('model-ready');
      resolve({
        node,
        image,
        scene,
        camera,
        group,
        cloth,
        base,
        pointer: new THREE.Vector2(0.5, 0.45),
        pointerTarget: new THREE.Vector2(0.5, 0.45),
        rotation: new THREE.Vector2(),
        rotationVelocity: new THREE.Vector2(),
        intensity: 0,
        intensityTarget: 0,
        pressed: false,
        dragged: false,
        down: new THREE.Vector2(),
        kind,
      });
    };
    if (image.complete && image.naturalWidth) load();
    else {
      image.addEventListener('load', load, { once: true });
      image.addEventListener('error', () => reject(new Error('Garment image failed')), {
        once: true,
      });
    }
  });
}

function deform(garment: Garment, time: number) {
  const geometry = garment.cloth.geometry;
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const config = physics[garment.kind];
  const rows = 34;
  const columns = 28;
  for (let index = 0; index < positions.count; index++) {
    const xIndex = index % (columns + 1);
    const yIndex = Math.floor(index / (columns + 1));
    const u = xIndex / columns;
    const v = yIndex / rows;
    const anchor = THREE.MathUtils.smoothstep(v, 0.12, 0.42);
    const dx = u - garment.pointer.x;
    const hand = Math.exp(-Math.abs(dx) * 5.2) * anchor;
    const flutter = Math.sin(u * 18 + v * 7 + time * 2.2) * config.wave;
    const cascade = Math.sin(v * 15 - time * 2.8 + u * 3) * config.wave * 0.48;
    const twist = (u - 0.5) * garment.rotation.y * config.twist * anchor;
    positions.setX(index, garment.base[index * 3] + twist + cascade * anchor * garment.intensity);
    positions.setY(
      index,
      garment.base[index * 3 + 1] +
        (garment.pointer.y - 0.5) * hand * 0.12 * garment.intensity -
        Math.abs(garment.rotation.y) * anchor * 0.035,
    );
    positions.setZ(
      index,
      (flutter + cascade + hand * Math.abs(garment.rotation.y) * 0.18) * anchor * garment.intensity,
    );
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

function bindInteraction(garment: Garment) {
  const updatePointer = (event: PointerEvent) => {
    const rect = garment.node.getBoundingClientRect();
    garment.pointerTarget.set(
      THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width, 0, 1),
      THREE.MathUtils.clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1),
    );
  };
  garment.node.addEventListener('pointerenter', (event) => {
    updatePointer(event);
    garment.intensityTarget = 1;
    garment.node.style.setProperty('--lift', '-8px');
    garment.node.style.setProperty('--depth', '28px');
  });
  garment.node.addEventListener('pointerdown', (event) => {
    garment.pressed = true;
    garment.dragged = false;
    garment.down.set(event.clientX, event.clientY);
    garment.intensityTarget = 1.35;
    garment.node.setPointerCapture(event.pointerId);
    updatePointer(event);
  });
  garment.node.addEventListener('pointermove', (event) => {
    updatePointer(event);
    if (!garment.pressed) return;
    garment.dragged ||=
      garment.down.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 7;
    garment.rotationVelocity.y += event.movementX * 0.0025;
    garment.rotationVelocity.x += event.movementY * 0.0014;
  });
  const release = (event: PointerEvent) => {
    garment.pressed = false;
    garment.intensityTarget = garment.node.matches(':hover') ? 1 : 0;
    if (garment.node.hasPointerCapture(event.pointerId))
      garment.node.releasePointerCapture(event.pointerId);
  };
  garment.node.addEventListener('pointerup', release);
  garment.node.addEventListener('pointercancel', release);
  garment.node.addEventListener('pointerleave', () => {
    if (garment.pressed) return;
    garment.intensityTarget = 0;
    garment.pointerTarget.set(0.5, 0.45);
    garment.node.style.setProperty('--lift', '0px');
    garment.node.style.setProperty('--depth', '0px');
  });
  garment.node.addEventListener(
    'click',
    (event) => {
      if (!garment.dragged) return;
      event.preventDefault();
      event.stopPropagation();
      garment.dragged = false;
    },
    true,
  );
}

export async function startWardrobe3D(rail: HTMLElement) {
  if (!window.WebGLRenderingContext || matchMedia('(prefers-reduced-motion: reduce)').matches)
    return;
  const showroom = rail.closest<HTMLElement>('.rail-showroom');
  if (!showroom) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'wardrobe-three-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  showroom.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const garments = (
    await Promise.allSettled(
      [...rail.querySelectorAll<HTMLElement>('.rail-product')].map((node) =>
        buildScene(node, node.querySelector<HTMLImageElement>('img')!),
      ),
    )
  ).flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  garments.forEach(bindInteraction);
  showroom.classList.toggle('three-ready', garments.length > 0);

  let previous = performance.now();
  const render = (time: number) => {
    const step = Math.min(2, (time - previous) / 16.67);
    previous = time;
    const room = showroom.getBoundingClientRect();
    const width = Math.max(1, Math.round(room.width));
    const height = Math.max(1, Math.round(room.height));
    renderer.setSize(width, height, false);
    renderer.clear();
    renderer.setScissorTest(true);
    garments.forEach((garment) => {
      if (garment.node.hidden) return;
      const rect = garment.image.getBoundingClientRect();
      const left = Math.round(rect.left - room.left);
      const bottom = Math.round(room.bottom - rect.bottom);
      const viewWidth = Math.round(rect.width);
      const viewHeight = Math.round(rect.height);
      if (left + viewWidth < 0 || left > width || bottom + viewHeight < 0 || bottom > height)
        return;
      garment.pointer.lerp(garment.pointerTarget, 0.13 * step);
      garment.intensity += (garment.intensityTarget - garment.intensity) * 0.11 * step;
      const config = physics[garment.kind];
      const targetY = garment.pressed
        ? (garment.pointer.x - 0.5) * 1.65
        : (garment.pointer.x - 0.5) * 0.22 * garment.intensity;
      const targetX = garment.pressed ? (garment.pointer.y - 0.5) * -0.4 : 0;
      garment.rotationVelocity.y =
        (garment.rotationVelocity.y + (targetY - garment.rotation.y) * config.stiffness * step) *
        Math.pow(config.damping, step);
      garment.rotationVelocity.x =
        (garment.rotationVelocity.x + (targetX - garment.rotation.x) * config.stiffness * step) *
        Math.pow(config.damping, step);
      garment.rotation.addScaledVector(garment.rotationVelocity, step);
      garment.group.rotation.set(
        garment.rotation.x,
        garment.rotation.y,
        garment.rotation.y * -0.09,
      );
      garment.group.position.z = garment.intensity * 0.16;
      garment.node.style.setProperty('--sway', `${(garment.rotation.y * 4.2).toFixed(3)}deg`);
      deform(garment, time / 1000);
      garment.camera.aspect = viewWidth / viewHeight;
      garment.camera.updateProjectionMatrix();
      renderer.setViewport(left, bottom, viewWidth, viewHeight);
      renderer.setScissor(left, bottom, viewWidth, viewHeight);
      renderer.render(garment.scene, garment.camera);
    });
    renderer.setScissorTest(false);
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
}
