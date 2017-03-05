var canvas;
var gl;
var program;
var m; // Manager for geometries, textures, uniforms, etc.

var projMatUniform;
var cam;

var RES = 128;
var resUniform;
var isLODFrozen = false;

var znear = .05;
var zfar = 1000000;

var lodSplit = 1.5;
var lodMerge = lodSplit * 1.1;

var patches = [];0
var patchPool = [];

var controller;

var Quad = class {
  constructor(x, y, scale)  {
    this.x = x; // [0, 1] position within the root quad
    this.y = y;
    this.scale = scale;
    this.rot = quat.create();
    this.invRot = quat.create();

    this.isLeaf = true;
    this.children = [];
    this.sceneNode; // Reference to sceneNode
  }
}

var Planet = class {
  constructor(radius) {
    this.radius = radius;
    this.sides = [];

    var unitz = vec3.fromValues(0, 0, 1);
    for(var i = 0; i < 6; i++) {
      var quad = new Quad(0, 0, 2 * radius);
      var norm = vec3.create();
      norm[(i + 2)% 3] = 1;
      if(i >= 3)
        vec3.scale(norm, norm, -1);
      quat.rotationTo(quad.rot, unitz, norm);
      quat.invert(quad.invRot, quad.rot);
      this.sides.push(quad);
    }
  }
}

var planet = new Planet(1000);

function start() {
  canvas = document.getElementById('canvas');

  gl = initWebGL2(canvas);

  if(!gl) {

  }

  var ext = gl.getExtension("EXT_color_buffer_float");

  cam = new Camera(40/180*3.141);
  cam.position = vec3.fromValues(0, 60, planet.radius + 15)
  var tempMat = mat4.create();
  mat4.lookAt(tempMat, cam.position, vec3.fromValues(0,0,planet.radius), vec3.fromValues(0,0,1));
  mat4.getRotation(cam.rotation, tempMat);
  m = new Manager(gl, cam);

  projMatUniform = new Uniform("projMat", gl.FLOAT, mat4.create());
  window.addEventListener('resize', resize);
  resize();

  program = loadShader(document.getElementById("vertex_shader"),
        document.getElementById("fragment_shader"));

  material = new Material(program);
  material.uniforms.push(projMatUniform);

  controller = new Controller(cam, cam, planet.radius, canvas, document);
  controller.useAbsoluteZ = true;

  resUniform = new Uniform("res", gl.INT, RES);
  material.uniforms.push(resUniform);

  material.uniforms.push(new Uniform("radius", gl.FLOAT, planet.radius));


  redraw();

  addEventListener("keydown", keyDown);
}

var frustumMat = mat4.create();
var qCamPos = vec3.create();
var qCamRot = quat.create();
function arrangePatches(camPos, camRot) {
  patches = [];

  for(var i = 0; i < planet.sides.length; i++) {
    var root = planet.sides[i];
    
    // Transform to quad's orientation'
    vec3.transformQuat(qCamPos, camPos, root.invRot);
    quat.mul(qCamRot, root.invRot, camRot);

    // Construct matrix for checking against frustum
    mat4.fromRotationTranslationScale(
        frustumMat, qCamRot, qCamPos, cam.scale); // Cam scale doesn't get rotated properly
    mat4.invert(frustumMat, frustumMat);
    mat4.mul(frustumMat, projMatUniform.array, frustumMat);
    recurseQuad(root, qCamPos, qCamRot);
  }
}

var tempVecs = [];
for(var i = 0; i < 4; i++)
  tempVecs.push(vec4.create());

function recurseQuad(quad, camPos, camRot) {

  var isFacingCamera = false;

  // Ignore if outside frustum
  for(var i = 0; i < 2; i++)
    for(var j = 0; j < 2; j++) {
      tempVecs[2*i+j][0] = quad.x + (i - .5) * quad.scale;
      tempVecs[2*i+j][1] = quad.y + (j - .5) * quad.scale;
      tempVecs[2*i+j][2] = planet.radius;
      tempVecs[2*i+j][3] = 1; // w coordinate

      if(planet.radius > 0) {
        var length = vec3.length(tempVecs[2*i+j]);
        vec3.scale(tempVecs[2*i+j], tempVecs[2*i+j], planet.radius / length);
      }

      if(vec3.dot(tempVecs[2*i+j], camPos) > 0)
        isFacingCamera = true;

      vec4.transformMat4(tempVecs[2*i+j], tempVecs[2*i+j], frustumMat);
      vec4.scale(tempVecs[2*i+j], tempVecs[2*i+j], 1 / Math.abs(tempVecs[2*i+j][3]));
    }

  if(!isFacingCamera)
    return;

  var isInside = false;
  for(var i = 0; i < 4; i++) {
    isInside = isInside
      ||(Math.abs(tempVecs[i][0]) <= 1
      && Math.abs(tempVecs[i][1]) <= 1
      && Math.abs(tempVecs[i][2]) <= 1);
  }
  
  if(!isInside) {
    var outside = true;
    isInside = true;
    for(var i = 0; i < 4; i++) {
      outside = outside && tempVecs[i][0] < -1;
    }
    if(outside) isInside = false;

    outside = true;
    for(var i = 0; i < 4; i++) {
      outside = outside && tempVecs[i][0] > 1;
    }
    if(outside) isInside = false;

    outside = true;
    for(var i = 0; i < 4; i++) {
      outside = outside && tempVecs[i][1] < -1;
    }
    if(outside) isInside = false;

    outside = true;
    for(var i = 0; i < 4; i++) {
      outside = outside && tempVecs[i][1] > 1;
    }
    if(outside) isInside = false;

    outside = true;
    for(var i = 0; i < 4; i++) {
      outside = outside && tempVecs[i][2] < -1;
    }
    if(outside) isInside = false;

    outside = true;
    for(var i = 0; i < 4; i++) {
      outside = outside && tempVecs[i][2] > 1;
    }
    if(outside) isInside = false;
  }
  if(!isInside) return;


  // Check distance
  if(planet.radius == 0) { // Flat plane
    var dxa = quad.x  - .5 * quad.scale - camPos[0];
    var dxb = quad.x  + .5 * quad.scale - camPos[0];
    var dya = quad.y  - .5 * quad.scale - camPos[1];
    var dyb = quad.y  + .5 * quad.scale - camPos[1];

    var dza = -quad.scale - camPos[2]; // TODO: Height is not constant
    var dzb = +quad.scale - camPos[2];
    var dx2 = Math.min(dxa * dxa, dxb * dxb);
    var dy2 = Math.min(dya * dya, dyb * dyb);
    var dz2 = Math.min(dza * dza, dzb * dzb);

    var dist = dx2 + dy2 + dz2;
  }
  else { // Sphere

    // Project onto sphere
    vec3.set(tempVecs[0], quad.x, quad.y, planet.radius);
    var length = vec3.length(tempVecs[0]);
    vec3.scale(tempVecs[0], tempVecs[0], planet.radius / length);

    var dist = vec3.squaredDistance(tempVecs[0], camPos);
  }

  if(quad.isLeaf) {
    
    // Do we split it?
    if(dist < quad.scale*quad.scale * lodSplit*lodSplit) {
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

      for(var i = 0; i < quad.children.length; i++) {
        quat.copy(quad.children[i].rot, quad.rot);
        quat.copy(quad.children[i].invRot, quad.invRot);
      }
    }
  }
  else {
    
    // Do we merge?
    if(dist > quad.scale*quad.scale * lodMerge*lodMerge) {
      // Merge
      quad.isLeaf = true;
      for(var i = 0; i < quad.children.length; i++)
        if(quad.children[i].sceneNode)
          patchPool.push(quad.children[i].sceneNode);
      quad.children = [];
    }
  }

  if(quad.isLeaf) {
    if(!quad.sceneNode) {
      quad.sceneNode = createPatch(material, quad.x, quad.y, quad.scale, quad.rot);
      vec3.transformQuat(quad.sceneNode.position, quad.sceneNode.position, quad.rot);
      quat.copy(quad.sceneNode.rotation, quad.rot);
    }
    patches.push(quad.sceneNode);
  }
  else {
    for(var i = 0; i < quad.children.length; i++) {
      recurseQuad(quad.children[i], camPos, camRot);
    }
  }
}


var rttFbo = -1;
var rttProgram = -1;
var rttResLocation = -1;
var rttPatchPosLocation = -1;
var rttScaleLocation = -1;
var rttRadiusLocation = -1;
var rttNormMatLocation = -1;

function doProc(texture, x, y, scale, normMat) {
  
  if(texture.glname === -1)
    m.initTexture(texture);

  if(rttFbo === -1)
    rttFbo = gl.createFramebuffer();

  if(rttProgram === -1) {
    rttProgram = loadShader(document.getElementById("rtt_vertex_shader"),
        [document.getElementById("rtt_fragment_shader"),
        document.getElementById("terrain_shader"),
        document.getElementById("simplex3d_shader")]);

    rttResLocation = gl.getUniformLocation(rttProgram, "res");
    rttPatchPosLocation = gl.getUniformLocation(rttProgram, "patchPos");
    rttScaleLocation = gl.getUniformLocation(rttProgram, "scale");
    rttRadiusLocation = gl.getUniformLocation(rttProgram, "radius");
    rttNormMatLocation = gl.getUniformLocation(rttProgram, "normMat");
  }

  gl.useProgram(rttProgram);


  gl.uniform1i(rttResLocation, RES);
  gl.uniform3f(rttPatchPosLocation, x, y, 0);
  gl.uniform1f(rttScaleLocation, scale);
  gl.uniform1f(rttRadiusLocation, planet.radius);

  var nMat = mat3.create();
  mat3.fromQuat(nMat, normMat);
  gl.uniformMatrix3fv(rttNormMatLocation, false, nMat);

  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, rttFbo);

  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D,
    texture.glname, 0);

  var fboStatus = gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER);

  gl.viewport(0, 0, RES, RES);
  
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
}



function createPatch(material, x, y, scale, normMat) {
  var patch;
  if(patchPool.length === 0) {
    patch = new SceneNode();
    patch.geometry = new Geometry();

    patch.heightTexture = new Texture2d("heightTexture", gl.RGBA32F, gl.RGBA, RES, RES, gl.FLOAT, null);
    patch.textures.push(patch.heightTexture);
  }
  else {
     patch = patchPool.pop();
  }


  // Fill texture
  doProc(patch.heightTexture, x, y, scale, normMat);

  patch.geometry.count = 2*RES * (RES-1) + (RES-2)*2;
  patch.material = material;

  patch.position[0] = x;
  patch.position[1] = y;
  patch.position[2] = 0;
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

  mat4.perspective(projMatUniform.array, cam.fov, canvas.width / canvas.height, znear, zfar);

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