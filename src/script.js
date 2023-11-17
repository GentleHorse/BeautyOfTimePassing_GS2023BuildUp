import * as THREE from "three";
import * as dat from "lil-gui";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry";
import { gsap } from "gsap";
import Stats from "stats.js";
import glassBrickLightVertexShader from "./shaders/glassBricks/vertex.glsl";
import glassBrickLightFragmentShader from "./shaders/glassBricks/fragment.glsl";
import projectorLightVertex from "./shaders/projector/vertex.glsl";
import projectorLightFragment from "./shaders/projector/fragment.glsl";

THREE.ColorManagement.enabled = false;

/**
 * Stats =======================================================
 */
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

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
const gui = new dat.GUI({ width: 400 });

// Debug
const debugObject = {};

// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

// AxesHelper
const axesHelper = new THREE.AxesHelper(3);
axesHelper.visible = false;
const helperFolder = gui.addFolder("Helper");
helperFolder.close();
helperFolder.add(axesHelper, "visible");
scene.add(axesHelper);

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
      // child.material.envMap = environmentMap
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

/**
 * 3D Text ====================================================================
 */
const fontLoader = new FontLoader();

fontLoader.load("/fonts/Vollkorn_Regular.json", (font) => {
  const textGeometry = new TextGeometry("Beauty of Time Passing", {
    font: font,
    size: 0.1,
    height: 0.2,
    curveSegments: 5,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.02,
    bevelOffset: 0,
    bevelSegments: 4,
  });

  textGeometry.center();

  const textMaterial = new THREE.MeshMatcapMaterial();
  textMaterial.matcap = matcapTexture;
  const text = new THREE.Mesh(textGeometry, textMaterial);
  text.rotation.set(0, Math.PI, 0);
  text.position.set(2.1, 1.6, 0.08);
  const textFolder = gui.addFolder("3D Text");
  textFolder.close();
  textFolder.add(text.position, "x", -10, 10, 0.001).name("PosX");
  textFolder.add(text.position, "y", -10, 10, 0.001).name("PosY");
  textFolder.add(text.position, "z", -10, 10, 0.001).name("PosZ");
  textFolder.add(text.rotation, "x", -Math.PI, Math.PI, 0.001).name("RotateX");
  textFolder.add(text.rotation, "y", -Math.PI, Math.PI, 0.001).name("RotateY");
  textFolder.add(text.rotation, "z", -Math.PI, Math.PI, 0.001).name("RotateZ");
  scene.add(text);
});

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
  },
  vertexShader: projectorLightVertex,
  fragmentShader: projectorLightFragment,
});

// glass brick material
const glassBrickMaterial = new THREE.MeshPhysicalMaterial({
  roughness: 0.15,
  transmission: 1,
  thickness: 0.5,
  envMap: hdrEquirect,
  side: THREE.DoubleSide,
});

// glass brick light material
const glassBrickLightMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColorStart: { value: new THREE.Color(0x1d62ed) },
    uColorEnd: { value: new THREE.Color(0x039801) },
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

      bakedMesh.material = bakedMaterial;
      projectorLightAMesh.material = projectorLightMaterial;
      projectorLightBMesh.material = projectorLightMaterial;

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

// GUI
const laptopScreenFolder_00 = gui.addFolder("laptop_00");
laptopScreenFolder_00.close();
laptopScreenFolder_00
  .add(laptopScreenParams.screen_00, "scale", 0, 1, 0.001)
  .onChange(() => {
    laptopScreen_00.scale.x = laptopScreenParams.screen_00.scale;
    laptopScreen_00.scale.y = laptopScreenParams.screen_00.scale;
    laptopScreen_00.scale.z = laptopScreenParams.screen_00.scale;
  });
laptopScreenFolder_00
  .add(laptopScreenParams.screen_00, "position_x", -10, 10, 0.0001)
  .onChange(() => {
    laptopScreen_00.position.x = laptopScreenParams.screen_00.position_x;
  });
laptopScreenFolder_00
  .add(laptopScreenParams.screen_00, "position_y", -10, 10, 0.0001)
  .onChange(() => {
    laptopScreen_00.position.y = laptopScreenParams.screen_00.position_y;
  });
laptopScreenFolder_00
  .add(laptopScreenParams.screen_00, "position_z", -10, 10, 0.0001)
  .onChange(() => {
    laptopScreen_00.position.z = laptopScreenParams.screen_00.position_z;
  });
laptopScreenFolder_00
  .add(laptopScreenParams.screen_00, "rotation_x", -10, 10, 0.001)
  .onChange(() => {
    laptopScreen_00.rotation.x = laptopScreenParams.screen_00.rotation_x;
  });
laptopScreenFolder_00
  .add(laptopScreenParams.screen_00, "rotation_y", -10, 10, 0.001)
  .onChange(() => {
    laptopScreen_00.rotation.y = laptopScreenParams.screen_00.rotation_y;
  });
laptopScreenFolder_00
  .add(laptopScreenParams.screen_00, "rotation_z", -10, 10, 0.001)
  .onChange(() => {
    laptopScreen_00.rotation.z = laptopScreenParams.screen_00.rotation_z;
  });

const laptopScreenFolder_01 = gui.addFolder("laptop_01");
laptopScreenFolder_01.close();
laptopScreenFolder_01
  .add(laptopScreenParams.screen_01, "scale", 0, 1, 0.001)
  .onChange(() => {
    laptopScreen_01.scale.x = laptopScreenParams.screen_01.scale;
    laptopScreen_01.scale.y = laptopScreenParams.screen_01.scale;
    laptopScreen_01.scale.z = laptopScreenParams.screen_01.scale;
  });
laptopScreenFolder_01
  .add(laptopScreenParams.screen_01, "position_x", -10, 10, 0.001)
  .onChange(() => {
    laptopScreen_01.position.x = laptopScreenParams.screen_01.position_x;
  });
laptopScreenFolder_01
  .add(laptopScreenParams.screen_01, "position_y", -10, 10, 0.001)
  .onChange(() => {
    laptopScreen_01.position.y = laptopScreenParams.screen_01.position_y;
  });
laptopScreenFolder_01
  .add(laptopScreenParams.screen_01, "position_z", -10, 10, 0.001)
  .onChange(() => {
    laptopScreen_01.position.z = laptopScreenParams.screen_01.position_z;
  });
laptopScreenFolder_01
  .add(laptopScreenParams.screen_01, "rotation_x", -10, 10, 0.001)
  .onChange(() => {
    laptopScreen_01.rotation.x = laptopScreenParams.screen_01.rotation_x;
  });
laptopScreenFolder_01
  .add(laptopScreenParams.screen_01, "rotation_y", -10, 10, 0.001)
  .onChange(() => {
    laptopScreen_01.rotation.y = laptopScreenParams.screen_01.rotation_y;
  });
laptopScreenFolder_01
  .add(laptopScreenParams.screen_01, "rotation_z", -10, 10, 0.001)
  .onChange(() => {
    laptopScreen_01.rotation.z = laptopScreenParams.screen_01.rotation_z;
  });

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
)

// group 00
let glassBrickGroupPosition_00 = 0;
let glassBricksMeshGroup_00 = new THREE.Group();
scene.add(glassBricksMeshGroup_00);
for (let i = 0; i < 10; i++) {
  const glassBrickMesh = new THREE.Mesh(
    glassBrickGeometry,
    glassBrickMaterial
  );
  glassBrickMesh.scale.set(
    glassBrickParams.scale,
    glassBrickParams.scale,
    glassBrickParams.scale
  );
  glassBrickMesh.position.set(0, glassBrickGroupPosition_00, 0);
  glassBricksMeshGroup_00.add(glassBrickMesh);

  glassBrickGroupPosition_00 += glassBrickParams.size.length * 1.03 * glassBrickParams.scale;
}

glassBricksMeshGroup_00.position.set(1.5, -0.9, 0);

const glassBricksFolder_00 = gui.addFolder("glassBricks_00");
glassBricksFolder_00.close();
glassBricksFolder_00
  .add(glassBricksMeshGroup_00.position, "x", -10, 10, 0.001)
  .name("posX");
glassBricksFolder_00
  .add(glassBricksMeshGroup_00.position, "y", -10, 10, 0.001)
  .name("posY");
glassBricksFolder_00
  .add(glassBricksMeshGroup_00.position, "z", -10, 10, 0.001)
  .name("posZ");
glassBricksFolder_00
  .add(glassBricksMeshGroup_00.rotation, "y", 0, Math.PI, 0.001)
  .name("rotate");

// group 01
let glassBrickGroupPosition_01 = 0;
let glassBricksMeshGroup_01 = new THREE.Group();
scene.add(glassBricksMeshGroup_01);
for (let i = 0; i < 10; i++) {
  const glassBrickMesh = new THREE.Mesh(
    glassBrickGeometry,
    glassBrickMaterial
  );
  glassBrickMesh.scale.set(
    glassBrickParams.scale,
    glassBrickParams.scale,
    glassBrickParams.scale
  );
  glassBrickMesh.position.set(0, glassBrickGroupPosition_01, 0);
  glassBricksMeshGroup_01.add(glassBrickMesh);

  glassBrickGroupPosition_01 += glassBrickParams.size.length * 1.03 * glassBrickParams.scale;
}

glassBricksMeshGroup_01.position.set(0.597, -0.9, -0.654);
glassBricksMeshGroup_01.rotation.y = 2.736;

const glassBricksFolder_01 = gui.addFolder("glassBricks_01");
glassBricksFolder_01.close();
glassBricksFolder_01
  .add(glassBricksMeshGroup_01.position, "x", -10, 10, 0.001)
  .name("posX");
glassBricksFolder_01
  .add(glassBricksMeshGroup_01.position, "y", -10, 10, 0.001)
  .name("posY");
glassBricksFolder_01
  .add(glassBricksMeshGroup_01.position, "z", -10, 10, 0.001)
  .name("posZ");
glassBricksFolder_01
  .add(glassBricksMeshGroup_01.rotation, "y", 0, Math.PI, 0.001)
  .name("rotate");


/**
 * Points of interest ==========================================================
 */

const raycaster = new THREE.Raycaster();

const pointsOfInterestLocationsParams = {
  pointsOfInterest_00: { x: 1.8, y: 0.3, z: -0.16 },
  pointsOfInterest_01: { x: 0.82, y: 0.57, z: -0.65 },
  pointsOfInterest_02: { x: 1.06, y: -0.3, z: -1.15 },
  pointsOfInterest_03: { x: -1.4, y: 0.1, z: -1.8 },
  pointsOfInterest_04: { x: -1.15, y: -0.16, z: -2.6 },
};

// test meshes
const testMesh_00 = new THREE.Mesh(
  new THREE.SphereGeometry(0.03, 10, 10),
  new THREE.MeshNormalMaterial()
);
testMesh_00.position.set(
  pointsOfInterestLocationsParams.pointsOfInterest_00.x,
  pointsOfInterestLocationsParams.pointsOfInterest_00.y,
  pointsOfInterestLocationsParams.pointsOfInterest_00.z
);
scene.add(testMesh_00);

const testMesh_01 = new THREE.Mesh(
  new THREE.SphereGeometry(0.03, 10, 10),
  new THREE.MeshNormalMaterial()
);
testMesh_01.position.set(
  pointsOfInterestLocationsParams.pointsOfInterest_01.x,
  pointsOfInterestLocationsParams.pointsOfInterest_01.y,
  pointsOfInterestLocationsParams.pointsOfInterest_01.z
);
scene.add(testMesh_01);

const testMesh_02 = new THREE.Mesh(
  new THREE.SphereGeometry(0.03, 10, 10),
  new THREE.MeshNormalMaterial()
);
testMesh_02.position.set(
  pointsOfInterestLocationsParams.pointsOfInterest_02.x,
  pointsOfInterestLocationsParams.pointsOfInterest_02.y,
  pointsOfInterestLocationsParams.pointsOfInterest_02.z
);
scene.add(testMesh_02);

const testMesh_03 = new THREE.Mesh(
  new THREE.SphereGeometry(0.03, 10, 10),
  new THREE.MeshNormalMaterial()
);
testMesh_03.position.set(
  pointsOfInterestLocationsParams.pointsOfInterest_03.x,
  pointsOfInterestLocationsParams.pointsOfInterest_03.y,
  pointsOfInterestLocationsParams.pointsOfInterest_03.z
);
scene.add(testMesh_03);

const testMesh_04 = new THREE.Mesh(
  new THREE.SphereGeometry(0.03, 10, 10),
  new THREE.MeshNormalMaterial()
);
testMesh_04.position.set(
  pointsOfInterestLocationsParams.pointsOfInterest_04.x,
  pointsOfInterestLocationsParams.pointsOfInterest_04.y,
  pointsOfInterestLocationsParams.pointsOfInterest_04.z
);
scene.add(testMesh_04);

// points of interests
const offset = 0.1;
const points = [
  {
    position: new THREE.Vector3(
      pointsOfInterestLocationsParams.pointsOfInterest_00.x + offset,
      pointsOfInterestLocationsParams.pointsOfInterest_00.y + offset,
      pointsOfInterestLocationsParams.pointsOfInterest_00.z + offset
    ),
    element: document.querySelector(".point-0"),
  },
  {
    position: new THREE.Vector3(
      pointsOfInterestLocationsParams.pointsOfInterest_01.x + offset,
      pointsOfInterestLocationsParams.pointsOfInterest_01.y + offset,
      pointsOfInterestLocationsParams.pointsOfInterest_01.z + offset
    ),
    element: document.querySelector(".point-1"),
  },
  {
    position: new THREE.Vector3(
      pointsOfInterestLocationsParams.pointsOfInterest_02.x + offset,
      pointsOfInterestLocationsParams.pointsOfInterest_02.y + offset,
      pointsOfInterestLocationsParams.pointsOfInterest_02.z + offset
    ),
    element: document.querySelector(".point-2"),
  },
  {
    position: new THREE.Vector3(
      pointsOfInterestLocationsParams.pointsOfInterest_03.x + offset,
      pointsOfInterestLocationsParams.pointsOfInterest_03.y + offset,
      pointsOfInterestLocationsParams.pointsOfInterest_03.z + offset
    ),
    element: document.querySelector(".point-3"),
  },
  {
    position: new THREE.Vector3(
      pointsOfInterestLocationsParams.pointsOfInterest_04.x + offset,
      pointsOfInterestLocationsParams.pointsOfInterest_04.y + offset,
      pointsOfInterestLocationsParams.pointsOfInterest_04.z + offset
    ),
    element: document.querySelector(".point-4"),
  },
];

// GUI
const pointsOfInterestLocationFolder_00 = gui.addFolder("pointsOfInterest_00");
pointsOfInterestLocationFolder_00.close();
pointsOfInterestLocationFolder_00
  .add(pointsOfInterestLocationsParams.pointsOfInterest_00, "x", -10, 10, 0.001)
  .onChange(() => {
    testMesh_00.position.x =
      pointsOfInterestLocationsParams.pointsOfInterest_00.x;
  });
pointsOfInterestLocationFolder_00
  .add(pointsOfInterestLocationsParams.pointsOfInterest_00, "y", -10, 10, 0.001)
  .onChange(() => {
    testMesh_00.position.y =
      pointsOfInterestLocationsParams.pointsOfInterest_00.y;
  });
pointsOfInterestLocationFolder_00
  .add(pointsOfInterestLocationsParams.pointsOfInterest_00, "z", -10, 10, 0.001)
  .onChange(() => {
    testMesh_00.position.z =
      pointsOfInterestLocationsParams.pointsOfInterest_00.z;
  });

const pointsOfInterestLocationFolder_01 = gui.addFolder("pointsOfInterest_01");
pointsOfInterestLocationFolder_01.close();
pointsOfInterestLocationFolder_01
  .add(pointsOfInterestLocationsParams.pointsOfInterest_01, "x", -10, 10, 0.001)
  .onChange(() => {
    testMesh_01.position.x =
      pointsOfInterestLocationsParams.pointsOfInterest_01.x;
  });
pointsOfInterestLocationFolder_01
  .add(pointsOfInterestLocationsParams.pointsOfInterest_01, "y", -10, 10, 0.001)
  .onChange(() => {
    testMesh_01.position.y =
      pointsOfInterestLocationsParams.pointsOfInterest_01.y;
  });
pointsOfInterestLocationFolder_01
  .add(pointsOfInterestLocationsParams.pointsOfInterest_01, "z", -10, 10, 0.001)
  .onChange(() => {
    testMesh_01.position.z =
      pointsOfInterestLocationsParams.pointsOfInterest_01.z;
  });

const pointsOfInterestLocationFolder_02 = gui.addFolder("pointsOfInterest_02");
pointsOfInterestLocationFolder_02.close();
pointsOfInterestLocationFolder_02
  .add(pointsOfInterestLocationsParams.pointsOfInterest_02, "x", -10, 10, 0.001)
  .onChange(() => {
    testMesh_02.position.x =
      pointsOfInterestLocationsParams.pointsOfInterest_02.x;
  });
pointsOfInterestLocationFolder_02
  .add(pointsOfInterestLocationsParams.pointsOfInterest_02, "y", -10, 10, 0.001)
  .onChange(() => {
    testMesh_02.position.y =
      pointsOfInterestLocationsParams.pointsOfInterest_02.y;
  });
pointsOfInterestLocationFolder_02
  .add(pointsOfInterestLocationsParams.pointsOfInterest_02, "z", -10, 10, 0.001)
  .onChange(() => {
    testMesh_02.position.z =
      pointsOfInterestLocationsParams.pointsOfInterest_02.z;
  });

const pointsOfInterestLocationFolder_03 = gui.addFolder("pointsOfInterest_03");
pointsOfInterestLocationFolder_03.close();
pointsOfInterestLocationFolder_03
  .add(pointsOfInterestLocationsParams.pointsOfInterest_03, "x", -10, 10, 0.001)
  .onChange(() => {
    testMesh_03.position.x =
      pointsOfInterestLocationsParams.pointsOfInterest_03.x;
  });
pointsOfInterestLocationFolder_03
  .add(pointsOfInterestLocationsParams.pointsOfInterest_03, "y", -10, 10, 0.001)
  .onChange(() => {
    testMesh_03.position.y =
      pointsOfInterestLocationsParams.pointsOfInterest_03.y;
  });
pointsOfInterestLocationFolder_03
  .add(pointsOfInterestLocationsParams.pointsOfInterest_03, "z", -10, 10, 0.001)
  .onChange(() => {
    testMesh_03.position.z =
      pointsOfInterestLocationsParams.pointsOfInterest_03.z;
  });

const pointsOfInterestLocationFolder_04 = gui.addFolder("pointsOfInterest_04");
pointsOfInterestLocationFolder_04.close();
pointsOfInterestLocationFolder_04
  .add(pointsOfInterestLocationsParams.pointsOfInterest_04, "x", -10, 10, 0.001)
  .onChange(() => {
    testMesh_04.position.x =
      pointsOfInterestLocationsParams.pointsOfInterest_04.x;
  });
pointsOfInterestLocationFolder_04
  .add(pointsOfInterestLocationsParams.pointsOfInterest_04, "y", -10, 10, 0.001)
  .onChange(() => {
    testMesh_04.position.y =
      pointsOfInterestLocationsParams.pointsOfInterest_04.y;
  });
pointsOfInterestLocationFolder_04
  .add(pointsOfInterestLocationsParams.pointsOfInterest_04, "z", -10, 10, 0.001)
  .onChange(() => {
    testMesh_04.position.z =
      pointsOfInterestLocationsParams.pointsOfInterest_04.z;
  });

/**
 * Lights ======================================================================
 */
const directionalLight = new THREE.DirectionalLight("#ffffff", 3);
directionalLight.castShadow = true;
directionalLight.shadow.camera.far = 15;
directionalLight.shadow.mapSize.set(1024, 1024);
directionalLight.shadow.normalBias = 0.05;
directionalLight.position.set(0.25, 3, -2.25);
scene.add(directionalLight);

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
camera.position.set(3.595, 1.118, -1.75);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

// GUI
const cameraFolder = gui.addFolder("camera");
cameraFolder.close();
cameraFolder.add(camera.position, "x", -10, 10, 0.001);
cameraFolder.add(camera.position, "y", -10, 10, 0.001);
cameraFolder.add(camera.position, "z", -10, 10, 0.001);

/**
 * Renderer ====================================================================
 */
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
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
  stats.begin();

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

  stats.end();
};

tick();

/**
 * Texture switch with keyboards =======================================================================
 */

document.addEventListener("keydown", (e) => {
  switch (event.keyCode) {
    case 65: // a
    case 37: // left arrow
      if (matcapIndex !== 1) {
        matcapIndex--;
        matcapImage.src = matcapURLBase + matcapIndex + ".png";
        console.log((matcapImage.src = matcapURLBase + matcapIndex + ".png"));
        break;
      } else {
        matcapIndex = 12;
        matcapImage.src = matcapURLBase + matcapIndex + ".png";
        console.log((matcapImage.src = matcapURLBase + matcapIndex + ".png"));
        break;
      }

    case 68: // d
    case 39: //right arrow
      if (matcapIndex !== 12) {
        matcapIndex++;
        matcapImage.src = matcapURLBase + matcapIndex + ".png";
        console.log((matcapImage.src = matcapURLBase + matcapIndex + ".png"));
        break;
      } else {
        matcapIndex = 1;
        matcapImage.src = matcapURLBase + matcapIndex + ".png";
        console.log((matcapImage.src = matcapURLBase + matcapIndex + ".png"));
        break;
      }

    default:
      break;
  }
});
