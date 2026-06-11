/* ============================================
   ENDLESS TRAFFIC - 3D Car Simulator
   Main Game Logic
   ============================================ */

// ============================================
// GAME CONFIGURATION
// ============================================
const CONFIG = {
    // Lane positions (x-coordinates)
    LANES: [-3.5, 0, 3.5],
    
    // Road settings
    ROAD_SEGMENT_LENGTH: 40,
    ROAD_WIDTH: 12,
    ROAD_SEGMENTS: 3,
    
    // Player settings
    PLAYER_BASE_SPEED: 0.8,
    PLAYER_MAX_SPEED: 1.5,
    PLAYER_BRAKE_SPEED: 0.3,
    LANE_SWITCH_SPEED: 0.15,
    
    // Traffic settings
    TRAFFIC_SPAWN_RATE: 120, // frames between spawns (decreases with difficulty)
    TRAFFIC_MIN_SPAWN_RATE: 40,
    TRAFFIC_SPEED: 0.15, // Slower NPC cars for better user experience
    
    // Difficulty scaling
    DIFFICULTY_INCREASE_INTERVAL: 600, // frames (~10 seconds at 60fps)
    SPEED_INCREMENT: 0.05,
    SPAWN_RATE_DECREMENT: 5,
    
    // Collision
    COLLISION_BUFFER: 0.8,
    
    // Camera
    CAMERA_OFFSET: { x: 0, y: 5, z: -10 },
    CAMERA_LOOK_AT: { x: 0, y: 0, z: 5 },
};

// ============================================
// GAME STATE
// ============================================
const state = {
    isPlaying: false,
    isGameOver: false,
    score: 0,
    bestScore: 0,
    speed: 0,
    targetSpeed: CONFIG.PLAYER_BASE_SPEED,
    currentLane: 1, // 0 = left, 1 = center, 2 = right
    targetLane: 1,
    lanePosition: 0,
    difficulty: 1,
    frames: 0,
    lastSpawnFrame: 0,
    trafficCars: [],
    roadSegments: [],
};

// ============================================
// THREE.JS SETUP
// ============================================
const canvas = document.getElementById('game-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue
scene.fog = new THREE.Fog(0x87CEEB, 20, 80);

// Camera setup
const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ 
    canvas: canvas,
    antialias: true,
    powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ============================================
// LIGHTING
// ============================================
// Ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// Directional light (sun)
const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(10, 20, -10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 100;
sunLight.shadow.camera.left = -20;
sunLight.shadow.camera.right = 20;
sunLight.shadow.camera.top = 20;
sunLight.shadow.camera.bottom = -20;
scene.add(sunLight);

// ============================================
// MATERIALS
// ============================================
const materials = {
    // Road materials
    road: new THREE.MeshLambertMaterial({ color: 0x333333 }),
    grass: new THREE.MeshLambertMaterial({ color: 0x2d5016 }),
    line: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    lineDashed: new THREE.MeshBasicMaterial({ color: 0xffcc00 }),
    
    // Car materials
    carBody: new THREE.MeshPhongMaterial({ color: 0x0066cc, shininess: 100 }),
    carTop: new THREE.MeshPhongMaterial({ color: 0x004499, shininess: 100 }),
    carWindow: new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 200 }),
    wheel: new THREE.MeshLambertMaterial({ color: 0x222222 }),
    headlight: new THREE.MeshBasicMaterial({ color: 0xffffaa }),
    taillight: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    
    // Traffic car colors (random selection)
    trafficColors: [
        new THREE.MeshPhongMaterial({ color: 0xcc0000, shininess: 100 }), // Red
        new THREE.MeshPhongMaterial({ color: 0x00cc00, shininess: 100 }), // Green
        new THREE.MeshPhongMaterial({ color: 0xcccc00, shininess: 100 }), // Yellow
        new THREE.MeshPhongMaterial({ color: 0xcc00cc, shininess: 100 }), // Purple
        new THREE.MeshPhongMaterial({ color: 0x00cccc, shininess: 100 }), // Cyan
        new THREE.MeshPhongMaterial({ color: 0xff6600, shininess: 100 }), // Orange
        new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 100 }), // Gray
        new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 100 }), // White
    ],
};

// ============================================
// OBJECT CREATION FUNCTIONS
// ============================================

/**
 * Create a low-poly car
 * @param {boolean} isPlayer - Whether this is the player car
 * @param {THREE.Material} bodyMaterial - Material for the car body
 * @returns {THREE.Group} The car group
 */
function createCar(isPlayer = false, bodyMaterial = null) {
    const car = new THREE.Group();
    
    // Use provided material or default
    const bodyMat = bodyMaterial || materials.carBody;
    
    // Main body
    const bodyGeom = new THREE.BoxGeometry(2, 0.8, 4);
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    body.receiveShadow = true;
    car.add(body);
    
    // Car top (cabin)
    const topGeom = new THREE.BoxGeometry(1.6, 0.6, 2);
    const top = new THREE.Mesh(topGeom, materials.carTop);
    top.position.y = 1.3;
    top.position.z = -0.3;
    top.castShadow = true;
    car.add(top);
    
    // Windshield
    const windshieldGeom = new THREE.BoxGeometry(1.4, 0.4, 0.1);
    const windshield = new THREE.Mesh(windshieldGeom, materials.carWindow);
    windshield.position.set(0, 1.3, 0.71);
    windshield.rotation.x = -0.2;
    car.add(windshield);
    
    // Rear window
    const rearWindowGeom = new THREE.BoxGeometry(1.4, 0.4, 0.1);
    const rearWindow = new THREE.Mesh(rearWindowGeom, materials.carWindow);
    rearWindow.position.set(0, 1.3, -1.31);
    car.add(rearWindow);
    
    // Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
    wheelGeom.rotateZ(Math.PI / 2);
    
    const wheelPositions = [
        { x: -0.9, z: 1.2 },  // Front left
        { x: 0.9, z: 1.2 },   // Front right
        { x: -0.9, z: -1.2 }, // Rear left
        { x: 0.9, z: -1.2 },  // Rear right
    ];
    
    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeom, materials.wheel);
        wheel.position.set(pos.x, 0.35, pos.z);
        wheel.castShadow = true;
        car.add(wheel);
    });
    
    // Headlights (for player car)
    if (isPlayer) {
        const headlightGeom = new THREE.BoxGeometry(0.4, 0.2, 0.1);
        const leftHeadlight = new THREE.Mesh(headlightGeom, materials.headlight);
        leftHeadlight.position.set(-0.6, 0.7, 2.01);
        car.add(leftHeadlight);
        
        const rightHeadlight = new THREE.Mesh(headlightGeom, materials.headlight);
        rightHeadlight.position.set(0.6, 0.7, 2.01);
        car.add(rightHeadlight);
        
        // Taillights
        const taillightGeom = new THREE.BoxGeometry(0.4, 0.2, 0.1);
        const leftTaillight = new THREE.Mesh(taillightGeom, materials.taillight);
        leftTaillight.position.set(-0.6, 0.7, -2.01);
        car.add(leftTaillight);
        
        const rightTaillight = new THREE.Mesh(taillightGeom, materials.taillight);
        rightTaillight.position.set(0.6, 0.7, -2.01);
        car.add(rightTaillight);
    }
    
    // Store bounding box for collision
    car.userData.boundingBox = new THREE.Box3();
    car.userData.boundingBox.setFromObject(body);
    
    return car;
}

/**
 * Create a road segment
 * @param {number} zPosition - Initial Z position
 * @returns {THREE.Group} The road segment group
 */
function createRoadSegment(zPosition) {
    const segment = new THREE.Group();
    
    // Road surface
    const roadGeom = new THREE.PlaneGeometry(CONFIG.ROAD_WIDTH, CONFIG.ROAD_SEGMENT_LENGTH);
    const road = new THREE.Mesh(roadGeom, materials.road);
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    segment.add(road);
    
    // Grass on sides
    const grassGeom = new THREE.PlaneGeometry(20, CONFIG.ROAD_SEGMENT_LENGTH);
    
    const leftGrass = new THREE.Mesh(grassGeom, materials.grass);
    leftGrass.rotation.x = -Math.PI / 2;
    leftGrass.position.x = -CONFIG.ROAD_WIDTH / 2 - 10;
    leftGrass.receiveShadow = true;
    segment.add(leftGrass);
    
    const rightGrass = new THREE.Mesh(grassGeom, materials.grass);
    rightGrass.rotation.x = -Math.PI / 2;
    rightGrass.position.x = CONFIG.ROAD_WIDTH / 2 + 10;
    rightGrass.receiveShadow = true;
    segment.add(rightGrass);
    
    // Lane markings
    const lineGeom = new THREE.PlaneGeometry(0.15, 3);
    lineGeom.rotateX(-Math.PI / 2);
    
    // Dashed lines for lane dividers
    const numDashes = Math.floor(CONFIG.ROAD_SEGMENT_LENGTH / 6);
    for (let i = 0; i < numDashes; i++) {
        // Left divider
        const leftLine = new THREE.Mesh(lineGeom, materials.lineDashed);
        leftLine.position.set(-CONFIG.ROAD_WIDTH / 6 * 1, 0.01, -CONFIG.ROAD_SEGMENT_LENGTH / 2 + i * 6 + 3);
        segment.add(leftLine);
        
        // Right divider
        const rightLine = new THREE.Mesh(lineGeom, materials.lineDashed);
        rightLine.position.set(CONFIG.ROAD_WIDTH / 6 * 1, 0.01, -CONFIG.ROAD_SEGMENT_LENGTH / 2 + i * 6 + 3);
        segment.add(rightLine);
    }
    
    // Solid lines on edges
    const edgeLineGeom = new THREE.PlaneGeometry(0.2, CONFIG.ROAD_SEGMENT_LENGTH);
    edgeLineGeom.rotateX(-Math.PI / 2);
    
    const leftEdge = new THREE.Mesh(edgeLineGeom, materials.line);
    leftEdge.position.set(-CONFIG.ROAD_WIDTH / 2 + 0.2, 0.01, 0);
    segment.add(leftEdge);
    
    const rightEdge = new THREE.Mesh(edgeLineGeom, materials.line);
    rightEdge.position.set(CONFIG.ROAD_WIDTH / 2 - 0.2, 0.01, 0);
    segment.add(rightEdge);
    
    segment.position.z = zPosition;
    
    return segment;
}

// ============================================
// GAME OBJECTS
// ============================================
let playerCar;

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the game
 */
function init() {
    // Load best score from localStorage
    loadBestScore();
    
    // Create player car
    playerCar = createCar(true);
    playerCar.position.set(CONFIG.LANES[1], 0, 0);
    scene.add(playerCar);
    
    // Create road segments
    for (let i = 0; i < CONFIG.ROAD_SEGMENTS; i++) {
        const segment = createRoadSegment(i * CONFIG.ROAD_SEGMENT_LENGTH);
        state.roadSegments.push(segment);
        scene.add(segment);
    }
    
    // Set initial camera position
    updateCamera();
    
    // Event listeners
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    
    // Button listeners
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', restartGame);
    
    // Update UI
    updateScoreUI();
    
    // Start render loop (but not game logic yet)
    animate();
}

// ============================================
// INPUT HANDLING
// ============================================
const keys = {
    left: false,
    right: false,
    brake: false,
};

function onKeyDown(event) {
    if (!state.isPlaying || state.isGameOver) return;
    
    switch(event.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
            keys.left = true;
            // Move to left lane (toward index 0 = -3.5)
            if (state.targetLane > 0) state.targetLane--;
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            keys.right = true;
            // Move to right lane (toward index 2 = +3.5)
            if (state.targetLane < 2) state.targetLane++;
            break;
        case ' ':
        case 'ArrowDown':
        case 's':
        case 'S':
            keys.brake = true;
            document.body.classList.add('braking');
            break;
    }
}

function onKeyUp(event) {
    switch(event.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
            keys.left = false;
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            keys.right = false;
            break;
        case ' ':
        case 'ArrowDown':
        case 's':
        case 'S':
            keys.brake = false;
            document.body.classList.remove('braking');
            break;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================
// GAME LOGIC
// ============================================

/**
 * Start the game
 */
function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    state.isPlaying = true;
    state.isGameOver = false;
    state.score = 0;
    state.speed = CONFIG.PLAYER_BASE_SPEED;
    state.targetSpeed = CONFIG.PLAYER_BASE_SPEED;
    state.difficulty = 1;
    state.frames = 0;
    state.lastSpawnFrame = 0;
    state.currentLane = 1;
    state.targetLane = 1;
    state.lanePosition = CONFIG.LANES[1];
    
    // Reset player position
    playerCar.position.set(CONFIG.LANES[1], 0, 0);
    playerCar.rotation.y = 0;
    
    // Clear existing traffic - properly remove all car meshes from scene
    state.trafficCars.forEach(car => {
        scene.remove(car.mesh);
    });
    state.trafficCars = [];
    
    // Reset road segments
    state.roadSegments.forEach((segment, i) => {
        segment.position.z = i * CONFIG.ROAD_SEGMENT_LENGTH;
    });
    
    updateScoreUI();
}

/**
 * Game over handler
 */
function gameOver() {
    state.isPlaying = false;
    state.isGameOver = true;
    
    // Update best score
    if (state.score > state.bestScore) {
        state.bestScore = state.score;
        saveBestScore();
    }
    
    // Update game over screen
    document.getElementById('final-score').textContent = Math.floor(state.score);
    document.getElementById('final-best-score').textContent = Math.floor(state.bestScore);
    document.getElementById('game-over-screen').classList.remove('hidden');
}

/**
 * Restart the game
 */
function restartGame() {
    document.getElementById('game-over-screen').classList.add('hidden');
    startGame();
}

/**
 * Spawn a traffic car
 */
function spawnTraffic() {
    // Select random lane
    const lane = Math.floor(Math.random() * 3);
    
    // Select random color
    const colorIndex = Math.floor(Math.random() * materials.trafficColors.length);
    const carMaterial = materials.trafficColors[colorIndex];
    
    // Create traffic car
    const trafficCar = createCar(false, carMaterial);
    
    // Position ahead of player (positive Z is forward in our setup)
    const spawnDistance = 60 + Math.random() * 40;
    trafficCar.position.set(CONFIG.LANES[lane], 0, spawnDistance);
    
    // Add to scene and tracking array
    scene.add(trafficCar);
    state.trafficCars.push({
        mesh: trafficCar,
        lane: lane,
        speed: CONFIG.TRAFFIC_SPEED + (state.difficulty * 0.05),
    });
}

/**
 * Update road segments (infinite scrolling)
 */
function updateRoad() {
    state.roadSegments.forEach(segment => {
        // Move segment toward player (negative Z)
        segment.position.z -= state.speed;
        
        // If segment is behind camera, move it to the front
        if (segment.position.z < -CONFIG.ROAD_SEGMENT_LENGTH) {
            // Find the furthest segment
            let maxZ = -Infinity;
            state.roadSegments.forEach(s => {
                if (s.position.z > maxZ) maxZ = s.position.z;
            });
            
            // Move this segment to the front
            segment.position.z = maxZ + CONFIG.ROAD_SEGMENT_LENGTH;
        }
    });
}

/**
 * Update traffic cars
 */
function updateTraffic() {
    // Spawn new traffic
    const currentSpawnRate = Math.max(
        CONFIG.TRAFFIC_MIN_SPAWN_RATE,
        CONFIG.TRAFFIC_SPAWN_RATE - (state.difficulty - 1) * CONFIG.SPAWN_RATE_DECREMENT
    );
    
    if (state.frames - state.lastSpawnFrame > currentSpawnRate) {
        // Check if spawn lane is clear
        const laneToSpawn = Math.floor(Math.random() * 3);
        let canSpawn = true;
        
        for (const car of state.trafficCars) {
            if (car.lane === laneToSpawn && car.mesh.position.z > 40 && car.mesh.position.z < 80) {
                canSpawn = false;
                break;
            }
        }
        
        if (canSpawn) {
            spawnTraffic();
            state.lastSpawnFrame = state.frames;
        }
    }
    
    // Update existing traffic
    for (let i = state.trafficCars.length - 1; i >= 0; i--) {
        const car = state.trafficCars[i];
        
        // Move traffic toward player (they're coming from ahead)
        car.mesh.position.z -= state.speed + car.speed;
        
        // Remove if behind camera
        if (car.mesh.position.z < -20) {
            scene.remove(car.mesh);
            state.trafficCars.splice(i, 1);
        }
    }
}

/**
 * Update player car
 */
function updatePlayer() {
    // Handle braking
    if (keys.brake) {
        state.targetSpeed = CONFIG.PLAYER_BRAKE_SPEED;
    } else {
        state.targetSpeed = Math.min(
            CONFIG.PLAYER_MAX_SPEED,
            CONFIG.PLAYER_BASE_SPEED + (state.difficulty - 1) * CONFIG.SPEED_INCREMENT
        );
    }
    
    // Smooth speed transition
    state.speed += (state.targetSpeed - state.speed) * 0.05;
    
    // Smooth lane transition
    const targetX = CONFIG.LANES[state.targetLane];
    state.lanePosition += (targetX - state.lanePosition) * CONFIG.LANE_SWITCH_SPEED;
    playerCar.position.x = state.lanePosition;
    
    // Add slight tilt when changing lanes
    const laneDiff = state.targetLane - state.currentLane;
    const tiltAmount = (targetX - playerCar.position.x) * 0.05;
    playerCar.rotation.z = -tiltAmount;
    playerCar.rotation.y = tiltAmount * 0.3;
    
    // Update current lane when close enough
    if (Math.abs(targetX - state.lanePosition) < 0.1) {
        state.currentLane = state.targetLane;
    }
}

/**
 * Check collisions
 */
function checkCollisions() {
    // Player bounding box
    const playerBox = new THREE.Box3();
    playerBox.setFromObject(playerCar);
    
    // Shrink player box slightly for more forgiving collisions
    playerBox.expandByScalar(-CONFIG.COLLISION_BUFFER);
    
    for (const car of state.trafficCars) {
        const carBox = new THREE.Box3();
        carBox.setFromObject(car.mesh);
        
        if (playerBox.intersectsBox(carBox)) {
            gameOver();
            return;
        }
    }
}

/**
 * Update difficulty
 */
function updateDifficulty() {
    const newDifficulty = 1 + Math.floor(state.frames / CONFIG.DIFFICULTY_INCREASE_INTERVAL);
    if (newDifficulty > state.difficulty) {
        state.difficulty = newDifficulty;
    }
}

/**
 * Update score
 */
function updateScore() {
    // Score based on survival time and speed
    state.score += state.speed * 0.1;
    
    // Update UI every 10 frames
    if (state.frames % 10 === 0) {
        updateScoreUI();
    }
}

/**
 * Update camera position
 */
function updateCamera() {
    // Camera follows player with offset
    const targetX = playerCar.position.x * 0.3;
    camera.position.x += (targetX + CONFIG.CAMERA_OFFSET.x - camera.position.x) * 0.1;
    camera.position.y = CONFIG.CAMERA_OFFSET.y;
    camera.position.z = playerCar.position.z + CONFIG.CAMERA_OFFSET.z;
    
    // Look ahead of player
    camera.lookAt(
        playerCar.position.x * 0.2,
        CONFIG.CAMERA_LOOK_AT.y,
        playerCar.position.z + CONFIG.CAMERA_LOOK_AT.z
    );
}

/**
 * Update UI elements
 */
function updateScoreUI() {
    document.getElementById('current-score').textContent = Math.floor(state.score);
    document.getElementById('best-score').textContent = Math.floor(state.bestScore);
    
    // Speed in km/h (arbitrary scale for display)
    const speedKmh = Math.floor(state.speed * 100);
    document.getElementById('speed-value').textContent = speedKmh;
}

// ============================================
// LOCAL STORAGE
// ============================================

const STORAGE_KEY = 'endlessTraffic_bestScore';

function loadBestScore() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
            state.bestScore = parseInt(stored, 10) || 0;
        }
    } catch (e) {
        console.warn('localStorage not available');
        state.bestScore = 0;
    }
}

function saveBestScore() {
    try {
        localStorage.setItem(STORAGE_KEY, state.bestScore.toString());
    } catch (e) {
        console.warn('localStorage not available');
    }
}

// ============================================
// MAIN GAME LOOP
// ============================================

function animate() {
    requestAnimationFrame(animate);
    
    if (state.isPlaying && !state.isGameOver) {
        // Update game state
        state.frames++;
        
        updatePlayer();
        updateRoad();
        updateTraffic();
        checkCollisions();
        updateDifficulty();
        updateScore();
    }
    
    // Always update camera and render
    if (playerCar) {
        updateCamera();
    }
    
    renderer.render(scene, camera);
}

// ============================================
// START THE GAME
// ============================================
init();
