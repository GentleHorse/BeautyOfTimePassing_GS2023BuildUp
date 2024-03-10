import * as THREE from "three";
import * as dat from "lil-gui";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry";
import { gsap } from "gsap";
import glassBrickLightVertexShader from "./shaders/glassBricks/vertex.glsl";
import glassBrickLightFragmentShader from "./shaders/glassBricks/fragment.glsl";
import projectorLightVertex from "./shaders/projector/vertex.glsl";
import projectorLightFragment from "./shaders/projector/fragment.glsl";

/**
 * Loaders ============================================================
 */
let isSceneReady = false;
const loadingBarElement = document.querySelector(".loading-bar");
const loadingManager = new THREE.LoadingManager(
  // Loaded
  () => {
    // Wait a little
    window.setTimeout(() => {
      // Animate overlay
      gsap.to(overlayMaterial.uniforms.uAlpha, {
        duration: 3,
        value: 0,
        delay: 1,
      });

      // Update loadingBarElement
      loadingBarElement.classList.add("ended");
      loadingBarElement.style.transform = "";
    }, 500);

    window.setTimeout(() => {
      isSceneReady = true;
    }, 2000);
  },

  // Progress
  (itemUrl, itemsLoaded, itemsTotal) => {
    // Calculate the progress and update the loadingBarElement
    const progressRatio = itemsLoaded / itemsTotal;
    loadingBarElement.style.transform = `scaleX(${progressRatio})`;
  }
);

// Draco loader
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("draco/");

const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.setDRACOLoader(dracoLoader);

const cubeTextureLoader = new THREE.CubeTextureLoader(loadingManager);
const textureLoader = new THREE.TextureLoader();

/**
 * Base =================================================================
 */
// Debug
// const gui = new dat.GUI({ width: 300 });
// gui.close();

// Debug
const debugObject = {};

// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

/**
 * Overlay ==============================================================
 */
const overlayGeometry = new THREE.PlaneGeometry(2, 2, 1, 1);
const overlayMaterial = new THREE.ShaderMaterial({
  // wireframe: true,
  transparent: true,
  uniforms: {
    uAlpha: { value: 1 },
  },
  vertexShader: `
        void main()
        {
            gl_Position = vec4(position, 1.0);
        }
    `,
  fragmentShader: `
        uniform float uAlpha;

        void main()
        {
            gl_FragColor = vec4(0.0, 0.0, 0.0, uAlpha);
        }
    `,
});
const overlay = new THREE.Mesh(overlayGeometry, overlayMaterial);
scene.add(overlay);

/**
 * Update all materials ====================================================
 */
const updateAllMaterials = () => {
  scene.traverse((child) => {
    if (
      child instanceof THREE.Mesh &&
      child.material instanceof THREE.MeshStandardMaterial
    ) {
      child.material.envMapIntensity = debugObject.envMapIntensity;
      child.material.needsUpdate = true;
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
};

/**
 * Textures =============================================================================================
 */

// matcap texture
// image dimension is 256px x 256px
const matcapURLBase = "/textures/matcaps/";

// -- text
let matcapIndex = 3;
const matcapImage = new Image();
matcapImage.src = matcapURLBase + matcapIndex + ".png";

const matcapTexture = new THREE.Texture(matcapImage);
matcapImage.onload = () => {
  matcapTexture.needsUpdate = true;
};

// texture for gltf model
const bakedTexture = textureLoader.load(
  "./models/BeautyOfTimePassing/baked.jpg"
);
bakedTexture.flipY = false;
bakedTexture.colorSpace = THREE.SRGBColorSpace;

// environment texture
const hdrEquirect = new RGBELoader().load(
  "./textures/environmentMaps/empty_warehouse_01_2k.hdr",
  () => {
    hdrEquirect.mapping = THREE.EquirectangularReflectionMapping;
  }
);

// normal texture for glass bricks
const organicNormalTexture = textureLoader.load(
  "/textures/glassNormal/organic_02.jpg"
);


/**
 * Models =====================================================================
 */
const gltfModelParams = {};
gltfModelParams.position = { x: 1.5, y: -1, z: 0 };

// baked material
const bakedMaterial = new THREE.MeshBasicMaterial({ map: bakedTexture });

// projector light material
const projectorLightMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColorStart: { value: new THREE.Color(0x027a00) },
    uColorEnd: { value: new THREE.Color(0x1b9dee) },
  },
  vertexShader: projectorLightVertex,
  fragmentShader: projectorLightFragment,
});

// glass brick material
const glassBrickMaterial = new THREE.MeshPhysicalMaterial({
  roughness: 0.3,
  transmission: 0.8,
  thickness: 1.5,
  envMap: hdrEquirect,
  side: THREE.DoubleSide,
  normalMap: organicNormalTexture,
});

// glass brick light material
const glassBrickLightMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColorStart: { value: new THREE.Color(0x027a00) },
    uColorEnd: { value: new THREE.Color(0x1b9dee) },
  },
  vertexShader: glassBrickLightVertexShader,
  fragmentShader: glassBrickLightFragmentShader,
});

const generateGltfModel = () => {
  gltfLoader.load(
    "/models/BeautyOfTimePassingNew/bakedWithoutGlassBricks/glb/BeautyOfTimePassing.glb",
    (gltf) => {
      gltf.scene.scale.set(0.1, 0.1, 0.1);
      gltf.scene.position.set(
        gltfModelParams.position.x,
        gltfModelParams.position.y,
        gltfModelParams.position.z
      );
      gltf.scene.rotation.y = Math.PI * 0.5;

      const bakedMesh = gltf.scene.children.find(
        (child) => child.name === "baked"
      );
      const projectorLightAMesh = gltf.scene.children.find(
        (child) => child.name === "projectorLightA"
      );
      const projectorLightBMesh = gltf.scene.children.find(
        (child) => child.name === "projectorLightB"
      );
      const glassBrickLightMesh = gltf.scene.children.find(
        (child) => child.name === "glassBrickLights"
      );

      bakedMesh.material = bakedMaterial;
      projectorLightAMesh.material = projectorLightMaterial;
      projectorLightBMesh.material = projectorLightMaterial;
      glassBrickLightMesh.material = glassBrickLightMaterial;

      scene.add(gltf.scene);

      updateAllMaterials();
    }
  );
};

generateGltfModel();

/**
 * Laptop screens ==========================================================
 */

// handling scenery video
const clearVideo = document.createElement("video");
clearVideo.src = "/videos/clear.mp4";
clearVideo.crossOrigin = "Anonymous";
clearVideo.loop = true;
clearVideo.muted = true;
clearVideo.play();
const clearSceneryTexture = new THREE.VideoTexture(clearVideo);
clearSceneryTexture.colorSpace = THREE.SRGBColorSpace;

const rainVideo = document.createElement("video");
rainVideo.src = "/videos/rain.mp4";
rainVideo.crossOrigin = "Anonymous";
rainVideo.loop = true;
rainVideo.muted = true;
rainVideo.play();
const rainSceneryTexture = new THREE.VideoTexture(rainVideo);
rainSceneryTexture.colorSpace = THREE.SRGBColorSpace;

// params
const laptopScreenParams = {
  screen_00: {
    video: clearSceneryTexture,
    scale: 0.1,
    position_x: -1.631,
    position_y: -0.247,
    position_z: -0.583,
    rotation_x: 0,
    rotation_y: 2.13,
    rotation_z: 0,
  },
  screen_01: {
    video: rainSceneryTexture,
    scale: 0.1,
    position_x: -1.44,
    position_y: -0.247,
    position_z: -2.419,
    rotation_x: 0,
    rotation_y: 2.13,
    rotation_z: 0,
  },
};

// laptop screens
const laptopScreen_00 = new THREE.Mesh(
  new THREE.PlaneGeometry(2.53, 1.65),
  new THREE.MeshBasicMaterial({ map: laptopScreenParams.screen_00.video })
);
laptopScreen_00.scale.set(
  laptopScreenParams.screen_00.scale,
  laptopScreenParams.screen_00.scale,
  laptopScreenParams.screen_00.scale
);
laptopScreen_00.position.set(
  laptopScreenParams.screen_00.position_x,
  laptopScreenParams.screen_00.position_y,
  laptopScreenParams.screen_00.position_z
);
laptopScreen_00.rotation.set(
  laptopScreenParams.screen_00.rotation_x,
  laptopScreenParams.screen_00.rotation_y,
  laptopScreenParams.screen_00.rotation_z
);
scene.add(laptopScreen_00);

const laptopScreen_01 = new THREE.Mesh(
  new THREE.PlaneGeometry(2.53, 1.65),
  new THREE.MeshBasicMaterial({ map: laptopScreenParams.screen_01.video })
);
laptopScreen_01.scale.set(
  laptopScreenParams.screen_01.scale,
  laptopScreenParams.screen_01.scale,
  laptopScreenParams.screen_01.scale
);
laptopScreen_01.position.set(
  laptopScreenParams.screen_01.position_x,
  laptopScreenParams.screen_01.position_y,
  laptopScreenParams.screen_01.position_z
);
laptopScreen_01.rotation.set(
  laptopScreenParams.screen_01.rotation_x,
  laptopScreenParams.screen_01.rotation_y,
  laptopScreenParams.screen_01.rotation_z
);
scene.add(laptopScreen_01);

/**
 * Glass Bricks ==========================================================
 */
const glassBrickParams = {
  scale: 0.099,
  size: {
    width: 0.8,
    length: 1.9,
    depth: 0.9,
  },
};
const glassBrickGeometry = new THREE.BoxGeometry(
  glassBrickParams.size.width,
  glassBrickParams.size.length,
  glassBrickParams.size.depth
);

// group 00
let glassBrickGroupPosition_00 = 0;
let glassBricksMeshGroup_00 = new THREE.Group();
scene.add(glassBricksMeshGroup_00);
for (let i = 0; i < 10; i++) {
  const glassBrickMesh = new THREE.Mesh(glassBrickGeometry, glassBrickMaterial);
  glassBrickMesh.scale.set(
    glassBrickParams.scale,
    glassBrickParams.scale,
    glassBrickParams.scale
  );
  glassBrickMesh.position.set(0, glassBrickGroupPosition_00, 0);
  glassBricksMeshGroup_00.add(glassBrickMesh);

  glassBrickGroupPosition_00 +=
    glassBrickParams.size.length * 1.03 * glassBrickParams.scale;
}

glassBricksMeshGroup_00.position.set(1.5, -0.9, 0);

// group 01
let glassBrickGroupPosition_01 = 0;
let glassBricksMeshGroup_01 = new THREE.Group();
scene.add(glassBricksMeshGroup_01);
for (let i = 0; i < 10; i++) {
  const glassBrickMesh = new THREE.Mesh(glassBrickGeometry, glassBrickMaterial);
  glassBrickMesh.scale.set(
    glassBrickParams.scale,
    glassBrickParams.scale,
    glassBrickParams.scale
  );
  glassBrickMesh.position.set(0, glassBrickGroupPosition_01, 0);
  glassBricksMeshGroup_01.add(glassBrickMesh);

  glassBrickGroupPosition_01 +=
    glassBrickParams.size.length * 1.03 * glassBrickParams.scale;
}

glassBricksMeshGroup_01.position.set(0.597, -0.9, -0.654);
glassBricksMeshGroup_01.rotation.y = 2.736;

/**
 * Points of interest ==========================================================
 */

const raycaster = new THREE.Raycaster();

const pointsOfInterestLocationsParams = {
  pointsOfInterest_00: { x: 2.0, y: 0.3, z: -0.05 },
  pointsOfInterest_01: { x: 0.82, y: 0.57, z: -0.65 },
  pointsOfInterest_02: { x: 1.06, y: 0.35, z: -1.5 },
  pointsOfInterest_03: { x: -1.49, y: -0.4, z: -2.01 },
  pointsOfInterest_04: { x: -1.36, y: -0.316, z: -2.403 },
};

// points of interests
const offset = 0.1;
const points = [
  {
    position: new THREE.Vector3(
      pointsOfInterestLocationsParams.pointsOfInterest_00.x,
      pointsOfInterestLocationsParams.pointsOfInterest_00.y,
      pointsOfInterestLocationsParams.pointsOfInterest_00.z
    ),
    element: document.querySelector(".point-0"),
  },
  {
    position: new THREE.Vector3(
      pointsOfInterestLocationsParams.pointsOfInterest_01.x,
      pointsOfInterestLocationsParams.pointsOfInterest_01.y,
      pointsOfInterestLocationsParams.pointsOfInterest_01.z
    ),
    element: document.querySelector(".point-1"),
  },
  {
    position: new THREE.Vector3(
      pointsOfInterestLocationsParams.pointsOfInterest_02.x,
      pointsOfInterestLocationsParams.pointsOfInterest_02.y,
      pointsOfInterestLocationsParams.pointsOfInterest_02.z
    ),
    element: document.querySelector(".point-2"),
  },
  {
    position: new THREE.Vector3(
      pointsOfInterestLocationsParams.pointsOfInterest_03.x,
      pointsOfInterestLocationsParams.pointsOfInterest_03.y,
      pointsOfInterestLocationsParams.pointsOfInterest_03.z
    ),
    element: document.querySelector(".point-3"),
  },
  {
    position: new THREE.Vector3(
      pointsOfInterestLocationsParams.pointsOfInterest_04.x,
      pointsOfInterestLocationsParams.pointsOfInterest_04.y,
      pointsOfInterestLocationsParams.pointsOfInterest_04.z
    ),
    element: document.querySelector(".point-4"),
  },
];

/**
 * Sizes =======================================================================
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/**
 * Camera =====================================================================
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100
);
camera.position.set(2.916, 1.876, -2.783);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

// GUI
// const cameraFolder = gui.addFolder("camera");
// cameraFolder.close();
// cameraFolder.add(camera.position, "x", -10, 10, 0.001);
// cameraFolder.add(camera.position, "y", -10, 10, 0.001);
// cameraFolder.add(camera.position, "z", -10, 10, 0.001);

/**
 * Renderer ====================================================================
 */
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.useLegacyLights = false;
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

/**
 * Animate =====================================================================
 */
const clock = new THREE.Clock();

const tick = () => {
  const elapsedTime = clock.getElapsedTime();

  // Update controls
  controls.update();

  // Update Shader Materials
  glassBrickLightMaterial.uniforms.uTime.value = elapsedTime;
  projectorLightMaterial.uniforms.uTime.value = elapsedTime;

  if (isSceneReady) {
    // Go through each point
    for (const point of points) {
      const screenPosition = point.position.clone();
      screenPosition.project(camera);

      raycaster.setFromCamera(screenPosition, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length === 0) {
        point.element.classList.add("visible");
      } else {
        const intersectionDistance = intersects[0].distance;
        const pointDistance = point.position.distanceTo(camera.position);

        if (intersectionDistance < pointDistance) {
          point.element.classList.remove("visible");
        } else {
          point.element.classList.add("visible");
        }
      }

      const translateX = screenPosition.x * sizes.width * 0.5;
      const translateY = -screenPosition.y * sizes.height * 0.5;
      point.element.style.transform = `translate(${translateX}px, ${translateY}px)`;
    }
  }

  // Render
  renderer.render(scene, camera);

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
};

tick();
