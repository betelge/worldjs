var canvas;
var gl;
var program;
var m; // Manager for geometries, textures, uniforms, etc.

var projMatUniform;
var cam;

var RES = 32;
var resUniform;

var square;

var controller;

function start() {
  canvas = document.getElementById('canvas');

  gl = initWebGL2(canvas);

  if(!gl) {

  }

  cam = new Camera(40/180*3.141);
  cam.position = vec3.fromValues(0, 10, 5)
  var tempMat = mat4.create();
  mat4.lookAt(tempMat, cam.position, vec3.fromValues(0,0,0), vec3.fromValues(0,0,1));
  mat4.getRotation(cam.rotation, tempMat);
  m = new Manager(gl, cam);

  projMatUniform = new Uniform("projMat", gl.FLOAT, mat4.create());
  window.addEventListener('resize', resize);
  resize();

  program = loadShader(document.getElementById("vertex_shader"),
        document.getElementById("fragment_shader"));

  square = new SceneNode();
  square.geometry = new Geometry();
  square.geometry.count = 2*RES * (RES-1) + (RES-2)*2;
  material = new Material(program);
  square.material = material;
  material.uniforms.push(projMatUniform);

  //square.scale = vec3.fromValues(100,100,1);

  controller = new Controller(cam, cam, canvas, document);
  controller.useAbsoluteZ = true;

  resUniform = new Uniform("res", gl.INT, RES);
  material.uniforms.push(resUniform);

  redraw();
}

function redraw() {
  requestAnimationFrame(draw);
}

function draw() {

  controller.updateControls();
  
  gl.clearColor(.1, .1, .3, 1);
  gl.enable(gl.DEPTH_TEST);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  m.draw(square);

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

  mat4.perspective(projMatUniform.array, cam.fov, canvas.width / canvas.height, .05, 100);

  redraw();
}
