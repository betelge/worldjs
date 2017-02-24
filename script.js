var canvas;
var gl;
var program;
var m; // Manager for geometries, textures, uniforms, etc.

var projMatUniform;
var cam;

var RES = 128;
var resUniform;
var isLODFrozen = false;

var patches = [];

var controller;

var Quad = class {
  constructor(x, y, scale)  {
    this.x = x; // [0, 1] position within the root quad
    this.y = y;
    this.scale = scale;

    this.isLeaf = true;
    this.children = [];
    this.sceneNode; // Reference to sceneNode
  }
}

var root = new Quad(0, 0, 100);

function start() {
  canvas = document.getElementById('canvas');

  gl = initWebGL2(canvas);

  if(!gl) {

  }

  cam = new Camera(40/180*3.141);
  cam.position = vec3.fromValues(0, 5, 2.5)
  var tempMat = mat4.create();
  mat4.lookAt(tempMat, cam.position, vec3.fromValues(0,0,0), vec3.fromValues(0,0,1));
  mat4.getRotation(cam.rotation, tempMat);
  m = new Manager(gl, cam);

  projMatUniform = new Uniform("projMat", gl.FLOAT, mat4.create());
  window.addEventListener('resize', resize);
  resize();

  program = loadShader(document.getElementById("vertex_shader"),
        document.getElementById("fragment_shader"));

  material = new Material(program);
  material.uniforms.push(projMatUniform);

  /*for(var i = -2; i <= 2; i++)
    for(var j = -2; j <= 2; j++)
      patches.push(createPatch(material, i, j));*/

  controller = new Controller(cam, cam, canvas, document);
  controller.useAbsoluteZ = true;

  resUniform = new Uniform("res", gl.INT, RES);
  material.uniforms.push(resUniform);

  redraw();

  addEventListener("keydown", keyDown);
}

var frustumMat = mat4.create();
function arrangePatches(pos, rot) {
  patches = [];

  // Construct matrix for checking against frustum
  mat4.fromRotationTranslationScale(
      frustumMat, cam.rotation, cam.position, cam.scale);
  mat4.invert(frustumMat, frustumMat);
  mat4.mul(frustumMat, projMatUniform.array, frustumMat);

  recurseQuad(root, pos, rot);
}

var lodSplit = 1;
var lodMerge = lodSplit * 1.1;

var tempVecs = [];
for(var i = 0; i < 4; i++)
  tempVecs.push(vec3.create());

function recurseQuad(quad, pos, rot) {

  // Ignore if outside frustum
  // TODO: Checking naivly now
  for(var i = 0; i < 2; i++)
    for(var j = 0; j < 2; j++) {
      tempVecs[2*i+j][0] = quad.x + (i - .5) * quad.scale;
      tempVecs[2*i+j][1] = quad.y + (j - .5) * quad.scale;
      tempVecs[2*i+j][2] = 0;

      vec3.transformMat4(tempVecs[2*i+j], tempVecs[2*i+j], frustumMat);
    }
  
  var isInside = false;
  for(var i = 0; i < 4; i++)
    isInside = isInside
      ||(Math.abs(tempVecs[i][0]) < 1
      && Math.abs(tempVecs[i][1]) < 1
      && Math.abs(tempVecs[i][2]) < 1);
  if(!isInside) { // If no points inide frustum, check for intersections
    var isCrossing = true;
    for(var i = 0; i < 2; i++) {
      var is = false;
      is = is || tempVecs[0][i] * tempVecs[1][i] < 0;
      is = is || tempVecs[2][i] * tempVecs[3][i] < 0;
      is = is || tempVecs[1][i] * tempVecs[3][i] < 0;
      is = is || tempVecs[0][i] * tempVecs[2][i] < 0;
      isCrossing = isCrossing && is;
    }

    isInside = isInside || isCrossing;
  }
  if(!isInside) return;

  // Check distance
  // TODO: Find a better check than distance to middle of quad

  var dx = quad.x - pos[0];
  var dy = quad.y - pos[1];
  var dz = pos[2];

  if(quad.isLeaf) {
    
    // Do we split it
    if(dx*dx + dy*dy + dz*dz < quad.scale*quad.scale * lodSplit*lodSplit) {
      // Split
      quad.isLeaf = false;
      quad.sceneNode = null;
      quad.children.push(
          new Quad(quad.x - .25*quad.scale, quad.y - .25*quad.scale, .5*quad.scale));
      quad.children.push(
          new Quad(quad.x - .25*quad.scale, quad.y + .25*quad.scale, .5*quad.scale));
      quad.children.push(
          new Quad(quad.x + .25*quad.scale, quad.y - .25*quad.scale, .5*quad.scale));
      quad.children.push(
          new Quad(quad.x + .25*quad.scale, quad.y + .25*quad.scale, .5*quad.scale));
    }
  }
  else {
    
    // Do we merge
    if(dx*dx + dy*dy + dz*dz > quad.scale*quad.scale * lodMerge*lodMerge) {
      // Merge
      quad.isLeaf = true;
      quad.children = [];
    }
  }

  if(quad.isLeaf) {
    if(!quad.sceneNode) {
      quad.sceneNode = createPatch(material, quad.x, quad.y, quad.scale);
    }
    patches.push(quad.sceneNode);
  }
  else {
    for(var i = 0; i < quad.children.length; i++) {
      recurseQuad(quad.children[i], pos,rot);
    }
  }
}

function createPatch(material, x, y, scale) {
  var patch = new SceneNode();
  patch.geometry = new Geometry();
  patch.geometry.count = 2*RES * (RES-1) + (RES-2)*2;
  patch.material = material;

  patch.position[0] += x;
  patch.position[1] += y;
  patch.setScale(scale);

  patch.uniforms.push(new Uniform("patchPos", gl.FLOAT, [x, y, 0]));
  patch.uniforms.push(new Uniform("scale", gl.FLOAT, scale));

  return patch;
}

function redraw() {
  requestAnimationFrame(draw);
}

function draw() {

  controller.updateControls();

  if(!isLODFrozen)
    arrangePatches(cam.position, cam.rotation);
  
  gl.clearColor(.1, .1, .3, 1);
  gl.enable(gl.DEPTH_TEST);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  for(var i = 0; i < patches.length; i++)
    m.draw(patches[i]);

  if(controller.state !== controller.STATE.NONE)
    redraw();
}

function onClick(event) {
  var x = 2 * event.clientX/canvas.width - 1;
  var y = 2 * event.clientY/canvas.height - 1;
  vec3.set(square.position, -x, y, 0);

  redraw();
}

function fullscreen() {
  if(canvas.webkitRequestFullScreen) {
    canvas.webkitRequestFullScreen();
  }
  else {
    canvas.mozRequestFullScreen();
  }
}

function resize(event) {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  
  gl.viewport(0, 0, canvas.width, canvas.height);

  mat4.perspective(projMatUniform.array, cam.fov, canvas.width / canvas.height, .05, 1000);

  redraw();
}

function keyDown(event) {
  switch(event.code) {
    case "KeyT":
      isLODFrozen = !isLODFrozen;
      if(!isLODFrozen)
        redraw();
      break;
    case "KeyL":
      m.isLineMode = !m.isLineMode;
      redraw();
      break;
    default:
  }
}